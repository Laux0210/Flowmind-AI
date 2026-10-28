'use client';

import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';

export type WorkflowFlowNode = Node<{
  label: string;
  nodeType: string;
  sourceHandles: Array<string | undefined>;
  targetHandles: Array<string | undefined>;
}, 'workflowStep'>;

export function WorkflowGraphNode({ id, data, selected, isConnectable }: NodeProps<WorkflowFlowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const handleSignature = JSON.stringify([data.sourceHandles, data.targetHandles]);
  useEffect(() => { updateNodeInternals(id); }, [id, handleSignature, updateNodeInternals]);
  return <div className={`min-w-36 max-w-60 rounded-xl border-2 bg-white px-4 py-3 shadow-sm ${selected ? 'border-indigo-600' : 'border-slate-200'}`}>
    {data.targetHandles.map((id, index) => <Handle key={id === undefined ? 'unnamed' : `named:${id}`} id={id} type="target" position={Position.Top}
      isConnectable={isConnectable} style={{ left: `${(index + 1) * 100 / (data.targetHandles.length + 1)}%` }} />)}
    <p className="break-words text-xs font-semibold text-slate-900">{data.label}</p>
    <p className="mt-1 break-words text-[10px] text-slate-500">{data.nodeType}</p>
    {data.sourceHandles.length > 1 && <div className="mt-2 flex justify-around gap-2 text-[10px] text-slate-500">
      {data.sourceHandles.map((id) => <span key={id === undefined ? 'unnamed' : `named:${id}`}>{id === 'true' ? 'Sim' : id === 'false' ? 'Não' : id ?? 'Saída'}</span>)}
    </div>}
    {data.sourceHandles.map((id, index) => <Handle key={id === undefined ? 'unnamed' : `named:${id}`} id={id} type="source" position={Position.Bottom}
      isConnectable={isConnectable} style={{ left: `${(index + 1) * 100 / (data.sourceHandles.length + 1)}%` }} />)}
  </div>;
}
