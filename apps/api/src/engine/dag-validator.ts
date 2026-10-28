import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@flowmind/contracts';
import { WORKFLOW_NODE_TYPES } from '@flowmind/contracts';

export interface TopologicalSortResult {
  sortedNodes: WorkflowNode[];
  edgesBySource: Map<string, WorkflowEdge[]>;
  edgesByTarget: Map<string, WorkflowEdge[]>;
  ancestorsByNode: Map<string, Set<string>>;
}

/**
 * Validador Estrutural de Grafo Acíclico Dirigido (DAG) utilizando o algoritmo de Kahn.
 */
export class DagValidator {
  /**
   * Valida a integridade do grafo e retorna a ordenação topológica dos nós.
   */
  static validateAndSort(workflow: WorkflowDefinition): TopologicalSortResult {
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    if (nodes.length === 0) {
      throw new BadRequestException('O workflow deve conter ao menos um nó.');
    }

    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      if (!node || typeof node.id !== 'string' || !node.id.trim()) {
        throw new BadRequestException({
          code: 'WORKFLOW_INVALID_NODE_ID', message: 'Identificador de nó ausente ou inválido.',
        });
      }
      if (typeof node.type !== 'string' || !WORKFLOW_NODE_TYPES.includes(node.type)) {
        throw new BadRequestException({
          code: 'WORKFLOW_INVALID_NODE_TYPE', message: 'Tipo de nó fora do catálogo permitido.',
        });
      }
      if (nodeMap.has(node.id)) {
        throw new BadRequestException(`ID de nó duplicado detectado: ${node.id}`);
      }
      nodeMap.set(node.id, node);
    }

    // Validação de gatilhos
    const triggerNodes = nodes.filter((n) => n.type.startsWith('trigger_'));
    if (triggerNodes.length === 0) {
      throw new BadRequestException('O workflow deve possuir exatamente um nó de gatilho (trigger).');
    }
    if (triggerNodes.length > 1) {
      throw new BadRequestException('Múltiplos nós de gatilho não são permitidos nesta versão.');
    }

    const triggerNode = triggerNodes[0];
    if (workflow.triggerNodeId !== triggerNode.id) {
      throw new BadRequestException('Identificador do gatilho diverge do nó de gatilho');
    }

    // Mapeamento de arestas e graus de entrada (in-degree)
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    const edgesBySource = new Map<string, WorkflowEdge[]>();
    const edgesByTarget = new Map<string, WorkflowEdge[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
      edgesBySource.set(node.id, []);
      edgesByTarget.set(node.id, []);
    }

    const edgeIds = new Set<string>();
    for (const edge of edges) {
      if (!edge || typeof edge.id !== 'string' || !edge.id.trim() || edgeIds.has(edge.id)) {
        throw new BadRequestException({
          code: 'WORKFLOW_INVALID_EDGE_ID', message: 'Identificador de aresta ausente, inválido ou repetido.',
        });
      }
      edgeIds.add(edge.id);
      if (!nodeMap.has(edge.sourceNodeId)) {
        throw new BadRequestException(`Aresta referencia nó de origem inexistente: ${edge.sourceNodeId}`);
      }
      if (!nodeMap.has(edge.targetNodeId)) {
        throw new BadRequestException(`Aresta referencia nó de destino inexistente: ${edge.targetNodeId}`);
      }

      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) || 0) + 1);
      adjacencyList.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      edgesBySource.get(edge.sourceNodeId)?.push(edge);
      edgesByTarget.get(edge.targetNodeId)?.push(edge);
    }

    // O gatilho não pode receber arestas de entrada
    if ((inDegree.get(triggerNode.id) || 0) > 0) {
      throw new BadRequestException('O nó de gatilho não pode possuir conexões de entrada.');
    }

    // Algoritmo de Kahn para ordenação topológica e detecção de ciclos
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sortedNodeIds: string[] = [];
    const ancestorsByNode = new Map<string, Set<string>>();
    for (const node of nodes) {
      ancestorsByNode.set(node.id, new Set<string>());
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      sortedNodeIds.push(currentId);

      const neighbors = adjacencyList.get(currentId) || [];
      for (const neighborId of neighbors) {
        // Propaga ancestrais
        const currentAncestors = ancestorsByNode.get(currentId) || new Set<string>();
        const neighborAncestors = ancestorsByNode.get(neighborId)!;
        neighborAncestors.add(currentId);
        currentAncestors.forEach((anc) => neighborAncestors.add(anc));

        const updatedDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, updatedDegree);

        if (updatedDegree === 0) {
          queue.push(neighborId);
        }
      }
    }

    // Se a contagem não bater com o total de nós, há um ciclo no grafo
    if (sortedNodeIds.length !== nodes.length) {
      throw new BadRequestException('Ciclo detectado no grafo de automação (WORKFLOW_CYCLE_DETECTED).');
    }

    const sortedNodes = sortedNodeIds.map((id) => nodeMap.get(id)!);
    for (const node of sortedNodes) {
      if (node.id !== triggerNode.id && !ancestorsByNode.get(node.id)?.has(triggerNode.id)) {
        throw new BadRequestException(`Nó desconectado do gatilho: ${node.id}`);
      }
    }

    return {
      sortedNodes,
      edgesBySource,
      edgesByTarget,
      ancestorsByNode,
    };
  }
}
