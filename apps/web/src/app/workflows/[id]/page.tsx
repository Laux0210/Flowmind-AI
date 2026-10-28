'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
} from '@xyflow/react';
import type { NodeChange, Connection, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  WorkflowDefinition,
  SimulateWorkflowResponse,
  GenerateWorkflowResponse,
  NodeType,
  NodePosition,
} from '@flowmind/contracts';
import { ApiClient, AiGenerationRequestError } from '@/lib/api-client';
import { ProposalWarnings } from '@/components/workflows/proposal-warnings';
import { WebhookPanel } from '@/components/workflows/webhook-panel';
import { SchedulePanel } from '@/components/workflows/schedule-panel';
import { NodeParameterEditor } from '@/components/workflows/node-parameter-editor';
import { useResourceCatalog } from '@/lib/use-resource-catalog';
import { WorkflowGraphNode } from '@/components/workflows/workflow-graph-node';
import type { WorkflowFlowNode } from '@/components/workflows/workflow-graph-node';
import {
  editNodeParameters,
  moveWorkflowNodes,
  connectWorkflowNodes,
  removeWorkflowConnection,
  addWorkflowNode,
  changeWorkflowTrigger,
  removeWorkflowNode,
} from '@/lib/workflow-editing';

const nodeTypes = { workflowStep: WorkflowGraphNode };

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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const workflowId = params?.id as string;
  const activeContext = useRef({
    workflowId,
    orgId,
    revision: 0,
    saving: false,
    simulating: false,
    reviewing: false,
    publishing: false,
    deactivating: false,
    generatingAi: false,
    parameterEditing: false,
    dirty: false,
  });
  if (activeContext.current.workflowId !== workflowId || activeContext.current.orgId !== orgId) {
    activeContext.current = {
      workflowId,
      orgId,
      revision: 0,
      saving: false,
      simulating: false,
      reviewing: false,
      publishing: false,
      deactivating: false,
      generatingAi: false,
      parameterEditing: false,
      dirty: false,
    };
  }

  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const editingContext = activeContext.current;
  const resourceCatalog = useResourceCatalog(isLoaded && orgId ? editingContext : null, getToken);
  const draftView = useRef({ workflow, context: editingContext });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hasPendingConfig, setHasPendingConfig] = useState(false);
  const [connectionSource, setConnectionSource] = useState('');
  const [connectionTarget, setConnectionTarget] = useState('');
  const [connectionHandle, setConnectionHandle] = useState('');
  const [newNodeType, setNewNodeType] = useState<NodeType>('ai_analyze_intent');
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
  const [scheduledAt, setScheduledAt] = useState(() => new Date().toISOString());
  const isScheduleWorkflow = workflow?.nodes.some(node => node.id === workflow.triggerNodeId && node.type === 'trigger_schedule') ?? false;
  const [contactName, setContactName] = useState('Pessoa Sintética');
  const [contactEmail, setContactEmail] = useState('pessoa@example.test');
  const [messageText, setMessageText] = useState(
    'Olá! Gostaria de receber uma proposta de orçamento para contratar seus serviços de IA.',
  );


  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const loadContext = activeContext.current;
    draftView.current = { workflow: null, context: loadContext };
    setWorkflow(null);
    setSelectedNodeId(null);
    setHasPendingConfig(false);
    setConnectionSource(''); setConnectionTarget(''); setConnectionHandle('');
    activeContext.current.parameterEditing = false;
    activeContext.current.dirty = false;
    setSimResults(null);
    setAiResponse(null);
    setIsDirty(false);
    setIsSaving(false);
    setIsReviewing(false);
    setIsPublishing(false);
    setIsDeactivating(false);
    setFeedback(null);
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
        if (cancelled || activeContext.current !== loadContext) return;
        draftView.current = { workflow: wf, context: loadContext };
        setWorkflow(wf);
        if (searchParams?.get('simulate') === 'true') {
          setIsSimulating(true);
        }
      } catch {
        if (!cancelled && activeContext.current === loadContext) setError('Não foi possível carregar esta automação.');
      } finally {
        if (!cancelled && activeContext.current === loadContext) setLoading(false);
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
  const flowNodes: WorkflowFlowNode[] = useMemo(() => {
    if (!workflow?.nodes) return [];
    return workflow.nodes.map((n) => {
      const outgoing = workflow.edges.filter((edge) => edge.sourceNodeId === n.id);
      const incoming = workflow.edges.filter((edge) => edge.targetNodeId === n.id);
      return {
        id: n.id,
        type: 'workflowStep',
        selected: n.id === selectedNodeId,
        position: n.position || { x: 100, y: 100 },
        data: {
          label: n.label, nodeType: n.type,
          sourceHandles: [...new Set(n.type === 'condition' ? ['true', 'false', ...outgoing.map((edge) => edge.sourceHandle)] : [undefined, ...outgoing.map((edge) => edge.sourceHandle)])],
          targetHandles: n.type.startsWith('trigger_') && incoming.length === 0 ? [] : [...new Set([undefined, ...incoming.map((edge) => edge.targetHandle)])],
        },
      };
    });
  }, [workflow, selectedNodeId]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!workflow?.edges) return [];
    return workflow.edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
      },
    }));
  }, [workflow]);

  const isAnyActionRunning =
    isSaving || isReviewing || isPublishing || isDeactivating || simLoading || aiLoading;
  const snapshotMatchesContext = !!workflow && workflow.orgId === orgId && workflow.id === workflowId &&
    draftView.current.context === editingContext && draftView.current.workflow === workflow;
  const canEditGraph = snapshotMatchesContext && workflow?.status === 'DRAFT' && !isAnyActionRunning && !hasPendingConfig;
  const selectedNode = workflow?.nodes.find((node) => node.id === selectedNodeId);

  const commitWorkflowEdit = (edit: (current: WorkflowDefinition) => WorkflowDefinition, allowParameterDraft = false): boolean => {
    const context = activeContext.current, view = draftView.current, current = view.workflow;
    if (context !== editingContext || view.context !== context || !current || current.orgId !== orgId || current.id !== workflowId ||
      current.status !== 'DRAFT' || isAnyActionRunning || context.saving || context.reviewing || context.publishing ||
      context.deactivating || context.simulating || context.generatingAi || (context.parameterEditing && !allowParameterDraft)) return false;
    try {
      const next = edit(current);
      if (next === current) return true;
      draftView.current = { workflow: next, context };
      context.revision++;
      context.dirty = true;
      setWorkflow(next); setIsDirty(true); setSimResults(null); setAiResponse(null); setFeedback(null);
      return true;
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Não foi possível aplicar a edição.' });
      return false;
    }
  };

  const handleEditNode = (id: string, label: string, fields: Record<string, string>, position: NodePosition) =>
    commitWorkflowEdit((current) => moveWorkflowNodes(editNodeParameters(current, id, label, fields), [{ id, position }]), true);

  const handleSelectNode = (id: string) => {
    if (activeContext.current !== editingContext) return;
    if (activeContext.current.parameterEditing) {
      setFeedback({ type: 'error', message: 'Aplique ou descarte as alterações da etapa antes de selecionar outra.' }); return;
    }
    setSelectedNodeId(id);
  };

  const handleParameterPending = useCallback((pending: boolean) => {
    if (activeContext.current !== editingContext || draftView.current.context !== editingContext) return;
    editingContext.parameterEditing = pending;
    setHasPendingConfig(pending);
  }, [editingContext]);

  const handleNodesChange = (changes: NodeChange<WorkflowFlowNode>[]) => {
    for (const change of changes) if (change.type === 'select' && change.selected) handleSelectNode(change.id);
    const positions = changes.flatMap((change) => change.type === 'position' && change.position ? [{ id: change.id, position: change.position }] : []);
    if (positions.length) commitWorkflowEdit((current) => moveWorkflowNodes(current, positions));
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    commitWorkflowEdit((current) => connectWorkflowNodes(current, connection.source, connection.target,
      connection.sourceHandle ?? undefined, `edge_${crypto.randomUUID()}`, connection.targetHandle ?? undefined));
  };

  const handleRemoveConnection = (id: string) => commitWorkflowEdit((current) => removeWorkflowConnection(current, id));

  const handleAddNode = (type: NodeType) => {
    commitWorkflowEdit((current) => {
      const next = addWorkflowNode(current, type);
      const newlyAdded = next.nodes.at(-1);
      if (newlyAdded) setSelectedNodeId(newlyAdded.id);
      return next;
    });
  };

  const handleRemoveNode = (id: string) => {
    commitWorkflowEdit((current) => {
      const next = removeWorkflowNode(current, id);
      if (selectedNodeId === id) setSelectedNodeId(null);
      return next;
    });
  };

  const handleRunSimulation = async () => {
    const context = activeContext.current;
    if (context.parameterEditing) { setFeedback({ type: 'error', message: 'Aplique ou descarte os parâmetros antes de simular.' }); return; }
    if (!workflow || isDirty || context.dirty || context.saving || context.reviewing || context.publishing || context.deactivating) {
      setFeedback({ type: 'error', message: 'Salve a proposta antes de simular a definição exibida.' });
      return;
    }
    if (context.simulating) return;
    const revision = context.revision;
    context.simulating = true;
    setSimLoading(true);
    setSimResults(null);
    setFeedback(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || context.revision !== revision) return;
      const response = await ApiClient.simulateWorkflow(workflowId, workflow?.nodes.some(node => node.id === workflow.triggerNodeId && node.type === 'trigger_schedule')
        ? { scheduledAt } : { name: contactName, email: contactEmail, message: messageText }, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      setSimResults(response);
      const failedNode = response.nodeResults.find((node) => node.status === 'FAILED');
      setFeedback(response.status === 'COMPLETED'
        ? { type: 'success', message: 'Simulação concluída com sucesso.' }
        : { type: 'error', message: failedNode?.error?.message ?? 'Simulação terminou com falha. Consulte o resultado de cada nó.' });
    } catch (err: unknown) {
      if (activeContext.current === context && context.revision === revision) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha ao processar simulação.',
        });
      }
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
    if (context.generatingAi || isAnyActionRunning) return;
    context.generatingAi = true;
    setAiLoading(true);
    setAiResponse(null);
    setFeedback(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context) return;
      const response = await ApiClient.generateWorkflow({ prompt: aiPrompt }, token);
      if (activeContext.current !== context) return;
      setAiResponse(response);
    } catch (err: unknown) {
      if (activeContext.current === context) {
        const usageMessage = err instanceof AiGenerationRequestError
          ? err.tokensConsumed === null ? ' Consumo não informado.' : ` Consumo declarado: ${err.tokensConsumed} tokens.`
          : '';
        setFeedback({
          type: 'error',
          message: (err instanceof Error || err instanceof AiGenerationRequestError
            ? err.message : 'Falha ao processar solicitação de IA.') + usageMessage,
        });
      }
    } finally {
      context.generatingAi = false;
      if (activeContext.current === context) setAiLoading(false);
    }
  };

  const handleApplyAiProposal = () => {
    const context = activeContext.current;
    if (context.parameterEditing) { setFeedback({ type: 'error', message: 'Aplique ou descarte os parâmetros antes de aplicar outra proposta.' }); return; }
    if (!aiResponse || !workflow || context.saving || context.reviewing || context.publishing ||
      context.deactivating || context.simulating || context.generatingAi) return;
    if (workflow.status !== 'DRAFT') {
      setFeedback({
        type: 'error',
        message: 'Apenas workflows em rascunho (DRAFT) podem receber propostas da IA. Desative a automação para criar um novo rascunho.',
      });
      return;
    }
    activeContext.current.revision++;

    const proposed = {
      ...workflow,
      nodes: aiResponse.workflow.nodes,
      edges: aiResponse.workflow.edges,
      triggerNodeId: aiResponse.workflow.triggerNodeId,
      status: 'DRAFT' as const,
    };
    draftView.current = { workflow: proposed, context };
    context.dirty = true;
    setWorkflow(proposed);

    setAiResponse(null);
    setIsDirty(true);
    setSimResults(null);
    setShowAiBar(false);
    setAiPrompt('');
    setFeedback({
      type: 'success',
      message: 'Proposta aplicada no canvas. Revise e salve o rascunho.',
    });
  };

  const handleDiscardAiProposal = () => {
    setAiResponse(null);
  };

  const handleSave = async () => {
    const context = activeContext.current;
    if (context.parameterEditing) { setFeedback({ type: 'error', message: 'Aplique ou descarte as alterações da etapa antes de salvar.' }); return; }
    const current = draftView.current.workflow;
    if (context !== editingContext || draftView.current.context !== context || !current || context.saving || context.reviewing || context.publishing || context.deactivating) return;
    if (current.status !== 'DRAFT') {
      setFeedback({
        type: 'error',
        message: 'Apenas workflows em rascunho (DRAFT) podem ser alterados diretamente. Desative o fluxo para editar uma nova versão.',
      });
      return;
    }
    const revision = context.revision;
    context.saving = true;
    setIsSaving(true);
    setFeedback(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || context.revision !== revision) return;
      const saved = await ApiClient.updateWorkflow(current.id, {
        name: current.name, description: current.description,
        triggerNodeId: current.triggerNodeId, nodes: current.nodes, edges: current.edges,
      }, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      context.revision++;
      context.dirty = false;
      draftView.current = { workflow: saved, context };
      setWorkflow(saved);
      setIsDirty(false);
      setSimResults(null);
      setFeedback({ type: 'success', message: 'Rascunho salvo com sucesso.' });
    } catch (err: unknown) {
      if (activeContext.current === context && context.revision === revision) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Não foi possível salvar o rascunho.',
        });
      }
    } finally {
      context.saving = false;
      if (activeContext.current === context) setIsSaving(false);
    }
  };

  const handleReviewWorkflow = async () => {
    const context = activeContext.current;
    if (context.parameterEditing) { setFeedback({ type: 'error', message: 'Aplique ou descarte os parâmetros antes de revisar.' }); return; }
    if (!workflow || isDirty || context.dirty || context.saving || context.reviewing || context.publishing || context.deactivating) {
      if (isDirty || context.dirty) {
        setFeedback({ type: 'error', message: 'Salve as alterações pendentes antes de submeter a automação para revisão.' });
      }
      return;
    }
    const revision = context.revision;
    context.reviewing = true;
    setIsReviewing(true);
    setFeedback(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || context.revision !== revision) return;
      const res = await ApiClient.reviewWorkflow(workflow.id, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      context.revision++;
      draftView.current = { workflow: res.workflow, context };
      setWorkflow(res.workflow);
      setFeedback({ type: 'success', message: 'Automação revisada com sucesso! Pronta para ativação por um administrador.' });
    } catch (err: unknown) {
      if (activeContext.current === context && context.revision === revision) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha ao submeter automação para revisão.',
        });
      }
    } finally {
      context.reviewing = false;
      if (activeContext.current === context) setIsReviewing(false);
    }
  };

  const handleActivateWorkflow = async () => {
    const context = activeContext.current;
    if (context.parameterEditing) { setFeedback({ type: 'error', message: 'Aplique ou descarte os parâmetros antes de ativar.' }); return; }
    if (!workflow || isDirty || context.dirty || context.saving || context.reviewing || context.publishing || context.deactivating) {
      if (isDirty || context.dirty) {
        setFeedback({ type: 'error', message: 'Salve as alterações antes de ativar a automação.' });
      }
      return;
    }
    const revision = context.revision;
    context.publishing = true;
    setIsPublishing(true);
    setFeedback(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || context.revision !== revision) return;
      const res = await ApiClient.activateWorkflow(workflow.id, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      context.revision++;
      draftView.current = { workflow: res.workflow, context };
      setWorkflow(res.workflow);
      setFeedback({
        type: 'success',
        message: `Automação ativada com sucesso! Snapshot da versão ${res.versionSnapshot.version} gerado.`,
      });
    } catch (err: unknown) {
      if (activeContext.current === context && context.revision === revision) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha ao ativar automação.',
        });
      }
    } finally {
      context.publishing = false;
      if (activeContext.current === context) setIsPublishing(false);
    }
  };

  const handleDeactivateWorkflow = async () => {
    const context = activeContext.current;
    if (!workflow || context.saving || context.reviewing || context.publishing || context.deactivating) return;
    if (!confirm('Deseja realmente desativar esta automação? Ela retornará ao estado de rascunho com nova versão.')) return;
    const revision = context.revision;
    context.deactivating = true;
    setIsDeactivating(true);
    setFeedback(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || context.revision !== revision) return;
      const res = await ApiClient.deactivateWorkflow(workflow.id, token);
      if (activeContext.current !== context || context.revision !== revision) return;
      context.revision++;
      setWorkflow(res.workflow);
      setIsDirty(false);
      context.dirty = false;
      draftView.current = { workflow: res.workflow, context };
      setSimResults(null);
      setFeedback({ type: 'success', message: 'Automação desativada com sucesso. Novo rascunho criado.' });
    } catch (err: unknown) {
      if (activeContext.current === context && context.revision === revision) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha ao desativar automação.',
        });
      }
    } finally {
      context.deactivating = false;
      if (activeContext.current === context) setIsDeactivating(false);
    }
  };

  if (loading || (workflow && !snapshotMatchesContext)) {

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
      <header className="min-h-16 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col gap-3 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0 z-10 shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="shrink-0 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Voltar para Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words min-w-0 max-w-full text-base font-bold text-slate-900">{workflow?.name}</h1>
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

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-3">
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
            disabled={isAnyActionRunning || hasPendingConfig || workflow?.status !== 'DRAFT'}
            title={
              workflow?.status !== 'DRAFT'
                ? 'Apenas workflows em rascunho (DRAFT) podem ser alterados diretamente. Desative o fluxo para editar uma nova versão.'
                : 'Salvar rascunho'
            }
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Salvando…' : 'Salvar'}</span>
          </button>

          {/* Botões de Ação de Ciclo de Vida (T03 / T08) */}
          {workflow?.status === 'DRAFT' && (
            <button
              onClick={handleReviewWorkflow}
              disabled={isReviewing || isAnyActionRunning || isDirty || !isAdmin}
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
              disabled={isPublishing || isAnyActionRunning || !isAdmin}
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
              disabled={isDeactivating || isAnyActionRunning || !isAdmin}
              title={isAdmin ? 'Desativar automação e gerar novo rascunho' : 'Apenas administradores da organização podem desativar automações'}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>{isDeactivating ? 'Desativando…' : 'Desativar'}</span>
            </button>
          )}
        </div>
      </header>

      {workflow?.status === 'PUBLISHED' && isAdmin && (
        <WebhookPanel key={`webhook:${orgId ?? ''}:${workflow.id}`} workflowId={workflow.id} getToken={getToken} />
      )}
      {workflow?.status === 'PUBLISHED' && isAdmin && (
        <SchedulePanel key={`schedule:${orgId ?? ''}:${workflow.id}`} workflowId={workflow.id} getToken={getToken} />
      )}

      {/* Banner de Feedback Acessível (Status / Alerta) */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-semibold z-20 shrink-0 border-b ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded transition text-slate-500 hover:text-slate-800"
            aria-label="Fechar notificação"
          >
            ✕
          </button>
        </div>
      )}

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
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-violet-300">Proposta Gerada:</span>
                    <span className="break-words [overflow-wrap:anywhere] text-xs text-slate-200">{aiResponse.workflow.name}</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                      Requer Revisão Humana
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{aiResponse.reasoning}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Nós: {aiResponse.workflow.nodes.length} • Modelo: {aiResponse.modelUsed} • {aiResponse.tokensConsumed === null ? 'Consumo não informado' : `Consumo: ${aiResponse.tokensConsumed} tokens`}
                  </p>
                  <ProposalWarnings warnings={aiResponse.warnings} />
                </div>

                <div className="flex max-w-full flex-wrap items-center gap-2 shrink-0">
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
                    disabled={isAnyActionRunning || workflow?.status !== 'DRAFT'}
                    title={
                      workflow?.status !== 'DRAFT'
                        ? 'Apenas workflows em rascunho (DRAFT) podem receber propostas da IA. Desative o fluxo para criar um novo rascunho.'
                        : 'Aplicar no Canvas para Revisão'
                    }
                    className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-violet-400 hover:bg-violet-300 rounded-lg transition shadow-sm disabled:opacity-50"
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
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden min-h-0">

        {/* Canvas de Grafo */}
        <div className="flex-1 min-h-64 relative">
          <ReactFlow<WorkflowFlowNode> nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange} onNodeClick={(_event, node) => handleSelectNode(node.id)}
            onConnect={handleConnect} nodesDraggable={canEditGraph} nodesConnectable={canEditGraph}
            deleteKeyCode={null} fitView>
            <Background gap={16} size={1} color="#cbd5e1" />
            <Controls />
          </ReactFlow>
        </div>

        {/* Painel Lateral: Lista Sincronizada de Etapas (Acessibilidade UX_FLOWS.md) */}
        <aside aria-label="Edição da automação" className="w-full lg:w-96 max-h-[50vh] lg:max-h-none min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white flex flex-col shrink-0">
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
                className={`p-3 bg-slate-50 border rounded-xl hover:border-indigo-300 transition ${
                  node.id === selectedNodeId ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectNode(node.id)}
                    aria-pressed={node.id === selectedNodeId}
                    aria-controls="node-parameter-panel"
                    disabled={hasPendingConfig && node.id !== selectedNodeId}
                    className="text-left flex-1 focus-visible:outline-indigo-600 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">Passo {idx + 1}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{node.id}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">{node.label}</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tipo: <span className="font-mono text-slate-600">{node.type}</span>
                    </p>
                  </button>
                  {node.id !== workflow?.triggerNodeId && (
                    <button
                      type="button"
                      disabled={!canEditGraph}
                      onClick={() => {
                        if (confirm(`Deseja remover a etapa "${node.label}"? Conexões associadas serão removidas.`)) {
                          handleRemoveNode(node.id);
                        }
                      }}
                      aria-label={`Remover etapa ${node.label} (${node.id})`}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition focus-visible:outline-red-600 disabled:opacity-40"
                      title="Remover etapa"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <section aria-label="Gatilho principal" className="border-t border-slate-200 pt-4 space-y-2">
              <label htmlFor="workflow-trigger-type" className="block text-sm font-semibold text-slate-900">Gatilho principal</label>
              <select id="workflow-trigger-type" disabled={!canEditGraph} value={isScheduleWorkflow ? 'trigger_schedule' : 'trigger_form'}
                onChange={event => commitWorkflowEdit(current => changeWorkflowTrigger(current, event.target.value as 'trigger_form' | 'trigger_schedule'))}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs disabled:opacity-50">
                <option value="trigger_form">Formulário</option><option value="trigger_schedule">Agendamento</option>
              </select>
              <p className="text-xs text-slate-600">Ao trocar o gatilho, revise os campos usados pelas próximas etapas antes de publicar.</p>
            </section>
            <section aria-label="Adicionar etapa" className="border-t border-slate-200 pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Adicionar Etapa</h3>
              <div className="flex items-center space-x-2">
                <label htmlFor="new-node-type" className="sr-only">Tipo da nova etapa</label>
                <select
                  id="new-node-type"
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as NodeType)}
                  disabled={!canEditGraph}
                  className="flex-1 rounded-lg border border-slate-300 p-2 text-xs focus-visible:outline-indigo-600 disabled:opacity-50"
                >
                  <option value="ai_analyze_intent">Resumo e Intenção (IA)</option>
                  <option value="internal_record">Registro Interno</option>
                  <option value="send_email">Enviar E-mail</option>
                  <option value="condition">Condição</option>
                  <option value="http_request">Requisição HTTP</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleAddNode(newNodeType)}
                  disabled={!canEditGraph}
                  className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-indigo-600 disabled:opacity-40 shrink-0"
                >
                  Adicionar
                </button>
              </div>
            </section>

            <section id="node-parameter-panel" className="border-t border-slate-200 pt-4">
              {selectedNode ? <NodeParameterEditor key={`${orgId}:${workflowId}:${selectedNode.id}`} node={selectedNode}
                disabled={!snapshotMatchesContext || workflow?.status !== 'DRAFT' || isAnyActionRunning}
                catalog={resourceCatalog}
                onApply={handleEditNode} onPendingChange={handleParameterPending} />
                : <p className="text-xs text-slate-500">Selecione uma etapa para consultar ou editar seus parâmetros.</p>}
            </section>

            <section aria-label="Conexões entre etapas" className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Conexões</h3>
              <form aria-label="Adicionar conexão" onSubmit={(event) => {
                event.preventDefault();
                if (!canEditGraph) return;
                handleConnect({ source: connectionSource, target: connectionTarget, sourceHandle: connectionHandle || null, targetHandle: null });
              }}>
                <fieldset disabled={!canEditGraph} className="space-y-2 disabled:opacity-50">
                  <label htmlFor="connection-source" className="block text-xs font-medium text-slate-700">Etapa de origem</label>
                  <select id="connection-source" required value={connectionSource} onChange={(event) => {
                    const id = event.target.value; setConnectionSource(id);
                    setConnectionHandle(workflow?.nodes.find((node) => node.id === id)?.type === 'condition' ? 'true' : '');
                  }} className="w-full rounded-lg border border-slate-300 p-2 text-xs focus-visible:outline-indigo-600">
                    <option value="">Selecione</option>
                    {workflow?.nodes.map((node) => <option key={node.id} value={node.id}>{node.label} ({node.id})</option>)}
                  </select>
                  {workflow?.nodes.find((node) => node.id === connectionSource)?.type === 'condition' && <>
                    <label htmlFor="connection-branch" className="block text-xs font-medium text-slate-700">Resultado da condição</label>
                    <select id="connection-branch" value={connectionHandle} onChange={(event) => setConnectionHandle(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs focus-visible:outline-indigo-600">
                      <option value="true">Sim</option><option value="false">Não</option>
                    </select>
                  </>}
                  <label htmlFor="connection-target" className="block text-xs font-medium text-slate-700">Etapa de destino</label>
                  <select id="connection-target" required value={connectionTarget} onChange={(event) => setConnectionTarget(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs focus-visible:outline-indigo-600">
                    <option value="">Selecione</option>
                    {workflow?.nodes.filter((node) => node.id !== connectionSource).map((node) => <option key={node.id} value={node.id}>{node.label} ({node.id})</option>)}
                  </select>
                  <button type="submit" className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 focus-visible:outline-indigo-600">Adicionar conexão</button>
                </fieldset>
              </form>
              <ul className="space-y-2" aria-label="Conexões existentes">
                {workflow?.edges.map((edge) => <li key={edge.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <p className="break-words text-slate-700">{workflow.nodes.find((node) => node.id === edge.sourceNodeId)?.label ?? edge.sourceNodeId} → {workflow.nodes.find((node) => node.id === edge.targetNodeId)?.label ?? edge.targetNodeId}
                    {edge.sourceHandle && <span> · {edge.sourceHandle === 'true' ? 'Sim' : edge.sourceHandle === 'false' ? 'Não' : edge.sourceHandle}</span>}</p>
                  <button type="button" disabled={!canEditGraph} onClick={() => handleRemoveConnection(edge.id)}
                    aria-label={`Remover conexão ${edge.sourceNodeId} para ${edge.targetNodeId}${edge.sourceHandle ? ` (${edge.sourceHandle})` : ''}`}
                    className="mt-2 text-red-700 underline disabled:opacity-40 focus-visible:outline-red-700">Remover conexão</button>
                </li>)}
              </ul>
              {workflow?.edges.length === 0 && <p className="text-xs text-slate-500">Nenhuma conexão configurada.</p>}
            </section>
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
            <div hidden={isScheduleWorkflow} className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
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

            {isScheduleWorkflow && <div className="space-y-2">
              <label htmlFor="simulation-scheduled-at" className="block text-xs font-semibold text-slate-700">Horário previsto (ISO UTC)</label>
              <input id="simulation-scheduled-at" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs" />
              <p className="text-xs text-slate-600">Esta simulação usa o horário informado e não cria um agendamento.</p>
            </div>}
            {/* Formulário Sintético */}
            <div className="space-y-3">
              <div hidden={isScheduleWorkflow} className="space-y-3">
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
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${simResults.status === 'COMPLETED'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-red-700 bg-red-50 border-red-200'}`}>
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
                        <span className={`flex items-center space-x-1 text-[10px] font-semibold ${r.status === 'SUCCESS'
                          ? 'text-emerald-600' : r.status === 'FAILED' ? 'text-red-700' : 'text-slate-500'}`}>
                          {r.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" />
                            : r.status === 'FAILED' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{r.status === 'SUCCESS' ? 'Concluído' : r.status === 'FAILED' ? 'Falhou' : 'Ignorado'}</span>
                        </span>
                      </div>

                      {r.error?.message && <p role="alert" className="text-[11px] text-red-700">{r.error.message}</p>}

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
