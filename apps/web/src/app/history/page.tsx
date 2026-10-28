'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/navbar';
import { ApiClient } from '@/lib/api-client';
import type {
  ExecutionListItemDto,
  WorkflowExecution,
  OrgUsageReport,
} from '@flowmind/contracts';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Layers,
  Sparkles,
  Database,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';

export default function HistoryPage() {
  const { getToken, orgId, isLoaded } = useAuth();
  const activeOrg = useRef(orgId);
  activeOrg.current = orgId;
  const inspectSeq = useRef(0);
  const activeContext = useRef({ orgId });
  if (activeContext.current.orgId !== orgId) {
    activeContext.current = { orgId };
    inspectSeq.current++;
  }
  const [error, setError] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ExecutionListItemDto[]>([]);
  const [usage, setUsage] = useState<OrgUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [executionLoadFailed, setExecutionLoadFailed] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'SIMULATION' | 'LIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const closeExecutionDetail = useCallback(() => {
    inspectSeq.current++;
    setSelectedExecution(null);
    setLoadingDetail(false);
    setInspectingId(null);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setExecutions([]);
    setUsage(null);
    closeExecutionDetail();
    setCurrentPage(1);
    setSearchQuery('');
    setStatusFilter('ALL');
    setModeFilter('ALL');
    setError(null);
    setInspectError(null);
    setLoading(true);
    setExecutionLoadFailed(false);
    if (!orgId) {
      setExecutionLoadFailed(true);
      setError('Entre e selecione uma organização para consultar o histórico.');
      setLoading(false);
      return;
    }
    async function loadData() {
      try {
        const token = await getToken();
        if (cancelled) return;
        const [execList, usageReport] = await Promise.allSettled([
          ApiClient.listExecutions(token), ApiClient.getUsage(token),
        ]);
        if (cancelled) return;
        const errors: string[] = [];
        if (execList.status === 'fulfilled') {
          setExecutions(execList.value);
          setExecutionLoadFailed(false);
        } else {
          setExecutions([]);
          setExecutionLoadFailed(true);
          errors.push('Histórico indisponível.');
        }
        if (usageReport.status === 'fulfilled') setUsage(usageReport.value);
        else {
          setUsage(null);
          errors.push('Consumo indisponível.');
        }
        setError(errors.length ? errors.join(' ') : null);
      } catch (err: unknown) {
        if (!cancelled) {
          setExecutionLoadFailed(true);
          setUsage(null);
          setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico e o consumo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; inspectSeq.current++; };
  }, [isLoaded, orgId, getToken, closeExecutionDetail]);

  useEffect(() => {
    if (!selectedExecution) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeExecutionDetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedExecution, closeExecutionDetail]);

  const handleInspect = async (id: string) => {
    const context = activeContext.current;
    const seq = ++inspectSeq.current;
    setInspectingId(id);
    setLoadingDetail(true);
    setSelectedExecution(null);
    setInspectError(null);
    try {
      const token = await getToken();
      if (activeContext.current !== context || activeOrg.current !== orgId || seq !== inspectSeq.current) return;
      const detail = await ApiClient.getExecution(id, token);
      if (activeContext.current !== context || activeOrg.current !== orgId || seq !== inspectSeq.current) return;
      setSelectedExecution(detail);
    } catch (err: unknown) {
      if (activeContext.current === context && activeOrg.current === orgId && seq === inspectSeq.current) {
        setInspectError(err instanceof Error ? err.message : 'Não foi possível consultar esta execução.');
      }
    } finally {
      if (activeContext.current === context && activeOrg.current === orgId && seq === inspectSeq.current) {
        setLoadingDetail(false);
        setInspectingId(null);
      }
    }
  };

  const filteredExecutions = executions.filter((exec) => {
    if (statusFilter !== 'ALL' && exec.status !== statusFilter) return false;
    if (modeFilter !== 'ALL' && exec.mode !== modeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = exec.id.toLowerCase().includes(q);
      const matchName = (exec.workflowName || '').toLowerCase().includes(q);
      const matchWfId = exec.workflowId.toLowerCase().includes(q);
      const matchTrigger = (exec.triggeredBy || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchWfId && !matchTrigger) return false;
    }
    return true;
  });

  const modeCounts = {
    ALL: executions.length,
    SIMULATION: executions.filter((e) => e.mode === 'SIMULATION').length,
    LIVE: executions.filter((e) => e.mode === 'LIVE').length,
  };

  const statusCounts = {
    ALL: executions.length,
    COMPLETED: executions.filter((e) => e.status === 'COMPLETED').length,
    FAILED: executions.filter((e) => e.status === 'FAILED').length,
  };

  const isFiltered = statusFilter !== 'ALL' || modeFilter !== 'ALL' || searchQuery.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(filteredExecutions.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedExecutions = filteredExecutions.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setModeFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {inspectError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 text-xs font-semibold flex items-center justify-between"
          >
            <span>{inspectError}</span>
            <button
              type="button"
              onClick={() => setInspectError(null)}
              className="p-1 hover:bg-black/5 rounded transition text-slate-500 hover:text-slate-800"
              aria-label="Fechar erro de inspeção"
            >
              ✕
            </button>
          </div>
        )}
        {/* Cabeçalho */}
        <div className="pb-6 border-b border-slate-200 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Histórico de Execuções e Consumo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o registro de execuções das suas automações e a utilização dos recursos.
          </p>
        </div>

        {/* Métricas de Quota e Consumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Execuções no Ciclo
              </span>
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {usage?.totalExecutions ?? '—'}
              </span>
              <span className="text-xs text-slate-400">
                / {usage?.maxExecutionsQuota ?? '—'} ({usage?.usagePercentage ?? '—'}%)
              </span>
            </div>
            {/* Barra de Progresso */}
            {usage && <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, usage?.usagePercentage || 0)}%` }}
              />
            </div>}
            <p className="text-[11px] text-slate-400 mt-2">
              {usage?.totalSimulations !== undefined
                ? `${usage.totalSimulations} simulações registradas (isentas de cota).`
                : 'Cota mensal aplicável a execuções ativas.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tokens IA Estimados
              </span>
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {usage?.estimatedTokensConsumed?.toLocaleString('pt-BR') ?? '—'}
              </span>
              <span className="text-xs text-slate-400">tokens</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              {usage?.estimatedTokensConsumed == null
                ? 'Consumo de tokens ainda não disponível.'
                : 'Estimativa de consumo de tokens no período.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Limite de Execuções
              </span>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${!usage
                ? 'bg-slate-100 text-slate-600' : usage.isLimitReached ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {!usage ? 'Consumo indisponível' : usage.isLimitReached ? 'Limite atingido' : 'Dentro do limite'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Período ativo: <strong className="text-slate-600 font-mono">{usage?.billingPeriod ?? '—'}</strong>
            </p>
          </div>
        </div>

        {/* Tabela de Histórico de Execuções com Filtros e Paginação */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Execuções Recentes</h2>
              <span className="text-xs text-slate-400 font-medium">
                ({filteredExecutions.length}{isFiltered ? ` de ${executions.length}` : ''})
              </span>
            </div>

            {/* Controles de Filtro e Busca */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Campo de Busca */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Buscar por nome, ID ou autor..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48 sm:w-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Seletor de Modo */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => { setModeFilter('ALL'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${modeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Todos ({modeCounts.ALL})
                </button>
                <button
                  type="button"
                  onClick={() => { setModeFilter('SIMULATION'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${modeFilter === 'SIMULATION' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Simulação ({modeCounts.SIMULATION})
                </button>
                <button
                  type="button"
                  onClick={() => { setModeFilter('LIVE'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${modeFilter === 'LIVE' ? 'bg-white text-emerald-600 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Live ({modeCounts.LIVE})
                </button>
              </div>

              {/* Seletor de Status */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                  className={`px-2 py-1 rounded-md font-medium transition ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Status: Todos
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('COMPLETED'); setCurrentPage(1); }}
                  className={`px-2 py-1 rounded-md font-medium transition ${statusFilter === 'COMPLETED' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Sucesso ({statusCounts.COMPLETED})
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('FAILED'); setCurrentPage(1); }}
                  className={`px-2 py-1 rounded-md font-medium transition ${statusFilter === 'FAILED' ? 'bg-white text-red-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Falha ({statusCounts.FAILED})
                </button>
              </div>

              {/* Botão de Limpar Filtros */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                  title="Limpar todos os filtros"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Carregando histórico...</p>
            </div>
          ) : executionLoadFailed ? (
            <div className="py-16 text-center text-red-700">
              Não foi possível carregar as execuções.
            </div>
          ) : executions.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              Nenhuma execução registrada até o momento.
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <p className="text-sm">Nenhuma execução encontrada para os filtros selecionados.</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar visualização completa</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      ID / Workflow
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Modo
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Duração
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Disparo
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedExecutions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-900">
                          {exec.workflowName || exec.workflowId}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {exec.id} (v{exec.workflowVersion})
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${exec.mode === 'SIMULATION' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                          {exec.mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            exec.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {exec.status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{exec.status === 'COMPLETED' ? 'Sucesso' : 'Falha'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                        {exec.durationMs !== undefined ? `${exec.durationMs}ms` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {exec.triggeredBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(exec.startedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleInspect(exec.id)}
                          disabled={loadingDetail && inspectingId === exec.id}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          <span>{loadingDetail && inspectingId === exec.id ? 'Carregando…' : 'Inspecionar'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Paginação */}
              <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs text-slate-500">
                <span>
                  Mostrando {filteredExecutions.length === 0 ? 0 : (safePage - 1) * pageSize + 1} a {Math.min(safePage * pageSize, filteredExecutions.length)} de {filteredExecutions.length} execuções
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="font-medium text-slate-700 px-1">
                    Página {safePage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                    aria-label="Próxima página"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal / Gaveta de Inspeção da Execução */}
        {selectedExecution && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="execution-detail-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 id="execution-detail-title" className="text-base font-bold text-slate-900">
                    Detalhes da Execução {selectedExecution.id}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modo: {selectedExecution.mode} • Status: {selectedExecution.status}
                  </p>
                </div>
                <button
                  onClick={closeExecutionDetail}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  aria-label="Fechar detalhes da execução"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passos Executados ({selectedExecution.nodeResults?.length || 0})
                </h4>

                {selectedExecution.nodeResults?.map((node, index) => (
                  <div
                    key={node.nodeId || index}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-indigo-600 uppercase text-[10px]">
                          Passo {index + 1}
                        </span>
                        <span className="font-mono text-slate-700 font-bold">{node.nodeId}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({node.nodeType})</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          node.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : node.status === 'SKIPPED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>

                    {/* Saídas Sanitizadas */}
                    {node.outputs && Object.keys(node.outputs).length > 0 && (
                      <div className="mt-2 bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] overflow-x-auto text-slate-700">
                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Saídas:</div>
                        <pre>{JSON.stringify(node.outputs, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={closeExecutionDetail}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
