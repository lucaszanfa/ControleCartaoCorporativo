const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function ambiente(fetch = async () => ({ok:true,json:async()=>[]})) {
  const elementos = new Map();
  const el = id => {
    if (!elementos.has(id)) elementos.set(id, {value:"", checked:false, hidden:false, textContent:"", className:"", innerHTML:"", setAttribute(k,v){this[k]=v;}, classList:{toggle(){},add(){},remove(){}}});
    return elementos.get(id);
  };
  const ctx = vm.createContext({console, URLSearchParams, fetch, usuarioIdAtual:()=>1,
    moeda:v=>String(v), formatarData:v=>v || "", classeStatus:()=>"", document:{getElementById:el,querySelector:el}});
  const source = fs.readFileSync('js/relatorios-cartao.js','utf8').split('initRelatoriosCartao().catch')[0];
  vm.runInContext(source,ctx);
  return {ctx,el,run:code=>vm.runInContext(code,ctx)};
}
test('meses completos usam o mês anterior, incluindo janeiro e fevereiro bissexto',()=>{
  const {run}=ambiente();
  for(const [ini,fim,prevIni,prevFim] of [
    ['2026-09-01','2026-09-30','2026-08-01','2026-08-31'],
    ['2026-01-01','2026-01-31','2025-12-01','2025-12-31'],
    ['2024-03-01','2024-03-31','2024-02-01','2024-02-29'],
    ['2026-09-10','2026-09-16','2026-09-03','2026-09-09']]) {
    const p=run('calcularPeriodoAnteriorPadrao('+JSON.stringify(ini)+','+JSON.stringify(fim)+')');
    assert.equal(p.inicio,prevIni); assert.equal(p.fim,prevFim);
  }
  assert.equal(run('calcularPeriodoAnteriorPadrao("2026-09-30","2026-09-01")'),null);
});
test('cartões homônimos e categorias exclusivas mantêm valores separados',()=>{
  const {ctx,run}=ambiente();
  ctx.rel={porCartao:[{cartao_id:1,departamento_id:1,cartao:'Admin',total_gasto:100},{cartao_id:2,departamento_id:2,cartao:'Admin',total_gasto:200}],anterior:{porCartao:[{cartao_id:1,departamento_id:1,cartao:'Admin',total_gasto:10},{cartao_id:2,departamento_id:2,cartao:'Admin',total_gasto:20},{cartao_id:3,departamento_id:3,cartao:'Antigo',total_gasto:30}]}};
  const itens=run('construirDadosDistribuicao(rel).itens');
  assert.equal(itens.find(x=>x.atual===100).anterior,10);
  assert.equal(itens.find(x=>x.atual===200).anterior,20);
  assert.equal(itens.find(x=>x.nome==='Antigo').anterior,30);
});
test('gráfico usa período carregado, inclui compras sem limite de data e preserva totais desiguais',()=>{
  const {ctx,run}=ambiente();
  ctx.rel={periodo:{inicio:'2026-09-01',fim:'2026-09-30',anteriorInicio:'2025-08-01',anteriorFim:'2026-08-31'},porCartao:[{total_gasto:50}],comprasPeriodo:[{data_compra:'2026-09-10',valor:50}],anterior:{porCartao:[{total_gasto:70}],comprasPeriodo:[]}};
  let dados=run('construirDadosGraficoTempo(rel)');
  assert.equal(dados.pontos.length,1); assert.equal(dados.pontos[0].anterior,70);
  ctx.rel.anterior=null;ctx.rel.periodo={inicio:'',fim:''};
  dados=run('construirDadosGraficoTempo(rel)');
  assert.equal(dados.pontos[0].atual,50);
});
test('filtros e permissões seguem em todas as consultas anteriores',async()=>{
  const urls=[];const {run}=ambiente(async url=>{urls.push(url);return {ok:true,json:async()=>[]};});
  await run('buscarDadosPeriodoAnterior("2026-08-01","2026-08-31","status=conciliada&cartaoId=2&departamentoId=3&usuarioId=4")');
  assert.equal(urls.length,3);
  for(const u of urls){const q=new URL(u,'http://test').searchParams;assert.equal(q.get('status'),'conciliada');assert.equal(q.get('usuarioId'),'4');assert.equal(q.get('cartaoId'),'2');assert.equal(q.get('dataFinal'),'2026-08-31');}
});
test('falha HTTP e resposta inválida são tratadas',async()=>{
  await assert.rejects(ambiente(async()=>({ok:false})).run('buscarListaRelatorio("/")'));
  await assert.rejects(ambiente(async()=>({ok:true,json:async()=>({erro:"erro"})})).run('buscarListaRelatorio("/")'));
});
test('datas inválidas bloqueiam requisições e escondem resultados antigos',async()=>{
  let calls=0;const {el,run}=ambiente(async()=>{calls++;});
  el('filtroDataInicial').value='2026-09-30';el('filtroDataFinal').value='2026-09-01';
  await run('carregarRelatoriosCartao()');
  assert.equal(calls,0);assert.equal(el('relatorioMensagem').role,'alert');
  assert.equal(el('.card-report-workspace').hidden,true);assert.equal(el('baixarPdfCartao').disabled,true);
});
test('consulta às compras anteriores troca as três tabelas e mostra o contexto',()=>{
  const {ctx,el,run}=ambiente();
  ctx.rel={periodo:{inicio:'2026-09-01',fim:'2026-09-30',anteriorInicio:'2026-08-01',anteriorFim:'2026-08-31'},anterior:{porCartao:[],porDepartamento:[],comprasPeriodo:[{id:8,data_compra:'2026-08-10',cartao:'Anterior',fornecedor:'Loja',valor:20}]}};
  el('periodoTabelas').value='anterior';
  run('ultimoRelatorioCartao=rel; renderTabelasSelecionadas()');
  assert.match(el('comprasPeriodoTabela').innerHTML,/Anterior/);
  assert.match(el('comprasPeriodoTabela').innerHTML,/verCompraId=8/);
  assert.match(el('contextoTabelas').textContent,/2026-08-01/);
});
test('resposta antiga não substitui filtros recentes',async()=>{
  const pending=[];
  const {el,run}=ambiente(()=>new Promise(resolve=>pending.push(resolve)));
  run('renderVisualRelatorioCartao=()=>{}');
  const primeiro=run('carregarRelatoriosCartao()');
  el('filtroCartao').value='2';
  const segundo=run('carregarRelatoriosCartao()');
  for(const resolve of pending.slice(4))resolve({ok:true,json:async()=>[]});
  await segundo;
  for(const resolve of pending.slice(0,4))resolve({ok:false});
  await primeiro;
  assert.equal(el('relatorioMensagem').role,'status');assert.equal(el('.card-report-workspace').hidden,false);
});
