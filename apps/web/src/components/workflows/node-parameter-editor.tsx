'use client';

import { useEffect, useId, useState } from 'react';
import type { NodePosition, WorkflowNode } from '@flowmind/contracts';
import { getNodeParameterFields, readNodeParameter } from '@/lib/workflow-editing';
import type { ResourceCatalogState } from '@/lib/use-resource-catalog';

const idleCatalog: ResourceCatalogState = { status: 'idle', resources: [], error: null };

interface Props {
  node: WorkflowNode;
  disabled: boolean;
  catalog?: ResourceCatalogState;
  onPendingChange: (pending: boolean) => void;
  onApply: (id: string, label: string, fields: Record<string, string>, position: NodePosition) => boolean;
}

export function NodeParameterEditor({ node, disabled, catalog = idleCatalog, onPendingChange, onApply }: Props) {
  const prefix = useId();
  const fields = getNodeParameterFields(node);
  const initialValues = () => Object.fromEntries(fields.map((field) => [field.path, readNodeParameter(node, field)]));
  const [label, setLabel] = useState(node.label);
  const [values, setValues] = useState(initialValues);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [position, setPosition] = useState({ x: String(node.position.x), y: String(node.position.y) });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel(node.label); setValues(initialValues()); setChanges({});
    setPosition({ x: String(node.position.x), y: String(node.position.y) });
    setPending(false); setError(null); onPendingChange(false);
  };
  useEffect(reset, [node.id, node.label, node.config, node.position.x, node.position.y, onPendingChange]);
  const markPending = () => { setPending(true); setError(null); onPendingChange(true); };

  return (
    <form aria-label={`Parâmetros de ${node.label}`} className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (disabled || !pending) return;
      const coordinates = { x: Number(position.x), y: Number(position.y) };
      if (!position.x.trim() || !position.y.trim() || !Number.isFinite(coordinates.x) || !Number.isFinite(coordinates.y)) {
        setError('Informe posições X e Y válidas.'); return;
      }
      if (onApply(node.id, label, changes, coordinates)) { setPending(false); setChanges({}); onPendingChange(false); }
      else setError('Alterações não aplicadas. Confira o aviso e os campos informados.');
    }}>
      <h3 className="text-sm font-semibold text-slate-900">Configurar etapa</h3>
      <p className="text-xs text-slate-500 break-words">{node.label} · {node.type}</p>
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
        <div>
          <label htmlFor={`${prefix}-name`} className="block text-xs font-medium text-slate-700">Nome da etapa</label>
          <input id={`${prefix}-name`} value={label} required onChange={(event) => { setLabel(event.target.value); markPending(); }}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus-visible:outline-indigo-600" />
        </div>
        {fields.map((field, index) => {
          const id = `${prefix}-field-${index}`;
          const value = values[field.path] ?? '';
          const change = (next: string) => {
            setValues((previous) => ({ ...previous, [field.path]: next }));
            setChanges((previous) => ({ ...previous, [field.path]: next })); markPending();
          };
          const options = field.options?.includes(value) || !value ? field.options : [value, ...(field.options ?? [])];
          const resources = catalog.resources.filter((item) => item.type === field.resourceType && item.status === 'ACTIVE');
          const legacy = !!value && !resources.some((item) => item.id === value);
          return <div key={field.path}>
            <label htmlFor={id} className="block text-xs font-medium text-slate-700">{field.label}</label>
            {field.kind === 'resource' ? (
              <>
                <select id={id} value={value} disabled={catalog.status !== 'ready'} aria-describedby={id + '-resource-hint'}
                  onChange={(event) => change(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus-visible:outline-indigo-600 disabled:opacity-60">
                  <option value="">Não informado</option>
                  {legacy && <option value={value} disabled>Referência atual (pendente): {value}</option>}
                  {resources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <p id={id + '-resource-hint'} role={catalog.status === 'error' ? 'alert' : 'status'} className="mt-1 text-[11px] text-slate-600">
                  {catalog.status === 'loading' ? 'Carregando recursos autorizados. A referência atual foi preservada.'
                    : catalog.status === 'error' ? catalog.error
                    : catalog.status === 'idle' ? 'Entre e selecione uma organização para consultar os recursos.'
                    : !resources.length ? 'Nenhum recurso disponível. A referência atual foi preservada.'
                    : legacy ? 'Referência pendente. Selecione um recurso autorizado antes da revisão.'
                    : 'Recursos autorizados para esta organização.'}
                </p>
              </>
            ) : field.kind === 'choice' ? (
              <select id={id} value={value} onChange={(event) => change(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus-visible:outline-indigo-600">
                <option value="">Não informado</option>
                {options?.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <textarea id={id} rows={field.kind === 'json' || field.path === 'bodyTemplate' ? 3 : 2} value={value}
                onChange={(event) => change(event.target.value)} aria-describedby={field.kind === 'json' ? `${id}-hint` : undefined}
                className="mt-1 w-full resize-y rounded-lg border border-slate-300 p-2 text-xs focus-visible:outline-indigo-600" />
            )}
            {field.kind === 'json' && <p id={`${id}-hint`} className="mt-1 text-[11px] text-slate-500">Formato JSON: texto entre aspas, número, lista ou objeto. Vazio remove o campo.</p>}
          </div>;
        })}
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y'] as const).map((axis) => <div key={axis}>
            <label htmlFor={`${prefix}-${axis}`} className="block text-xs font-medium text-slate-700">Posição {axis.toUpperCase()}</label>
            <input id={`${prefix}-${axis}`} type="number" step="any" required value={position[axis]}
              onChange={(event) => { setPosition((previous) => ({ ...previous, [axis]: event.target.value })); markPending(); }}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus-visible:outline-indigo-600" />
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 focus-visible:outline-indigo-600">Aplicar à etapa</button>
          <button type="button" disabled={!pending} onClick={reset} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 disabled:opacity-40 focus-visible:outline-indigo-600">Descartar alterações</button>
        </div>
      </fieldset>
      {pending && <p role="status" className="text-xs text-amber-700">Aplique ou descarte estas alterações antes de salvar ou escolher outra etapa.</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
