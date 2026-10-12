/**
 * FlowMind AI — Tipos de Autenticação e Contexto de Organização
 */

export interface AuthContext {
  userId: string;
  orgId: string;
  orgRole?: string;
  sessionId: string;
}

