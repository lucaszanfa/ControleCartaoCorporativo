const test = require('node:test');
const assert = require('node:assert/strict');
const { filtrarPesquisaCompras, escaparPesquisaCompra } = require('../js/pesquisar-compras');
const compras = [
  { id: 1, cartaoId: 1, cartao: 'Administrativo', dataCompra: '2026-09-10', fornecedor: 'Kalunga', responsavel: 'João', status: 'conferida', valor: 100 },
  { id: 2, cartaoId: 1, cartao: 'Administrativo', dataCompra: '2026-09-15', fornecedor: 'Kalunga', status: 'sem_comprovante', valor: 50 },
  { id: 3, cartaoId: 2, cartao: 'Copa', dataCompra: '2026-09-15', fornecedor: 'Kalunga', status: 'conferida', valor: 200 },
  { id: 4, cartaoId: 1, cartao: 'Administrativo', dataCompra: '2026-10-10', fornecedor: 'Kalunga', status: 'aguardando_fatura', parcelaAtual: 2, parcelaTotal: 6, valor: 100 }
];
const permitidos = [{ id: 1 }];
test('combina cartao, fornecedor, intervalo inclusivo e situacao', () => {
  const result = filtrarPesquisaCompras(compras, permitidos, { cartao: '1', fornecedor: 'kal', inicio: '2026-09-10', fim: '2026-09-10', status: 'conferida' });
  assert.deepEqual(result.map(c => c.id), [1]);
});
test('nenhum filtro permite incluir cartao sem permissao', () => {
  assert.deepEqual(filtrarPesquisaCompras(compras, permitidos).map(c => c.id), [4, 2, 1]);
  assert.deepEqual(filtrarPesquisaCompras(compras, permitidos, { cartao: '2' }), []);
  assert.deepEqual(filtrarPesquisaCompras(compras, []), []);
});
test('busca ignora acentos e combina termos de campos diferentes', () => {
  assert.deepEqual(filtrarPesquisaCompras(compras, permitidos, { texto: 'joao kalunga' }).map(c => c.id), [1]);
});
test('pendentes inclui parcelas futuras e compras sem comprovante', () => {
  assert.deepEqual(filtrarPesquisaCompras(compras, permitidos, { status: 'pendentes' }).map(c => c.id), [4, 2]);
});
test('valores exibidos nao executam HTML', () => {
  assert.equal(escaparPesquisaCompra('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
