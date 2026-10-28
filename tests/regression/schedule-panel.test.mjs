import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;});return {promise,resolve,reject}; };
const row = (id, workflowId) => ({id,workflowId,cron:id,timezone:'UTC',status:'ACTIVE',createdAt:'2026-10-23T00:00:00Z'});
const elements = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(elements) : [node,...elements(node.props?.children)];
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
const button = (tree,label) => elements(tree).find(e=>e.type==='button'&&text(e)===label);
const createAction = tree => {
  const form=elements(tree).find(e=>e.type==='form');
  return form?.props.onSubmit ? () => form.props.onSubmit({preventDefault(){}}) : button(tree,'Criar agendamento').props.onClick;
};

// Unidade do componente real com hooks/cleanup controlados; o browser complementa o lifecycle real.
function fixture(api, getToken = async () => 'token') {
  const slots=[], deps=new Map(), cleanups=new Map(), effectFns=new Map();let index=0, effects=[], unmounted=false, writesAfterUnmount=0;
  const changed=(i,next)=>{const old=deps.get(i);return !old||old.length!==next.length||next.some((v,n)=>v!==old[n]);};
  const react={
    useRef(initial){const i=index++;return slots[i]??(slots[i]={current:initial});},
    useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
      return [slots[i],value=>{if(unmounted)writesAfterUnmount++;slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useCallback(fn,next){const i=index++;if(changed(i,next)){deps.set(i,next);slots[i]=fn;}return slots[i];},
    useEffect(fn,next){const i=index++;effectFns.set(i,fn);if(changed(i,next)){deps.set(i,next);effects.push([i,fn]);}},
  };
  const jsx=(type,props)=>({type,props});const module={exports:{}};
  const source=readFileSync(new URL('../../apps/web/src/components/workflows/schedule-panel.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(compiled,{module,exports:module.exports,Error,require(name){if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name.endsWith('lib/api-client'))return {ApiClient:api};throw new Error('Import inesperado: '+name);}});
  let props={workflowId:'a',orgId:'org_a',getToken};
  return {render(next={}){props={...props,...next};index=0;effects=[];const tree=module.exports.SchedulePanel(props);
    for(const [i,fn] of effects){cleanups.get(i)?.();cleanups.set(i,fn());}return tree;},
    unmount(){unmounted=true;for(const c of cleanups.values())c?.();},
    strictReplay(){for(const c of cleanups.values())c?.();for(const [i,fn] of effectFns)cleanups.set(i,fn());},
    writesAfterUnmount:()=>writesAfterUnmount};
}

test('resposta atrasada A não substitui a lista de B',async()=>{
  const a=deferred(),b=deferred();const f=fixture({listSchedules:id=>id==='a'?a.promise:b.promise});
  f.render();await flush();f.render({workflowId:'b'});await flush();b.resolve([row('B','b')]);await flush();
  a.resolve([row('A','a')]);await flush();const codes=elements(f.render()).filter(e=>e.type==='code').map(text);assert.ok(codes.includes('B'));assert.ok(!codes.includes('A'));
});
test('A→B→A ignora sucesso e erro dos pedidos anteriores',async()=>{
  const pending=[deferred(),deferred(),deferred()];let n=0;const f=fixture({listSchedules:()=>pending[n++].promise});
  f.render();await flush();f.render({workflowId:'b'});await flush();f.render({workflowId:'a'});await flush();
  pending[2].resolve([row('ATUAL','a')]);await flush();pending[0].resolve([row('ANTIGO','a')]);pending[1].reject(new Error('ERRO_OBSOLETO'));await flush();
  const tree=f.render();assert.match(text(tree),/ATUAL/);assert.doesNotMatch(text(tree),/ANTIGO|ERRO_OBSOLETO/);assert.equal(elements(tree).filter(e=>e.props?.role==='alert').length,0);
});
test('token atrasado de contexto anterior não inicia sua consulta',async()=>{
  const token=deferred(),calls=[];let n=0;const f=fixture({listSchedules:async(id)=>{calls.push(id);return [];}},()=>++n===1?token.promise:Promise.resolve('novo'));
  f.render();f.render({workflowId:'b'});token.resolve('antigo');await flush();assert.deepEqual(calls,['b']);
});
test('troca de identidade do token esconde lista anterior já no primeiro render',async()=>{
  let n=0;const pending=deferred();const f=fixture({listSchedules:()=>++n===1?Promise.resolve([row('PRIVADO_A','a')]):pending.promise});
  f.render();await flush();assert.match(text(f.render()),/PRIVADO_A/);
  assert.doesNotMatch(text(f.render({getToken:async()=>'outro_token'})),/PRIVADO_A/);
});
test('ação com token pendente não cria agendamento após mudar contexto',async()=>{
  const token=deferred(),created=[];let n=0;const f=fixture({listSchedules:async()=>[],createSchedule:async id=>created.push(id)},()=>++n===2?token.promise:Promise.resolve('token'));
  f.render();await flush();createAction(f.render())();
  f.render({workflowId:'b'});await flush();token.resolve('token_antigo');await flush();assert.deepEqual(created,[]);
});
test('duas ações no mesmo render iniciam só uma criação',async()=>{
  const pending=deferred(),created=[];const f=fixture({listSchedules:async()=>[],createSchedule:async id=>{created.push(id);return pending.promise;}});
  f.render();await flush();const create=createAction(f.render());create();create();await flush();assert.deepEqual(created,['a']);pending.resolve({});await flush();
});
test('resposta após unmount não altera estado',async()=>{
  const pending=deferred();const f=fixture({listSchedules:()=>pending.promise});f.render();await flush();f.unmount();pending.resolve([]);await flush();assert.equal(f.writesAfterUnmount(),0);
});
test('replay de efeitos do StrictMode não deixa ações presas em busy',async()=>{
  const pending=[deferred(),deferred()];let n=0;const f=fixture({listSchedules:()=>pending[n++].promise});
  f.render();await flush();f.strictReplay();await flush();pending[1].resolve([row('ATUAL','a')]);await flush();pending[0].resolve([row('OBSOLETO','a')]);await flush();
  const tree=f.render();assert.match(text(tree),/ATUAL/);assert.doesNotMatch(text(tree),/OBSOLETO/);const submit=elements(tree).find(e=>e.type==='button'&&e.props.type==='submit');assert.equal(submit.props.disabled,false);
});
