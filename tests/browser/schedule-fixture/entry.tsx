import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SchedulePanel } from '../../../apps/web/src/components/workflows/schedule-panel';

const getToken = async () => 'synthetic-schedule-fixture';
function Fixture() {
  const [workflowId, setWorkflowId] = useState('wf_a');
  return <main className="mx-auto max-w-3xl p-4 space-y-4">
    <h1 className="text-xl font-bold">Teste isolado de agendamentos</h1>
    <p>Dados sintéticos. Workflow atual: <strong>{workflowId}</strong></p>
    <nav aria-label="Controles da fixture" className="flex flex-wrap gap-2">
      <button onClick={() => setWorkflowId('wf_a')}>Selecionar fluxo A</button>
      <button onClick={() => setWorkflowId('wf_b')}>Selecionar fluxo B</button>
      <button onClick={() => { void fetch('/fixture/release', { method: 'POST' }); }}>Liberar resposta antiga</button>
    </nav>
    <SchedulePanel workflowId={workflowId} getToken={getToken} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture /></React.StrictMode>);
