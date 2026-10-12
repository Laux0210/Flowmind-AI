'use client';

import { useEffect, useState, useRef } from 'react';
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
  X,
} from 'lucide-react';

export default function HistoryPage() {
  const { getToken, orgId, isLoaded } = useAuth();
  const activeOrg = useRef(orgId);
  activeOrg.current = orgId;
  const [error, setError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ExecutionListItemDto[]>([]);
  const [usage, setUsage] = useState<OrgUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setExecutions([]);
    setUsage(null);
    setSelectedExecution(null);
    setError(null);
    setLoading(true);
    if (!orgId) {
      setError('Entre e selecione uma organização para consultar o histórico.');
      setLoading(false);
      return;
    }
    async function loadData() {
      try {
        const token = await getToken();
        const [execList, usageReport] = await Promise.all([
          ApiClient.listExecutions(token), ApiClient.getUsage(token),
        ]);
        if (cancelled) return;
        setExecutions(execList);
        setUsage(usageReport);
      } catch {
        if (!cancelled) setError('Não foi possível carregar o histórico e o consumo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [isLoaded, orgId, getToken]);

  useEffect(() => {
    if (!selectedExecution) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedExecution(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedExecution]);

  const handleInspect = async (id: string) => {
    setLoadingDetail(true);
    setSelectedExecution(null);
    try {
      const detail = await ApiClient.getExecution(id, await getToken());
      if (activeOrg.current !== orgId) return;
      setSelectedExecution(detail);
    } catch {
      setError('Não foi possível consultar esta execução.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {/* Cabeçalho */}
        <div className="pb-6 border-b border-slate-200 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Histórico de Execuções e Consumo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o registro de execuções das suas automações e a utilização dos recursos contratados.
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
                {usage?.totalExecutions || 0}
              </span>
              <span className="text-xs text-slate-400">
                / {usage?.maxExecutionsQuota ?? '—'} ({usage?.usagePercentage || 0}%)
              </span>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, usage?.usagePercentage || 0)}%` }}
              />
            </div>
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
                {usage?.estimatedTokensConsumed?.toLocaleString('pt-BR') || 0}
              </span>
              <span className="text-xs text-slate-400">tokens</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Baseado nas classificações e análises inteligentes processadas no mês.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Conformidade & Limites
              </span>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                ✓ Quota em Dia
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Período ativo: <strong className="text-slate-600 font-mono">{usage?.billingPeriod || 'Corrente'}</strong>
            </p>
          </div>
        </div>

        {/* Tabela de Histórico de Execuções */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Execuções Recentes</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {executions.length} execuções registradas
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Carregando histórico...</p>
            </div>
          ) : executions.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              Nenhuma execução registrada até o momento.
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
                  {executions.map((exec) => (
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
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 font-mono">
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
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition"
                        >
                          <span>Inspecionar</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  onClick={() => setSelectedExecution(null)}
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
                  onClick={() => setSelectedExecution(null)}
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
