import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule } from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Executa os callbacks reais extraídos por AST. Não renderiza React nem comprova
// hooks, foco ou navegador. Identidade, setters e API são fixtures sem rede.
export async function loadUiHandlers(relativePath, names, values = {}, { freezeRenderBindings = false } = {}) {
  const source = ts.createSourceFile(relativePath, readFileSync(resolve(root, relativePath), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  let inlineClose;
  let firstEffect;
  function visit(node) {
    if (!firstEffect && ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]) {
      firstEffect = node.arguments[0].getText(source);
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)) {
          declarations.set(declaration.name.text, node.getText(source));
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) {
      declarations.set(node.name.text, node.getText(source));
    }
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'onClick' &&
      node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression &&
      node.initializer.expression.getText(source) === '() => setSelectedExecution(null)') {
      inlineClose = node.initializer.expression.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (names.includes('resetContextEffect') && firstEffect) {
    declarations.set('resetContextEffect', `const resetContextEffect = ${firstEffect};`);
  }
  if (names.includes('closeExecutionDetail') && !declarations.has('closeExecutionDetail') && inlineClose) {
    declarations.set('closeExecutionDetail', `const closeExecutionDetail = ${inlineClose};`);
  }
  for (const name of names) if (!declarations.has(name)) throw new Error(`Handler ausente: ${name}`);
  const text = [...new Set(declarations.values())].join('\n') + `\nexport { ${names.join(', ')} };`;
  const state = { error: null, feedback: null, loadingDetail: false, selectedExecution: null, ...values };
  if (state.activeContext && !state.editingContext) state.editingContext = state.activeContext.current;
  if (state.activeContext && !state.draftView) state.draftView = { current: { workflow: state.workflow, context: state.activeContext.current } };
  const context = createContext({ ...state, Error, console, useCallback: (fn) => fn });
  for (const name of new Set(text.match(/\bset[A-Z]\w*(?=\()/g) ?? [])) {
    const field = name[3].toLowerCase() + name.slice(4);
    context[name] = (value) => {
      state[field] = typeof value === 'function' ? value(state[field]) : value;
      if (!freezeRenderBindings) context[field] = state[field];
    };
  }
  const compiled = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const module = new SourceTextModule(compiled, { context });
  await module.link(() => { throw new Error('Importações externas proibidas'); });
  await module.evaluate();
  return { handlers: module.namespace, context, state };
}
