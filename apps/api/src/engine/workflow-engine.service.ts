import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  SimulateWorkflowResponse,
  NodeExecutionResult,
} from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';
import { DagValidator } from './dag-validator';
import { VariableResolver } from './variable-resolver';
import { NodeExecutors } from './node-executors';
import { validateEmailConfiguration } from './workflow-validation';
import type { ExecutionContext } from './node-executors';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  /**
   * Executa a simulação completa de um workflow DAG utilizando entradas sintéticas.
   */
  async simulate(
    workflow: WorkflowDefinition,
    initialPayload: Record<string, unknown>,
  ): Promise<SimulateWorkflowResponse> {
    const startTime = Date.now();
    const executionId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.logger.log(`Iniciando simulação do workflow '${workflow.name}' [ID: ${workflow.id}]`);

    if (workflow.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
      throw new BadRequestException('Versão de schema não suportada; revise a definição antes de simular');
    }

    // 1. Validação estrutural do grafo e ordenação topológica
    const { sortedNodes, edgesBySource, edgesByTarget, ancestorsByNode } = DagValidator.validateAndSort(workflow);

    // 2. Validação antecipada de referências de variáveis
    this.validateVariablePrecedence(sortedNodes, ancestorsByNode);
    validateEmailConfiguration(workflow, ancestorsByNode);

    // 3. Execução passo a passo
    const nodeOutputs = new Map<string, Record<string, unknown>>();
    const nodeResults: NodeExecutionResult[] = [];
    const skippedNodeIds = new Set<string>();
    const inactiveEdgeSet = new Set<string>();

    const execContext: ExecutionContext = {
      mode: 'SIMULATION',
      orgId: workflow.orgId,
    };

    for (const node of sortedNodes) {
      const nodeStartTime = new Date().toISOString();

      if (skippedNodeIds.has(node.id)) {
        nodeResults.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'SKIPPED',
          startedAt: nodeStartTime,
          completedAt: new Date().toISOString(),
          inputs: {},
          outputs: {},
        });
        continue;
      }

      try {
        let outputs: Record<string, unknown> = {};
        const resolvedConfig = VariableResolver.resolve(node.config, nodeOutputs, skippedNodeIds);

        switch (node.type) {
          case 'trigger_form':
            outputs = NodeExecutors.executeTriggerForm(resolvedConfig, initialPayload) as unknown as Record<string, unknown>;
            break;

          case 'ai_analyze_intent':
            outputs = (await NodeExecutors.executeAiAnalyzeIntent(
              node.config,
              resolvedConfig,
              execContext,
            )) as unknown as Record<string, unknown>;
            break;

          case 'internal_record':
            outputs = NodeExecutors.executeInternalRecord(
              node.config,
              resolvedConfig,
              execContext,
            ) as unknown as Record<string, unknown>;
            break;

          case 'send_email':
            outputs = NodeExecutors.executeSendEmail(
              node.config,
              resolvedConfig,
              execContext,
            ) as unknown as Record<string, unknown>;
            break;

          case 'condition':
            outputs = NodeExecutors.executeCondition(
              node.config,
              resolvedConfig,
            ) as unknown as Record<string, unknown>;

            // Roteamento condicional e convergência
            this.handleConditionBranching(
              node.id,
              outputs.result as boolean,
              edgesBySource,
              edgesByTarget,
              skippedNodeIds,
              inactiveEdgeSet,
            );
            break;

          case 'http_request':
            outputs = NodeExecutors.executeHttpRequest(
              node.config,
              resolvedConfig,
              execContext,
            ) as unknown as Record<string, unknown>;
            break;

          default:
            throw new BadRequestException(`Tipo de nó não suportado pelo motor: ${node.type}`);
        }


        nodeOutputs.set(node.id, outputs);

        nodeResults.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'SUCCESS',
          startedAt: nodeStartTime,
          completedAt: new Date().toISOString(),
          inputs: resolvedConfig,
          outputs,
        });
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Falha no nó ${node.id} (${node.type}): ${err.message}`);

        nodeResults.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'FAILED',
          startedAt: nodeStartTime,
          completedAt: new Date().toISOString(),
          inputs: node.config,
          error: {
            code: 'NODE_EXECUTION_FAILED',
            message: err.message,
          },
        });

        return {
          executionId,
          status: 'FAILED',
          totalDurationMs: Date.now() - startTime,
          nodeResults,
        };
      }
    }

    return {
      executionId,
      status: 'COMPLETED',
      totalDurationMs: Date.now() - startTime,
      nodeResults,
    };
  }

  /**
   * Garante que todas as referências {{nodeId.field}} apontem apenas para ancestrais do nó atual.
   */
  private validateVariablePrecedence(
    nodes: WorkflowNode[],
    ancestorsByNode: Map<string, Set<string>>,
  ): void {
    for (const node of nodes) {
      const references = VariableResolver.extractReferences(node.config);
      const allowedAncestors = ancestorsByNode.get(node.id) || new Set<string>();

      for (const ref of references) {
        if (!allowedAncestors.has(ref.nodeId)) {
          throw new BadRequestException(
            `Violação de precedência no DAG: o nó '${node.id}' referencia '${ref.nodeId}', que não o precede no fluxo.`,
          );
        }
      }
    }
  }

  /**
   * Trata ramificação condicional para handles 'true' e 'false'.
   * Suporta propagação em profundidade e convergência de ramos (OR-Join):
   * um nó convergente só é marcado como SKIPPED se TODAS as suas arestas de entrada forem inativas.
   */
  private handleConditionBranching(
    conditionNodeId: string,
    conditionResult: boolean,
    edgesBySource: Map<string, WorkflowEdge[]>,
    edgesByTarget: Map<string, WorkflowEdge[]>,
    skippedNodeIds: Set<string>,
    inactiveEdgeSet: Set<string>,
  ): void {
    const outgoingEdges = edgesBySource.get(conditionNodeId) || [];
    const inactiveHandle = conditionResult ? 'false' : 'true';

    const queue: string[] = [];
    for (const edge of outgoingEdges) {
      if (edge.sourceHandle === inactiveHandle) {
        inactiveEdgeSet.add(edge.id);
        queue.push(edge.targetNodeId);
      }
    }

    // Propagação respeitando convergências (OR-Join)
    while (queue.length > 0) {
      const candidateId = queue.shift()!;
      if (skippedNodeIds.has(candidateId)) continue;

      const incomingEdges = edgesByTarget.get(candidateId) || [];
      const allIncomingInactive =
        incomingEdges.length > 0 &&
        incomingEdges.every(
          (inEdge) =>
            inactiveEdgeSet.has(inEdge.id) ||
            skippedNodeIds.has(inEdge.sourceNodeId),
        );

      if (allIncomingInactive) {
        skippedNodeIds.add(candidateId);
        const children = edgesBySource.get(candidateId) || [];
        for (const childEdge of children) {
          inactiveEdgeSet.add(childEdge.id);
          queue.push(childEdge.targetNodeId);
        }
      }
    }
  }
}

