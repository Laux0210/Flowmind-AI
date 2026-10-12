'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/navbar';
import { ApiClient } from '@/lib/api-client';
import type { WorkflowDefinition, GenerateWorkflowResponse } from '@flowmind/contracts';
import { Plus, Workflow, Play, Clock, Sparkles, Layers, ArrowRight, Trash2 } from 'lucide-react';

export default function DashboardPage() {
  const { getToken, orgId, isLoaded } = useAuth();
  const activeContext = useRef({ orgId, creating: false });
  if (activeContext.current.orgId !== orgId) activeContext.current = { orgId, creating: false };
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createMode, setCreateMode] = useState<'ai' | 'manual'>('ai');
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [aiPrompt, setAiPrompt] = useState(
    'Quando o cliente enviar formulário, gere resumo e intenção com IA, sinalize ambiguidades, registre internamente e envie e-mail ao contato.',
  );
  const [aiGenerating, setAiGenerating] = useState(false);
  const [pendingAiDraft, setPendingAiDraft] = useState<{
    id: string; proposal: GenerateWorkflowResponse['workflow'];
  } | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setWorkflows([]);
    setPendingAiDraft(null);
    setAiGenerating(false);
    setError(null);
    setLoading(true);
    if (!orgId) {
      setError('Entre e selecione uma organização para acessar as automações.');
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const data = await ApiClient.listWorkflows(await getToken());
        if (!cancelled) setWorkflows(data);
      } catch {
        if (!cancelled) setError('Não foi possível carregar as automações.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isLoaded, orgId, getToken]);

  useEffect(() => {
    if (!isCreating) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreating(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreating]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const context = activeContext.current;
    if (!newWorkflowName.trim() || context.creating) return;
    context.creating = true;

    try {
      const token = await getToken();
      if (activeContext.current !== context) return;
      const created = await ApiClient.createWorkflow({
        name: newWorkflowName.trim(),
        description: 'Automação criada no dashboard',
      }, token);
      if (activeContext.current !== context) return;
      setWorkflows((previous) => [created, ...previous]);
      setNewWorkflowName('');
      setIsCreating(false);
    } catch {
      if (activeContext.current === context) setError('Não foi possível criar o rascunho.');
    } finally {
      context.creating = false;
    }
  };

  const handleCreateWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    const context = activeContext.current;
    if ((!pendingAiDraft && !aiPrompt.trim()) || context.creating) return;
    context.creating = true;

    setAiGenerating(true);
    setError(null);
    let draft = pendingAiDraft;
    try {
      const token = await getToken();
      if (activeContext.current !== context) return;
      if (!draft) {
        const generated = await ApiClient.generateWorkflow({ prompt: aiPrompt }, token);
        if (activeContext.current !== context) return;
        const created = await ApiClient.createWorkflow({
          name: generated.workflow.name,
          description: generated.workflow.description,
        }, token);
        if (activeContext.current !== context) return;
        draft = { id: created.id, proposal: generated.workflow };
        setPendingAiDraft(draft);
        setWorkflows((previous) => [created, ...previous]);
      }
      const saved = await ApiClient.updateWorkflow(draft.id, {
        nodes: draft.proposal.nodes,
        edges: draft.proposal.edges,
        triggerNodeId: draft.proposal.triggerNodeId,
      }, token);
      if (activeContext.current !== context) return;
      setWorkflows((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      setPendingAiDraft(null);

      setIsCreating(false);
      alert('Proposta salva para revisão. Confira os parâmetros antes de simular.');
    } catch {
      if (activeContext.current !== context) return;
      setError(draft
        ? `Rascunho ${draft.id} criado; a proposta ainda não foi salva. Tente salvar novamente nesse rascunho.`
        : 'Não foi possível propor o fluxo.');
    } finally {
      context.creating = false;
      if (activeContext.current === context) setAiGenerating(false);
    }
  };

  const handleDelete = async (wf: WorkflowDefinition) => {
    if (wf.status === 'PUBLISHED') {
      alert('Não é permitido excluir um workflow ativo (PUBLISHED). Desative-o no editor antes de excluí-lo.');
      return;
    }
    if (!confirm(`Deseja realmente excluir o workflow "${wf.name}"?`)) return;
    try {
      const token = await getToken();
      await ApiClient.deleteWorkflow(wf.id, token);
      setWorkflows((previous) => previous.filter((item) => item.id !== wf.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao excluir workflow.');
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {/* Cabeçalho do Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Automações da Organização
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie, edite e acompanhe os fluxos inteligentes criados com IA.
            </p>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Automação</span>
          </button>
        </div>

        {/* Modal Avançado de Criação (IA + Manual) */}
        {isCreating && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-workflow-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 id="modal-workflow-title" className="text-lg font-bold text-slate-900">Nova Automação</h3>
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCreateMode('ai')}
                    disabled={aiGenerating || !!pendingAiDraft}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      createMode === 'ai'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    ✨ Propor fluxo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('manual')}
                    disabled={aiGenerating || !!pendingAiDraft}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      createMode === 'manual'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {createMode === 'ai' ? (
                <form onSubmit={handleCreateWithAi}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descreva o que sua automação deve fazer (Linguagem Natural)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={aiPrompt}
                    disabled={aiGenerating || !!pendingAiDraft}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: Ao receber formulário, resuma a mensagem, sinalize ambiguidades, registre e responda ao contato."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />

                  {/* Sugestões rápidas de prompt */}
                  <div className="mb-4">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Exemplos rápidos:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAiPrompt(
                            'Quando cliente preencher formulário, analise resumo e intenção com IA, registre internamente e envie e-mail ao contato.',
                          )
                        }
                        className="text-[10px] bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md px-2 py-1 transition text-left"
                      >
                        Formulário + IA + Registro + E-mail
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAiPrompt(
                            'Ao receber formulário, analise resumo e intenção com IA, registre as ambiguidades e responda ao contato.',
                          )
                        }
                        className="text-[10px] bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md px-2 py-1 transition text-left"
                      >
                        Preservar ambiguidades
                      </button>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-4 text-[11px] text-amber-800 flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p>
                      <strong>Revisão Humana:</strong> A IA propõe o grafo e configurações para você inspecionar no editor visual antes de qualquer publicação ou execução em produção.
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      disabled={aiGenerating}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={aiGenerating}
                      className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      {aiGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Gerando Grafo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{pendingAiDraft ? 'Tentar salvar novamente' : 'Propor fluxo'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreate}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Automação
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Triagem de Formulário Comercial"
                    value={newWorkflowName}
                    onChange={(e) => setNewWorkflowName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />

                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                    >
                      Criar e Editar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}


        {/* Grid de Workflows */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Carregando automações...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200 my-8 p-8">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Workflow className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Nenhuma automação encontrada</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              Crie seu primeiro workflow inteligente conectando formulários a nós de análise por IA.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeira Automação</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-8">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        wf.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : wf.status === 'REVIEWED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {wf.status === 'PUBLISHED' ? 'Ativo' : wf.status === 'REVIEWED' ? 'Revisado' : 'Rascunho'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">v{wf.version}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">
                    {wf.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                    {wf.description || 'Sem descrição cadastrada.'}
                  </p>

                  <div className="flex items-center space-x-4 text-xs text-slate-500 pt-3 border-t border-slate-100 mb-6">
                    <div className="flex items-center space-x-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{wf.nodes?.length || 0} nós</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(wf.updatedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                  >
                    <span>Abrir Editor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={`/workflows/${wf.id}?simulate=true`}
                    className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Simular</span>
                  </Link>

                  <button
                    onClick={() => handleDelete(wf)}
                    title={
                      wf.status === 'PUBLISHED'
                        ? 'Workflows ativos não podem ser excluídos. Desative primeiro.'
                        : 'Excluir workflow'
                    }
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
