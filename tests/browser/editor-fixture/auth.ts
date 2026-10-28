// Identidade exclusivamente sintética para a página isolada de teste.
// Este módulo não entra na aplicação Next.js nem muda sua autenticação.
const getToken = async () => 'synthetic-editor-fixture';
export const useAuth = () => ({ getToken, orgId: 'org_synthetic', orgRole: 'org:admin', isLoaded: true });
