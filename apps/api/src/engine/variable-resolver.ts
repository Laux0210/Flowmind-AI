import { BadRequestException } from '@nestjs/common';

/**
 * Utilitário determinístico para resolução de variáveis em templates e payloads.
 * Exemplo de sintaxe: "{{trigger_form.contact_email}}"
 */
export class VariableResolver {
  private static readonly VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)\s*\}\}/g;
  private static readonly EXACT_VARIABLE_REGEX = /^\{\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)\s*\}\}$/;

  static isExactReference(value: string): boolean {
    return this.EXACT_VARIABLE_REGEX.test(value.trim());
  }

  /**
   * Extrai todas as referências a nós presentes em um valor (string ou objeto recursivo).
   */
  static extractReferences(value: unknown): Array<{ nodeId: string; fieldPath: string }> {
    const refs: Array<{ nodeId: string; fieldPath: string }> = [];

    if (typeof value === 'string') {
      let match: RegExpExecArray | null;
      const regex = new RegExp(this.VARIABLE_REGEX);
      while ((match = regex.exec(value)) !== null) {
        refs.push({ nodeId: match[1], fieldPath: match[2] });
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key of Object.keys(value)) {
        refs.push(...this.extractReferences((value as Record<string, unknown>)[key]));
      }
    }

    return refs;
  }

  /**
   * Resolve um valor interpolando com os outputs dos nós já executados.
   * Nós marcados em skippedNodeIds são resolvidos para undefined/vazio sem erro fatal em nós convergentes.
   */
  static resolve<T = unknown>(
    template: T,
    nodeOutputs: Map<string, Record<string, unknown>>,
    skippedNodeIds?: Set<string>,
  ): T {
    if (typeof template === 'string') {
      return this.interpolateString(template, nodeOutputs, skippedNodeIds) as unknown as T;
    }

    if (Array.isArray(template)) {
      return template.map((item) => this.resolve(item, nodeOutputs, skippedNodeIds)) as unknown as T;
    }

    if (typeof template === 'object' && template !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(template)) {
        result[key] = this.resolve(val, nodeOutputs, skippedNodeIds);
      }
      return result as T;
    }

    return template;
  }

  private static interpolateString(
    str: string,
    nodeOutputs: Map<string, Record<string, unknown>>,
    skippedNodeIds?: Set<string>,
  ): unknown {
    // Se a string inteira for exatamente uma variável "{{node.field}}", preserva o tipo original
    const exactMatch = str.trim().match(this.EXACT_VARIABLE_REGEX);
    if (exactMatch) {
      const nodeId = exactMatch[1];
      const fieldPath = exactMatch[2];
      return this.extractFieldValue(nodeId, fieldPath, nodeOutputs, skippedNodeIds);
    }

    // Interpolação textual dentro de frases
    return str.replace(this.VARIABLE_REGEX, (_match, nodeId, fieldPath) => {
      const val = this.extractFieldValue(nodeId, fieldPath, nodeOutputs, skippedNodeIds);
      if (val === undefined || val === null) {
        return '';
      }
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  }

  private static extractFieldValue(
    nodeId: string,
    fieldPath: string,
    nodeOutputs: Map<string, Record<string, unknown>>,
    skippedNodeIds?: Set<string>,
  ): unknown {
    const outputs = nodeOutputs.get(nodeId);
    if (!outputs) {
      if (skippedNodeIds?.has(nodeId)) {
        return undefined;
      }
      throw new BadRequestException(
        `Referência inválida: o nó '${nodeId}' ainda não foi executado ou não produziu saídas.`,
      );
    }

    const parts = fieldPath.split('.');
    let current: unknown = outputs;

    for (const part of parts) {
      if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) {
        throw new BadRequestException(`Campo de referência inexistente: ${nodeId}.${fieldPath}`);
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) {
      throw new BadRequestException(`Campo de referência ausente: ${nodeId}.${fieldPath}`);
    }

    return current;
  }
}
