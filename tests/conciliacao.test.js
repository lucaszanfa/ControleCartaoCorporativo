const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./helpers');
const { selecionarCorrespondencia } = carregar('backend/conciliacao.js', { './db': {} });
const helpers = {
  daysDiff: (a,b) => (Date.parse(a) - Date.parse(b)) / 86400000,
  similarText: (a,b) => a.toLowerCase() === b.toLowerCase()
};
const transacao = { valor: 100, data_transacao: '2026-09-10', estabelecimento: 'Kalunga' };
const compra = { id: 1, valor: 100, data_compra: '2026-09-10', fornecedor: 'Kalunga', comprovante_url: 'teste.pdf' };

test('correspondencia unica com e sem comprovante', () => {
  assert.equal(selecionarCorrespondencia(transacao, [compra], helpers).status, 'conciliada');
  assert.equal(selecionarCorrespondencia(transacao, [{ ...compra, comprovante_url: '' }], helpers).status, 'aguardando_comprovante');
});
test('compras indistinguiveis ficam pendentes sem vinculo', () => {
  const result = selecionarCorrespondencia(transacao, [compra, { ...compra, id: 2 }], helpers);
  assert.equal(result.compra, null);
  assert.equal(result.ambigua, true);
  assert.equal(result.status, 'sem_registro');
});
test('correspondencia exata prevalece sobre sugestoes divergentes', () => {
  const result = selecionarCorrespondencia(transacao, [{ ...compra, id: 2, valor: 120 }, compra], helpers);
  assert.equal(result.compra.id, 1);
});
test('preserva criterios de divergencia sem conciliar automaticamente', () => {
  assert.equal(selecionarCorrespondencia(transacao, [{ ...compra, valor: 120 }], helpers).status, 'valor_divergente');
  assert.equal(selecionarCorrespondencia(transacao, [{ ...compra, data_compra: '2026-09-01' }], helpers).status, 'data_divergente');
  assert.equal(selecionarCorrespondencia(transacao, [], helpers).status, 'sem_registro');
});
test('duas sugestoes divergentes tambem exigem conferencia', () => {
  const result = selecionarCorrespondencia(transacao, [{ ...compra, valor: 120 }, { ...compra, id: 2, valor: 130 }], helpers);
  assert.equal(result.ambigua, true);
  assert.equal(result.compra, null);
});

test('dados antigos duplicados bloqueiam a operacao sem apagar vinculos', async () => {
  const calls = [];
  const db = { withTransaction: fn => fn(), exec: async sql => calls.push(sql), get: async () => ({ duplicada: 1 }) };
  const { withConciliacao } = carregar('backend/conciliacao.js', { './db': db });
  await assert.rejects(withConciliacao(() => assert.fail('nao deve conciliar')), error => error.status === 409);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /LOCK TABLE/);
});

test('instala unicidade de compra e transacao apos conferir o legado', async () => {
  const calls = [];
  const db = { withTransaction: fn => fn(), exec: async sql => calls.push(sql), get: async () => undefined };
  const { withConciliacao } = carregar('backend/conciliacao.js', { './db': db });
  await withConciliacao(() => calls.push('callback'));
  assert.match(calls[1], /UNIQUE INDEX.*transacao_fatura_id/);
  assert.match(calls[2], /UNIQUE INDEX.*compra_cartao_id.*IS NOT NULL/);
  assert.equal(calls.at(-1), 'callback');
});
