import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const serviceFile = 'apps/api/src/auth/clerk.service.ts';
const guardFile = 'apps/api/src/auth/clerk-auth.guard.ts';
const identity = { userId: 'user_alpha', sessionId: 'sess_alpha', orgId: 'org_alpha', orgRole: 'org:admin' };

async function serviceFor(auth, options = {}) {
  let calls = 0;
  const lookups = [];
  const upserts = [];
  const clerk = {
    authenticateRequest: async () => {
      calls++;
      if (options.error) throw options.error;
      return { isSignedIn: Boolean(auth?.userId), toAuth: () => auth };
    },
    sessions: {
      getSession: async (id) => {
        lookups.push({ operation: 'session', id });
        if (options.sessionError) throw options.sessionError;
        return options.session ?? {
          id: identity.sessionId, userId: identity.userId, status: 'active',
          expireAt: Date.now() + 60_000,
        };
      },
    },
    organizations: {
      getOrganizationMembershipList: async (params) => {
        lookups.push({ operation: 'membership', params });
        if (options.membershipError) throw options.membershipError;
        return { data: options.memberships ?? [{
          role: 'org:admin', publicUserData: { userId: identity.userId },
          organization: { id: identity.orgId },
        }] };
      },
      getOrganization: async (params) => {
        lookups.push({ operation: 'organization', params });
        if (options.organizationError) throw options.organizationError;
        return options.organization ?? { id: identity.orgId, name: 'Organização sintética' };
      },
    },
  };
  if (options.missingSessions) delete clerk.sessions;
  if (options.missingMemberships) delete clerk.organizations.getOrganizationMembershipList;
  const prisma = options.missingPrisma ? undefined : {
    organization: { upsert: async (params) => {
      upserts.push(params);
      if (options.upsertError) throw options.upsertError;
      return { id: identity.orgId };
    } },
  };
  const loaded = await loadTypeScript(serviceFile, {
    env: { NODE_ENV: 'production', CLERK_SECRET_KEY: 'sk_test_synthetic', CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic', ...options.env },
    clerk,
  });
  return { service: new loaded.exports.ClerkService(prisma), calls: () => calls, logs: loaded.logs, lookups, upserts };
}

for (const environment of ['test', 'development', 'production']) {
  test(`token sintético passa pela verificação do SDK e é rejeitado em ${environment}`, async () => {
    const fixture = await serviceFor(null, { env: { NODE_ENV: environment } });
    await assert.rejects(fixture.service.verifyToken('mock_test_token_valid_org1'));
    assert.equal(fixture.calls(), 1);
  });
}

test('utiliza os campos normalizados de toAuth', async () => {
  const fixture = await serviceFor(identity);
  const auth = await fixture.service.verifyToken('signed_fixture');
  assert.deepEqual({ ...auth }, identity);
});

for (const field of ['userId', 'sessionId', 'orgId']) {
  test(`rejeita sessão sem ${field}`, async () => {
    const fixture = await serviceFor({ ...identity, [field]: null });
    await assert.rejects(fixture.service.verifyToken('signed_fixture'));
  });
}

test('erros e logs não revelam mensagem interna do provedor', async () => {
  const secret = 'sk_private_sensitive_fixture';
  const fixture = await serviceFor(null, { error: new Error(secret) });
  await assert.rejects(fixture.service.verifyToken('signed_fixture'), (error) => !error.message.includes(secret));
  assert.equal(JSON.stringify(fixture.logs).includes(secret), false);
});

test('ausência de chave e ausência de token falham antes de chamar SDK', async () => {
  const fixture = await serviceFor(identity, { env: { CLERK_SECRET_KEY: '' } });
  await assert.rejects(fixture.service.verifyToken('signed_fixture'));
  await assert.rejects(fixture.service.verifyToken(''));
  assert.equal(fixture.calls(), 0);
});

test('chave pública exigida pelo SDK declarado também é obrigatória', async () => {
  const fixture = await serviceFor(identity, { env: { CLERK_PUBLISHABLE_KEY: '' } });
  await assert.rejects(fixture.service.verifyToken('signed_fixture'));
  assert.equal(fixture.calls(), 0);
});

test('guard rejeita cabeçalhos ausentes, duplicados ou com partes extras', async () => {
  const { exports } = await loadTypeScript(guardFile);
  let calls = 0;
  const guard = new exports.ClerkAuthGuard({ verifyToken: async () => { calls++; return identity; } });
  for (const header of [undefined, ['Bearer a', 'Bearer b'], 'Basic a', 'Bearer', 'Bearer a extra', 'Bearer a,b']) {
    const request = { headers: { authorization: header } };
    await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }) }));
  }
  assert.equal(calls, 0);
});

test('guard usa somente a organização resolvida pelo serviço', async () => {
  const { exports } = await loadTypeScript(guardFile);
  const guard = new exports.ClerkAuthGuard({ verifyToken: async () => identity });
  const request = { headers: { authorization: 'bEaReR signed_fixture', 'x-org-id': 'org_beta' } };
  assert.equal(await guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }) }), true);
  assert.equal(request.authContext.orgId, 'org_alpha');
});

test('exige APIs de sessão e membership e persistência, sem permissões por omissão', async () => {
  for (const option of ['missingSessions', 'missingMemberships', 'missingPrisma']) {
    const fixture = await serviceFor(identity, { [option]: true });
    await assert.rejects(fixture.service.verifyToken('signed_fixture'), undefined, option);
  }
});

test('sessão vigente precisa pertencer ao usuário e ao identificador autenticado', async () => {
  for (const changed of [{ userId: 'user_beta' }, { id: 'sess_beta' }]) {
    const fixture = await serviceFor(identity, {
      session: { id: identity.sessionId, userId: identity.userId,
        status: 'active', expireAt: Date.now() + 60_000, ...changed },
    });
    await assert.rejects(fixture.service.verifyToken('signed_fixture'));
    assert.equal(fixture.upserts.length, 0);
  }
});

test('sessão revogada ou expirada falha antes da sincronização', async () => {
  for (const changed of [{ status: 'revoked' }, { expireAt: Date.now() - 1 }, { expireAt: NaN }]) {
    const fixture = await serviceFor(identity, {
      session: { id: identity.sessionId, userId: identity.userId,
        status: 'active', expireAt: Date.now() + 60_000, ...changed },
    });
    await assert.rejects(fixture.service.verifyToken('signed_fixture'));
    assert.equal(fixture.upserts.length, 0);
  }
});

test('consulta membership pelo usuário e usa papel vigente em vez do papel antigo do token', async () => {
  const fixture = await serviceFor(identity, { memberships: [{
    role: 'org:member', publicUserData: { userId: identity.userId },
    organization: { id: identity.orgId },
  }] });
  const auth = await fixture.service.verifyToken('signed_fixture');
  assert.equal(auth.orgRole, 'org:member');
  const query = fixture.lookups.find((call) => call.operation === 'membership').params;
  assert.deepEqual({ ...query, userId: [...(query.userId ?? [])] }, {
    organizationId: identity.orgId, userId: [identity.userId], limit: 1,
  });
});

test('membership ausente, alheia, sem papel ou com papel desconhecido não autoriza', async () => {
  const member = {
    role: 'org:admin', publicUserData: { userId: identity.userId },
    organization: { id: identity.orgId },
  };
  for (const memberships of [
    [], [{ ...member, role: undefined }], [{ ...member, role: 'org:owner' }],
    [{ ...member, publicUserData: { userId: 'user_beta' } }],
    [{ ...member, organization: { id: 'org_beta' } }],
    [{ ...member, publicUserData: null, userId: identity.userId }],
  ]) {
    const fixture = await serviceFor(identity, { memberships });
    await assert.rejects(fixture.service.verifyToken('signed_fixture'));
    assert.equal(fixture.upserts.length, 0);
  }
});

test('organização confirmada no provedor é espelhada antes de conceder acesso', async () => {
  const fixture = await serviceFor(identity);
  await fixture.service.verifyToken('signed_fixture');
  assert.equal(fixture.upserts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.upserts[0])), {
    where: { id: identity.orgId },
    create: { id: identity.orgId, name: 'Organização sintética' },
    update: { name: 'Organização sintética' },
  });
  const foreign = await serviceFor(identity, { organization: { id: 'org_beta', name: 'Outra' } });
  await assert.rejects(foreign.service.verifyToken('signed_fixture'));
  assert.equal(foreign.upserts.length, 0);
});

test('falhas de consulta ou upsert impedem acesso e ocultam detalhes internos', async () => {
  const secret = 'provider_private_fixture';
  for (const option of ['sessionError', 'membershipError', 'organizationError', 'upsertError']) {
    const fixture = await serviceFor(identity, { [option]: new Error(secret) });
    await assert.rejects(fixture.service.verifyToken('signed_fixture'),
      (error) => !error.message.includes(secret));
    assert.equal(JSON.stringify(fixture.logs).includes(secret), false);
  }
});

test('remoção do vínculo depois de uma requisição válida é verificada novamente', async () => {
  const memberships = [{
    role: 'org:admin', publicUserData: { userId: identity.userId },
    organization: { id: identity.orgId },
  }];
  const fixture = await serviceFor(identity, { memberships });
  await fixture.service.verifyToken('signed_fixture');
  memberships.length = 0;
  await assert.rejects(fixture.service.verifyToken('signed_fixture'));
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.upserts.length, 1);
});
