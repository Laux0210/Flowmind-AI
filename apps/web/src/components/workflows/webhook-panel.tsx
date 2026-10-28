'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient, webhookUrl } from '@/lib/api-client';
import type { WebhookEndpointView } from '@/lib/api-client';

interface WebhookPanelProps {
  workflowId: string;
  getToken: () => Promise<string | null>;
}

/** Gestão de webhooks (somente admin, workflow ativado). O segredo aparece uma única vez. */
export function WebhookPanel({ workflowId, getToken }: WebhookPanelProps) {
  const contextRef = useRef({
    workflowId,
    getToken,
    generation: 0,
    pendingOps: 0,
    mounted: true,
  });

  if (contextRef.current.workflowId !== workflowId || contextRef.current.getToken !== getToken) {
    contextRef.current = {
      workflowId,
      getToken,
      generation: contextRef.current.generation + 1,
      pendingOps: 0,
      mounted: contextRef.current.mounted,
    };
  }

  const currentGen = contextRef.current.generation;
  const [view, setView] = useState<{
    generation: number;
    endpoints: WebhookEndpointView[];
    revealed: { publicId: string; secret: string } | null;
    error: string | null;
    busy: boolean;
  }>({
    generation: currentGen,
    endpoints: [],
    revealed: null,
    error: null,
    busy: false,
  });

  const isCurrent = view.generation === currentGen;
  const endpoints = isCurrent ? view.endpoints : [];
  const revealed = isCurrent ? view.revealed : null;
  const error = isCurrent ? view.error : null;
  const busy = isCurrent ? view.busy : false;

  useEffect(() => {
    contextRef.current.mounted = true;
    return () => {
      contextRef.current.mounted = false;
      contextRef.current.generation += 1;
      contextRef.current.pendingOps = 0;
    };
  }, []);

  const isStale = useCallback(
    (gen: number, targetWorkflowId: string, targetGetToken: () => Promise<string | null>) =>
      !contextRef.current.mounted ||
      contextRef.current.generation !== gen ||
      contextRef.current.workflowId !== targetWorkflowId ||
      contextRef.current.getToken !== targetGetToken,
    [],
  );

  const reloadForContext = useCallback(
    async (
      token: string | null,
      gen: number,
      targetWorkflowId: string,
      targetGetToken: () => Promise<string | null>,
    ) => {
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      const rows = await ApiClient.listWebhooks(targetWorkflowId, token);
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      const scopedRows = Array.isArray(rows)
        ? rows.filter((item) => item && item.workflowId === targetWorkflowId)
        : [];
      setView((prev) =>
        isStale(gen, targetWorkflowId, targetGetToken)
          ? prev
          : {
              generation: gen,
              endpoints: scopedRows,
              revealed: prev.generation === gen ? prev.revealed : null,
              error: prev.generation === gen ? prev.error : null,
              busy: prev.generation === gen ? prev.busy : false,
            },
      );
    },
    [isStale],
  );

  const run = useCallback(
    async (
      action: (
        token: string | null,
        gen: number,
        targetWorkflowId: string,
        targetGetToken: () => Promise<string | null>,
      ) => Promise<void>,
    ) => {
      const gen = contextRef.current.generation;
      const targetWorkflowId = contextRef.current.workflowId;
      const targetGetToken = contextRef.current.getToken;
      if (!targetWorkflowId || isStale(gen, targetWorkflowId, targetGetToken)) return;

      contextRef.current.pendingOps += 1;
      setView((prev) => ({
        generation: gen,
        endpoints: prev.generation === gen ? prev.endpoints : [],
        revealed: prev.generation === gen ? prev.revealed : null,
        error: null,
        busy: true,
      }));

      try {
        const token = await targetGetToken();
        if (isStale(gen, targetWorkflowId, targetGetToken)) return;
        await action(token, gen, targetWorkflowId, targetGetToken);
      } catch (caught) {
        if (isStale(gen, targetWorkflowId, targetGetToken)) return;
        const message = caught instanceof Error ? caught.message : 'A operação não foi concluída.';
        setView((prev) =>
          isStale(gen, targetWorkflowId, targetGetToken)
            ? prev
            : {
                generation: gen,
                endpoints: prev.generation === gen ? prev.endpoints : [],
                revealed: prev.generation === gen ? prev.revealed : null,
                error: message,
                busy: prev.generation === gen ? prev.busy : false,
              },
        );
      } finally {
        if (!isStale(gen, targetWorkflowId, targetGetToken)) {
          contextRef.current.pendingOps = Math.max(0, contextRef.current.pendingOps - 1);
          const stillBusy = contextRef.current.pendingOps > 0;
          setView((prev) =>
            isStale(gen, targetWorkflowId, targetGetToken)
              ? prev
              : {
                  generation: gen,
                  endpoints: prev.generation === gen ? prev.endpoints : [],
                  revealed: prev.generation === gen ? prev.revealed : null,
                  error: prev.generation === gen ? prev.error : null,
                  busy: stillBusy,
                },
          );
        }
      }
    },
    [isStale],
  );

  useEffect(() => {
    setView({
      generation: contextRef.current.generation,
      endpoints: [],
      revealed: null,
      error: null,
      busy: false,
    });
    void run((token, gen, targetWorkflowId, targetGetToken) =>
      reloadForContext(token, gen, targetWorkflowId, targetGetToken),
    );
  }, [workflowId, getToken, run, reloadForContext]);

  const create = () => {
    if (busy || contextRef.current.pendingOps > 0 || isStale(currentGen, workflowId, getToken)) return;
    void run(async (token, gen, targetWorkflowId, targetGetToken) => {
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      const created = await ApiClient.createWebhook(targetWorkflowId, token);
      if (
        isStale(gen, targetWorkflowId, targetGetToken) ||
        !created ||
        created.workflowId !== targetWorkflowId
      ) {
        return;
      }
      setView((prev) =>
        isStale(gen, targetWorkflowId, targetGetToken)
          ? prev
          : {
              generation: gen,
              endpoints: prev.generation === gen ? prev.endpoints : [],
              revealed: { publicId: created.publicId, secret: created.secret },
              error: prev.generation === gen ? prev.error : null,
              busy: prev.generation === gen ? prev.busy : false,
            },
      );
      await reloadForContext(token, gen, targetWorkflowId, targetGetToken);
    });
  };

  const rotate = (publicId: string) => {
    if (busy || contextRef.current.pendingOps > 0 || isStale(currentGen, workflowId, getToken)) return;
    const belongsToActiveContext = endpoints.some(
      (e) => e.publicId === publicId && e.workflowId === workflowId && e.status === 'ACTIVE',
    );
    if (!belongsToActiveContext) return;
    void run(async (token, gen, targetWorkflowId, targetGetToken) => {
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      const rotated = await ApiClient.rotateWebhook(publicId, token);
      if (isStale(gen, targetWorkflowId, targetGetToken) || !rotated) return;
      setView((prev) =>
        isStale(gen, targetWorkflowId, targetGetToken)
          ? prev
          : {
              generation: gen,
              endpoints: prev.generation === gen ? prev.endpoints : [],
              revealed: { publicId, secret: rotated.secret },
              error: prev.generation === gen ? prev.error : null,
              busy: prev.generation === gen ? prev.busy : false,
            },
      );
      await reloadForContext(token, gen, targetWorkflowId, targetGetToken);
    });
  };

  const revoke = (publicId: string) => {
    if (busy || contextRef.current.pendingOps > 0 || isStale(currentGen, workflowId, getToken)) return;
    const belongsToActiveContext = endpoints.some(
      (e) => e.publicId === publicId && e.workflowId === workflowId && e.status === 'ACTIVE',
    );
    if (!belongsToActiveContext) return;
    void run(async (token, gen, targetWorkflowId, targetGetToken) => {
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      await ApiClient.revokeWebhook(publicId, token);
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      setView((prev) =>
        isStale(gen, targetWorkflowId, targetGetToken)
          ? prev
          : {
              generation: gen,
              endpoints: prev.generation === gen ? prev.endpoints : [],
              revealed:
                prev.generation === gen && prev.revealed?.publicId !== publicId
                  ? prev.revealed
                  : null,
              error: prev.generation === gen ? prev.error : null,
              busy: prev.generation === gen ? prev.busy : false,
            },
      );
      await reloadForContext(token, gen, targetWorkflowId, targetGetToken);
    });
  };

  const dismissRevealed = () => {
    setView((prev) => (prev.generation === currentGen ? { ...prev, revealed: null } : prev));
  };

  return (
    <details className="border-b border-slate-200 bg-white px-4 sm:px-6 py-2 text-xs text-slate-700 shrink-0">
      <summary className="cursor-pointer font-semibold text-slate-800">
        Webhooks ({endpoints.filter((e) => e.status === 'ACTIVE').length} ativos)
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-slate-500">
          Envie POST com JSON e o cabeçalho{' '}
          <code>X-FlowMind-Signature: t=&lt;segundos&gt;,v1=&lt;HMAC-SHA256&gt;</code>. Disparos rodam em simulação.
        </p>
        {revealed && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
            <p className="font-semibold">Copie o segredo agora: ele não será mostrado de novo.</p>
            <code className="mt-1 block break-all select-all">{revealed.secret}</code>
            <button type="button" onClick={dismissRevealed} className="mt-1 underline">
              Já copiei
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <ul className="space-y-1">
          {endpoints.map((endpoint) => (
            <li key={endpoint.publicId} className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all [overflow-wrap:anywhere]">{webhookUrl(endpoint.publicId)}</code>
              <span className={endpoint.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-400'}>
                {endpoint.status === 'ACTIVE' ? 'Ativo' : 'Revogado'}
              </span>
              {endpoint.status === 'ACTIVE' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => rotate(endpoint.publicId)}
                    className="underline disabled:opacity-50"
                  >
                    Trocar segredo
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => revoke(endpoint.publicId)}
                    className="text-red-700 underline disabled:opacity-50"
                  >
                    Revogar
                  </button>
                </>
              )}
            </li>
          ))}
          {!endpoints.length && <li className="text-slate-500">Nenhum webhook criado.</li>}
        </ul>
        <button
          type="button"
          disabled={busy}
          onClick={create}
          className="px-3 py-1 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold disabled:opacity-50"
        >
          {busy ? 'Aguarde…' : 'Criar webhook'}
        </button>
      </div>
    </details>
  );
}
