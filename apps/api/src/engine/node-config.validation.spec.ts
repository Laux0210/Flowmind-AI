import { getNodeConfigIssues } from '@flowmind/contracts';
import type { NodeType } from '@flowmind/contracts';

describe('Inspeção pura de configurações e pendências', () => {
  it.each([
    ['trigger_form', {}],
    ['trigger_form', { requiredFields: ['message'] }],
    ['ai_analyze_intent', { message_text: 'Fixture de alias local' }],
    ['internal_record', { name: 'Fixture', message: 'Alias local' }],
    ['internal_record', { fieldMappings: { email: 'contato@example.test', ambiguities: ['Incerteza sintética'] } }],
    ['send_email', { to: 'contato@example.test', subject: '', bodyTemplate: 'Fixture\ncom quebra no corpo', replyTo: '' }],
    ['condition', {}],
    ['condition', { operator: ' GT ', leftOperand: 5, rightOperand: 3 }],
    ['condition', { operator: 'is_empty', leftOperand: [] }],
    ['condition', { operator: 'is_not_empty', leftOperand: { fixture: true } }],
    ['http_request', { url: 'https://endpoint.example.invalid' }],
    ['http_request', { url: '{{form.message_text}}', method: 'post', headers: { 'Content-Type': 'application/json' } }],
  ] as Array<[NodeType, unknown]>)('preserva config/default/alias já aceito de %s', (type, config) => {
    expect(getNodeConfigIssues(type, config)).toEqual([]);
  });

  it('relata parâmetro ausente sem inventar valor ou escolher destino', () => {
    const config = Object.freeze({});
    expect(getNodeConfigIssues('http_request', config)).toEqual([{ field: 'url', code: 'MISSING_REQUIRED_FIELD' }]);
    expect(config).toEqual({});
  });

  it('não altera config nem normaliza o valor enviado pelo usuário', () => {
    const headers = Object.freeze({ 'Content-Type': 'application/json' });
    const config = Object.freeze({ url: 'https://endpoint.example.invalid', method: 'post', headers });
    expect(getNodeConfigIssues('http_request', config)).toEqual([]);
    expect(config.method).toBe('post');
    expect(config.headers).toBe(headers);
  });

  it.each([
    null, [], JSON.parse('{"__proto__":{"private-fixture":"value"}}'),
    { operator: 'equals', leftOperand: Infinity },
    { operator: 'equals', leftOperand: () => 'private-fixture' },
    { operator: 'equals', leftOperand: new Date() },
  ])('nega configuração não declarativa/finita %j', (config) => {
    expect(getNodeConfigIssues('condition', config)).toEqual([{ field: 'config', code: 'INVALID_CONFIG' }]);
  });

  it('detecta ciclo sem recursão ou travamento', () => {
    const config: Record<string, unknown> = { operator: 'equals' }; config.leftOperand = config;
    expect(getNodeConfigIssues('condition', config)).toEqual([{ field: 'config', code: 'INVALID_CONFIG' }]);
  });

  it('permite referências compartilhadas acíclicas no chamador local', () => {
    const operand = { fixture: 'value' };
    expect(getNodeConfigIssues('condition', { operator: 'equals', leftOperand: operand, rightOperand: operand })).toEqual([]);
  });

  it('não divulga chave desconhecida ou valor privado nos problemas', () => {
    const issues = getNodeConfigIssues('internal_record', { name: 'Fixture', 'private-fixture': 'private-value' });
    expect(issues).toContainEqual({ field: 'config', code: 'UNKNOWN_FIELD' });
    expect(JSON.stringify(issues)).not.toMatch(/private-fixture|private-value/);
  });
});
