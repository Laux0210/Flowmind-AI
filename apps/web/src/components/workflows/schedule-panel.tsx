'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiClient } from '@/lib/api-client';
import type { WorkflowScheduleView } from '@/lib/api-client';

interface SchedulePanelProps {
  workflowId: string;
  getToken: () => Promise<string | null>;
}

const STATUS_LABEL: Record<WorkflowScheduleView['status'], string> = {
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  REVOKED: 'Revogado',
};

/** Agendamentos (somente admin, workflow ativado). Intervalo mínimo e limite são validados no servidor. */
export function SchedulePanel({ workflowId, getToken }: SchedulePanelProps) {
  const [cron, setCron] = useState('0 9 * * 1-5');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');

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
    schedules: WorkflowScheduleView[];
    error: string | null;
    busy: boolean;
  }>({
    generation: currentGen,
    schedules: [],
    error: null,
    busy: false,
  });

  const isCurrent = view.generation === currentGen;
  const schedules = isCurrent ? view.schedules : [];
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
      const rows = await ApiClient.listSchedules(targetWorkflowId, token);
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      const scopedRows = Array.isArray(rows)
        ? rows.filter((item) => item && item.workflowId === targetWorkflowId)
        : [];
      setView((prev) =>
        isStale(gen, targetWorkflowId, targetGetToken)
          ? prev
          : {
              generation: gen,
              schedules: scopedRows,
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
        schedules: prev.generation === gen ? prev.schedules : [],
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
                schedules: prev.generation === gen ? prev.schedules : [],
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
                  schedules: prev.generation === gen ? prev.schedules : [],
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
    setView({ generation: contextRef.current.generation, schedules: [], error: null, busy: false });
    void run((token, gen, targetWorkflowId, targetGetToken) =>
      reloadForContext(token, gen, targetWorkflowId, targetGetToken),
    );
  }, [workflowId, getToken, run, reloadForContext]);

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (busy || contextRef.current.pendingOps > 0 || isStale(currentGen, workflowId, getToken)) return;
    const cronExpr = cron.trim();
    const tz = timezone.trim();
    void run(async (token, gen, targetWorkflowId, targetGetToken) => {
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      await ApiClient.createSchedule(targetWorkflowId, cronExpr, tz, token);
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      await reloadForContext(token, gen, targetWorkflowId, targetGetToken);
    });
  };

  const revoke = (id: string) => {
    if (busy || contextRef.current.pendingOps > 0 || isStale(currentGen, workflowId, getToken)) return;
    const belongsToActiveContext = schedules.some(
      (s) => s.id === id && s.workflowId === workflowId && s.status !== 'REVOKED',
    );
    if (!belongsToActiveContext) return;
    void run(async (token, gen, targetWorkflowId, targetGetToken) => {
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      await ApiClient.revokeSchedule(id, token);
      if (isStale(gen, targetWorkflowId, targetGetToken)) return;
      await reloadForContext(token, gen, targetWorkflowId, targetGetToken);
    });
  };

  return (
    <details className="border-b border-slate-200 bg-white px-4 sm:px-6 py-2 text-xs text-slate-700 shrink-0">
      <summary className="cursor-pointer font-semibold text-slate-800">
        Agendamentos ({schedules.filter((s) => s.status === 'ACTIVE').length} ativos)
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-slate-500">
          Cron de 5 campos (minuto hora dia mês dia-da-semana), intervalo mínimo de 15 minutos. Disparos rodam em simulação.
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <ul className="space-y-1">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex flex-wrap items-center gap-2">
              <code>{schedule.cron}</code>
              <span className="text-slate-500">{schedule.timezone}</span>
              <span className={schedule.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-400'}>
                {STATUS_LABEL[schedule.status]}
              </span>
              {schedule.status !== 'REVOKED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(schedule.id)}
                  className="text-red-700 underline disabled:opacity-50"
                >
                  Revogar
                </button>
              )}
            </li>
          ))}
          {!schedules.length && <li className="text-slate-500">Nenhum agendamento criado.</li>}
        </ul>
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            <span>Expressão cron</span>
            <input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              required
              aria-describedby="cron-help"
              className="w-40 rounded border border-slate-300 px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col">
            <span>Fuso horário</span>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
              className="w-44 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-1 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold disabled:opacity-50"
          >
            {busy ? 'Aguarde…' : 'Criar agendamento'}
          </button>
        </form>
        <p id="cron-help" className="text-slate-500">
          Exemplo: <code>0 9 * * 1-5</code> roda às 9h em dias úteis.
        </p>
      </div>
    </details>
  );
}
