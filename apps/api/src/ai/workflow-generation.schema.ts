import { WORKFLOW_NODE_TYPES } from '@flowmind/contracts';

/**
 * Esquema JSON estrito para OpenAI Structured Outputs (strict: true).
 * Em conformidade com a especificação oficial da OpenAI e os contratos do FlowMind AI.
 */
export const WORKFLOW_GENERATION_JSON_SCHEMA = {
  name: 'workflow_proposal',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      workflow: {
        type: 'object',
        properties: {
          schemaVersion: {
            type: 'string',
            enum: ['1.0.0'],
          },
          name: {
            type: 'string',
            description: 'Nome conciso e profissional para a automação',
          },
          description: {
            type: 'string',
            description: 'Descrição clara da jornada coberta pela automação',
          },
          triggerNodeId: {
            type: 'string',
            description: 'Identificador do nó de gatilho inicial',
          },
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: {
                  type: 'string',
                  enum: WORKFLOW_NODE_TYPES,
                },
                label: { type: 'string' },
                position: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                  },
                  required: ['x', 'y'],
                  additionalProperties: false,
                },
                config: {
                  type: 'string',
                  description:
                    'JSON serializado contendo as configurações declarativas do nó, sem pontuação comercial',
                },
              },
              required: ['id', 'type', 'label', 'position', 'config'],
              additionalProperties: false,
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                sourceNodeId: { type: 'string' },
                targetNodeId: { type: 'string' },
                sourceHandle: { type: ['string', 'null'] },
                targetHandle: { type: ['string', 'null'] },
              },
              required: [
                'id',
                'sourceNodeId',
                'targetNodeId',
                'sourceHandle',
                'targetHandle',
              ],
              additionalProperties: false,
            },
          },
        },
        required: [
          'schemaVersion',
          'name',
          'description',
          'triggerNodeId',
          'nodes',
          'edges',
        ],
        additionalProperties: false,
      },
      reasoning: {
        type: 'string',
        description: 'Justificativa da arquitetura e etapas propostas',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Pendências ou configurações a serem revisadas pelo operador humano',
      },
    },
    required: ['workflow', 'reasoning', 'warnings'],
    additionalProperties: false,
  },
} as const;
