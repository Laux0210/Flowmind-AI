import { WORKFLOW_SCHEMA_VERSION, getNodeConfigIssues } from '@flowmind/contracts';

/** Apenas snapshots publicados consultados após autorização do workflow na organização. */
export function hasScheduleTrigger(snapshot: { schemaVersion: string; triggerNodeId: string; nodes: unknown } | null): boolean {
  if (!snapshot || snapshot.schemaVersion !== WORKFLOW_SCHEMA_VERSION || !Array.isArray(snapshot.nodes)) return false;
  const triggers = snapshot.nodes.filter(node => node && typeof node.type === 'string' && node.type.startsWith('trigger_'));
  return triggers.length === 1 && triggers[0].id === snapshot.triggerNodeId && triggers[0].type === 'trigger_schedule' &&
    getNodeConfigIssues('trigger_schedule', triggers[0].config).length === 0;
}
