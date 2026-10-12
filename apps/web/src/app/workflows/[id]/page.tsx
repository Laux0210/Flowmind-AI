'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  WorkflowDefinition,
  SimulateWorkflowResponse,
  GenerateWorkflowResponse,
} from '@flowmind/contracts';
import { ApiClient } from '@/lib/api-client';

import {
  ArrowLeft,
  Play,
  Save,
  Sparkles,
  Mail,
  Database,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Layers,
  Bot,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  PowerOff,
} from 'lucide-react';

export default function WorkflowEditorPage() {
  const { getToken, orgId, orgRole, isLoaded } = useAuth();
  const isAdmin = orgRole === 'org:admin';
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const workflowId = params?.id as string;
  const activeContext = useRef({ workflowId, orgId, revision: 0, saving: false, simulating: false });
  if (activeContext.current.workflowId !== workflowId || activeContext.current.orgId !== orgId) {
    activeContext.current = { workflowId, orgId, revision: 0, saving: false, simulating: false };
  }

  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResults, setSimResults] = useState<SimulateWorkflowResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Estados do Assistente e Gerador de IA (T10)
  const [showAiBar, setShowAiBar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<GenerateWorkflowResponse | null>(null);

  // Campos sintéticos da simulação
  const [contactName, setContactName] = useState('Pessoa Sintética');
  const [contactEmail, setContactEmail] = useState('pessoa@example.test');
  const [messageText, setMessageText] = useState(
    'Olá! Gostaria de receber uma proposta de orçamento para contratar seus serviços de IA.',
  );


  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setWorkflow(null);
    setSimResults(null);
    setAiResponse(null);
    setIsDirty(false);
    setIsSaving(false);
    setSimLoading(false);
    setAiLoading(false);
    setLoading(true);
    setError(null);
    if (!orgId) {
      setError('Entre e selecione uma organização para acessar esta automação.');
      setLoading(false);
      return;
    }
    async function fetchWorkflow() {
      try {
        const wf = await ApiClient.getWorkflow(workflowId, await getToken());
        if (cancelled) return;
        setWorkflow(wf);
        if (searchParams?.get('simulate') === 'true') {
          setIsSimulating(true);
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar esta automação.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchWorkflow();
    return () => { cancelled = true; };
  }, [workflowId, searchParams, isLoaded, orgId, getToken]);

  useEffect(() => {
    if (!isSimulating) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSimulating(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSimulating]);

  // Conversão de nós e arestas para formato do XYFlow
  const flowNodes: Node[] = useMemo(() => {
    if (!workflow?.nodes) return [];
    return workflow.nodes.map((n) => {
      let icon = <FileText className="w-4 h-4 text-indigo-600" />;
      if (n.type === 'ai_analyze_intent') icon = <Sparkles className="w-4 h-4 text-violet-600" />;
      if (n.type === 'internal_record') icon = <Database className="w-4 h-4 text-emerald-600" />;
      if (n.type === 'send_email') icon = <Mail className="w-4 h-4 text-blue-600" />;

      return {
        id: n.id,
        position: n.position || { x: 100, y: 100 },
        data: {
          label: (
            <div className="flex items-center space-x-2 p-1">
              {icon}
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">{n.label}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{n.type}</p>
              </div>
            </div>
          ),
        },
        style: {
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '10px 14px',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
          minWidth: '220px',
        },
      };
    });
  }, [workflow]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!workflow?.edges) return [];
    return workflow.edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
      },
    }));
  }, [workflow]);

  const handleRunSimulation = async () => {
    const context = activeContext.current;
    if (!workflow || isDirty || context.saving) {
      alert('Salve a proposta antes de simular a definição exibida.');
      return;
    }
    if (context.simulating) return;
    const revision = context.revision;
    context.simulating = true;
    setSimLoading(true);
    setSimResults(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || context.revision !== revision) return;
      const response = await ApiClient.simulateWorkflow(workflowId, {
        name: contactName,
        email: contactEmail,
        message: messageText,
      }, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      setSimResults(response);
    } catch {
      if (activeContext.current === context && context.revision === revision) alert('Falha ao processar simulação.');
    } finally {
      context.simulating = false;
      if (activeContext.current === context) setSimLoading(false);
    }
  };

  const fillCaseC01 = () => {
    setContactName('Carlos Proposta');
    setContactEmail('carlos.empresa@example.test');
    setMessageText('Gostaria de contratar o serviço e solicitar uma proposta orçamentária comercial urgente.');
  };

  const fillCaseC02 = () => {
    setContactName('Mariana Dúvidas');
    setContactEmail('mariana.contato@example.test');
    setMessageText('Tenho algumas dúvidas gerais sobre a plataforma e não sei se temos interesse imediato.');
  };

  const handleGenerateAiProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const context = activeContext.current;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context) return;
      const response = await ApiClient.generateWorkflow({ prompt: aiPrompt }, token);
      if (activeContext.current !== context) return;
      setAiResponse(response);
    } catch {
      if (activeContext.current === context) alert('Falha ao processar solicitação de IA.');
    } finally {
      if (activeContext.current === context) setAiLoading(false);
    }
  };

  const handleApplyAiProposal = () => {
    if (!aiResponse || !workflow || activeContext.current.saving) return;
    activeContext.current.revision++;

    setWorkflow({
      ...workflow,
      nodes: aiResponse.workflow.nodes,
      edges: aiResponse.workflow.edges,
      triggerNodeId: aiResponse.workflow.triggerNodeId,
      status: 'DRAFT',
    });

    setAiResponse(null);
    setIsDirty(true);
    setSimResults(null);
    setShowAiBar(false);
    setAiPrompt('');
  };

  const handleDiscardAiProposal = () => {
    setAiResponse(null);
  };

  const handleSave = async () => {
    const context = activeContext.current;
    if (!workflow || context.saving) return;
    const revision = context.revision;
    context.saving = true;
    setIsSaving(true);
    try {
      const token = await getToken();
      if (activeContext.current !== context) return;
      const saved = await ApiClient.updateWorkflow(workflow.id, {
        name: workflow.name, description: workflow.description,
        triggerNodeId: workflow.triggerNodeId, nodes: workflow.nodes, edges: workflow.edges,
      }, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      context.revision++;
      setWorkflow(saved);
      setIsDirty(false);
      setSimResults(null);
      alert('Rascunho salvo.');
    } catch {
      if (activeContext.current === context) alert('Não foi possível salvar o rascunho.');
    } finally {
      context.saving = false;
      if (activeContext.current === context) setIsSaving(false);
    }
  };

  const handleReviewWorkflow = async () => {
    const context = activeContext.current;
    if (!workflow || isDirty) {
      alert('Salve as alterações pendentes antes de submeter a automação para revisão.');
      return;
    }
    setIsReviewing(true);
    try {
      const token = await getToken();
      const res = await ApiClient.reviewWorkflow(workflow.id, token);
      if (activeContext.current !== context) return;
      setWorkflow(res.workflow);
      alert('Automação revisada com sucesso! Pronta para ativação por um administrador.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao submeter automação para revisão.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleActivateWorkflow = async () => {
    const context = activeContext.current;
    if (!workflow || isDirty) {
      alert('Salve as alterações antes de ativar a automação.');
      return;
    }
    setIsPublishing(true);
    try {
      const token = await getToken();
      const res = await ApiClient.activateWorkflow(workflow.id, token);
      if (activeContext.current !== context) return;
      setWorkflow(res.workflow);
      alert(`Automação ativada com sucesso! Snapshot da versão ${res.versionSnapshot.version} gerado.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao ativar automação.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeactivateWorkflow = async () => {
    const context = activeContext.current;
    if (!workflow) return;
    if (!confirm('Deseja realmente desativar esta automação? Ela retornará ao estado de rascunho com nova versão.')) return;
    setIsDeactivating(true);
    try {
      const token = await getToken();
      const res = await ApiClient.deactivateWorkflow(workflow.id, token);
      if (activeContext.current !== context) return;
      setWorkflow(res.workflow);
      alert('Automação desativada com sucesso. Novo rascunho criado.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao desativar automação.');
    } finally {
      setIsDeactivating(false);
    }
  };

  if (loading) {

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return <main className="p-6"><p role="alert">{error ?? 'Automação indisponível.'}</p><Link href="/dashboard">Voltar ao dashboard</Link></main>;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Barra de Topo do Editor */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Voltar para Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900">{workflow?.name}</h1>
              {workflow?.status === 'PUBLISHED' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Ativo (v{workflow?.version})
                </span>
              )}
              {workflow?.status === 'REVIEWED' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Revisado (v{workflow?.version})
                </span>
              )}
              {workflow?.status === 'DRAFT' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Rascunho (v{workflow?.version})
                </span>
              )}
              {workflow?.status === 'ARCHIVED' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                  Arquivado
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Grafo Acíclico Dirigido (DAG) • Papel: {isAdmin ? 'Administrador (org:admin)' : 'Membro (org:member)'}
              {workflow?.reviewedBy && (
                <span> • Revisado por {workflow.reviewedBy}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAiBar(!showAiBar)}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span>Assistente IA</span>
          </button>

          <button
            onClick={() => setIsSimulating(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simular Fluxo</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Salvando…' : 'Salvar'}</span>
          </button>

          {/* Botões de Ação de Ciclo de Vida (T03 / T08) */}
          {workflow?.status === 'DRAFT' && (
            <button
              onClick={handleReviewWorkflow}
              disabled={isReviewing || isDirty || !isAdmin}
              title={
                !isAdmin
                  ? 'Apenas administradores da organização podem revisar formalmente automações'
                  : isDirty
                  ? 'Salve as alterações antes de submeter a automação para revisão'
                  : 'Revisar formalmente automação'
              }
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isReviewing ? 'Revisando…' : 'Revisar (Admin)'}</span>
            </button>
          )}

          {workflow?.status === 'REVIEWED' && (
            <button
              onClick={handleActivateWorkflow}
              disabled={isPublishing || !isAdmin}
              title={isAdmin ? 'Publicar e ativar automação' : 'Apenas administradores da organização podem ativar automações'}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Ativando…' : 'Ativar (Admin)'}</span>
            </button>
          )}

          {workflow?.status === 'PUBLISHED' && (
            <button
              onClick={handleDeactivateWorkflow}
              disabled={isDeactivating || !isAdmin}
              title={isAdmin ? 'Desativar automação e gerar novo rascunho' : 'Apenas administradores da organização podem desativar automações'}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>{isDeactivating ? 'Desativando…' : 'Desativar'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Barra do Copilot de IA Retrátil (T10) */}
      {showAiBar && (
        <div className="bg-slate-900 text-white px-6 py-4 border-b border-slate-800 z-20 shrink-0 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold tracking-tight">Gerador e Assistente de Workflow por Linguagem Natural</h3>
              </div>
              <span className="text-[10px] bg-violet-950 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full font-mono">
                Catálogo MVP Fechado
              </span>
            </div>

            <form onSubmit={handleGenerateAiProposal} className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex: Receba contato, resuma intenção e ambiguidades e responda por e-mail."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gerar Proposta</span>
                  </>
                )}
              </button>
            </form>

            {/* Detalhes da Proposta Gerada pela IA */}
            {aiResponse && (
              <div className="mt-3 p-3 bg-slate-800/80 border border-violet-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-violet-300">Proposta Gerada:</span>
                    <span className="text-xs text-slate-200">{aiResponse.workflow.name}</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                      Requer Revisão Humana
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{aiResponse.reasoning}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Nós: {aiResponse.workflow.nodes.length} • Modelo: {aiResponse.modelUsed} • Consumo: {aiResponse.tokensConsumed} tokens
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDiscardAiProposal}
                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyAiProposal}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-violet-400 hover:bg-violet-300 rounded-lg transition shadow-sm"
                  >
                    Aplicar no Canvas para Revisão
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Área Central: Canvas XYFlow + Painel Sincronizado */}
      <div className="flex-1 flex relative overflow-hidden">

        {/* Canvas de Grafo */}
        <div className="flex-1 h-full relative">
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background gap={16} size={1} color="#cbd5e1" />
            <Controls />
          </ReactFlow>
        </div>

        {/* Painel Lateral: Lista Sincronizada de Etapas (Acessibilidade UX_FLOWS.md) */}
        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Etapas da Jornada</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">{workflow?.nodes.length} nós</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {workflow?.nodes.map((node, idx) => (
              <div
                key={node.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">Passo {idx + 1}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{node.id}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800">{node.label}</h4>
                <p className="text-[11px] text-slate-500 mt-1">Tipo: <span className="font-mono text-slate-600">{node.type}</span></p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Drawer / Modal de Simulação com Dados Sintéticos */}
      {isSimulating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-drawer-title"
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
        >
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <Play className="w-4 h-4 text-indigo-600 fill-current" />
              <h3 id="sim-drawer-title" className="text-sm font-bold text-slate-900">Simulador Sintético de Workflows</h3>
            </div>
            <button
              onClick={() => setIsSimulating(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
              aria-label="Fechar Simulação"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Casos Rápidos */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-indigo-900 mb-2">Fichas Sintéticas Rápidas:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fillCaseC01}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-[11px] font-semibold text-indigo-700 rounded border border-indigo-200 shadow-xs transition"
                >
                  Caso C01 (Solicitação de Proposta)
                </button>
                <button
                  type="button"
                  onClick={fillCaseC02}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-[11px] font-semibold text-indigo-700 rounded border border-indigo-200 shadow-xs transition"
                >
                  Caso C02 (Dúvidas Gerais)
                </button>
              </div>
            </div>

            {/* Formulário Sintético */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Contato</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail do Contato</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mensagem Enviada</label>
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simLoading}
                className="w-full inline-flex items-center justify-center space-x-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {simLoading ? (
                  <span>Processando DAG...</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Executar Simulação</span>
                  </>
                )}
              </button>
            </div>

            {/* Resultados da Simulação */}
            {simResults && (
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900">Resultado do Motor:</h4>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {simResults.status} ({simResults.totalDurationMs}ms)
                  </span>
                </div>

                <div className="space-y-2.5">
                  {simResults.nodeResults.map((r, i) => (
                    <div
                      key={r.nodeId}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{r.nodeId}</span>
                        <span className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{r.status}</span>
                        </span>
                      </div>

                      {/* Exibição amigável dos outputs */}
                      {typeof r.outputs?.intent === 'string' && (
                        <p className="text-[11px] text-slate-600">
                          Intenção: <strong className="text-indigo-600">{r.outputs.intent}</strong>
                        </p>
                      )}
                      {Boolean(Array.isArray(r.outputs?.ambiguities) && r.outputs.ambiguities.length > 0) && (
                        <p className="text-[11px] text-amber-700">Ambiguidades: {(r.outputs?.ambiguities as string[]).map(String).join('; ')}</p>
                      )}
                      {Boolean(r.outputs?.summary) && (
                        <p className="text-[11px] text-slate-500 italic">
                          Resumo: &quot;{String(r.outputs?.summary)}&quot;
                        </p>
                      )}
                      {Boolean(r.outputs?.delivery_status) && (
                        <p className="text-[11px] text-blue-600">
                          E-mail simulado: <strong>{String(r.outputs?.delivery_status)}</strong> para {String(r.outputs?.recipient)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
