const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./helpers');

// Executa o handler real com armazenamento em memoria; nenhuma conexao externa.
function preparar({ compras = 1, transacoes = 2, vinculoAnterior = false, falharAlerta = false } = {}) {
  let state = {
    compras: Array.from({ length: compras }, (_, i) => ({ id: i + 1, cartao_id: 1, valor: 100, data_compra: '2026-09-10', fornecedor: 'Kalunga', status: 'registrada', comprovante_url: 'teste.pdf' })),
    transacoes: Array.from({ length: transacoes }, (_, i) => ({ id: i + 1, fatura_id: 1, cartao_id: 1, valor: 100, data_transacao: '2026-09-10', estabelecimento: 'Kalunga', status_conciliacao: 'pendente' })),
    vinculos: vinculoAnterior ? [{ id: 9, transacao_fatura_id: 90, compra_cartao_id: 1, status: 'conciliada' }] : [],
    alertas: [], faturaStatus: 'importada'
  };
  const db = {
    initDb: () => new Promise(() => {}),
    async withTransaction(fn) {
      const antes = structuredClone(state);
      try { return await fn(); } catch (error) { state = antes; throw error; }
    },
    async exec() {},
    async get(sql, params = []) {
      if (sql.includes('GROUP BY transacao_fatura_id')) return undefined;
      if (sql.startsWith('SELECT id FROM faturas_cartao')) return Number(params[0]) === 1 ? { id: 1 } : undefined;
      if (sql.includes('COUNT(*)::int AS total FROM transacoes_fatura')) return { total: state.transacoes.filter(t => t.status_conciliacao !== 'conciliada').length };
      if (sql.includes('FROM conciliacoes_cartao WHERE transacao_fatura_id')) return state.vinculos.find(v => v.transacao_fatura_id === params[0]);
      if (sql.includes('FROM conciliacoes_cartao WHERE compra_cartao_id')) return state.vinculos.find(v => v.compra_cartao_id === params[0]);
      if (sql.includes('FROM compras_cartao cc')) return state.compras.find(c => c.id === params[0]);
      if (sql.startsWith('SELECT * FROM transacoes_fatura')) return state.transacoes.find(t => t.id === params[0]);
      throw Error('GET nao previsto: ' + sql);
    },
    async all(sql, params) {
      if (sql.startsWith('SELECT * FROM compras_cartao WHERE id')) return state.compras.filter(c => c.id === params[0] && c.status !== 'cancelada');
      if (sql.includes('SELECT cc.* FROM compras_cartao cc')) return state.compras.filter(c => c.cartao_id === params[0] && c.status !== 'cancelada' && !state.vinculos.some(v => v.compra_cartao_id === c.id));
      if (sql.includes('AS "transacaoId"')) return state.transacoes.filter(t => t.status_conciliacao !== 'conciliada').map(t => {
        const v = state.vinculos.find(v => v.transacao_fatura_id === t.id);
        return { transacaoId: t.id, compraId: v?.compra_cartao_id, observacaoConciliacao: v?.observacao, status: t.status_conciliacao };
      });
      if (sql.includes("t.status_conciliacao IN ('pendente', 'sem_registro')")) return state.transacoes.filter(t => ['pendente', 'sem_registro'].includes(t.status_conciliacao) && !state.vinculos.some(v => v.transacao_fatura_id === t.id && v.compra_cartao_id));
      if (sql.includes('FROM transacoes_fatura t')) return state.transacoes;
      throw Error('ALL nao previsto: ' + sql);
    },
    async run(sql, params) {
      if (sql.startsWith('INSERT INTO conciliacoes_cartao')) {
        state.vinculos.push({ id: state.vinculos.length + 1, transacao_fatura_id: params[0], compra_cartao_id: params[1], status: params[3], observacao: params[6] });
      } else if (sql.startsWith('UPDATE conciliacoes_cartao SET compra_cartao_id')) {
        Object.assign(state.vinculos.find(v => v.id === params.at(-1)), { compra_cartao_id: params[0], status: params[1], observacao: params[4] });
      } else if (sql.startsWith('UPDATE transacoes_fatura')) {
        state.transacoes.find(t => t.id === params[1]).status_conciliacao = params[0];
      } else if (sql.startsWith('UPDATE compras_cartao')) {
        const fixa = sql.includes("status = 'conferida'");
        state.compras.find(c => c.id === params[fixa ? 0 : 1]).status = fixa ? 'conferida' : params[0];
      } else if (sql.startsWith('UPDATE faturas_cartao')) {
        state.faturaStatus = params[0];
      } else if (!sql.trim().startsWith('UPDATE alertas_cartao')) throw Error('RUN nao previsto: ' + sql);
      return { id: 1, changes: 1 };
    }
  };
  const conciliacao = carregar('backend/conciliacao.js', { './db': db });
  const routes = {};
  const app = { use() {}, get() {}, put() {}, patch() {}, delete() {}, post(path, handler) { routes[path] = handler; } };
  const express = Object.assign(() => app, { json() {}, static() {} });
  const server = carregar('backend/server.js', {
    express, cors: () => undefined, 'pdf-parse': {}, './db': db,
    './config': { loadEnv() {} }, './conciliacao': conciliacao,
    './teamsNotificationService': { sendTeamsAlert: () => { throw Error('envio externo proibido'); } },
    'test-alert': async payload => { if (falharAlerta) throw Error('falha injetada'); state.alertas.push(payload); }
  }, '; criarAlertaCartao = require("test-alert"); module.exports = { tentarAtualizarPendenciaPorCompra };');
  async function conciliar(id = 1) {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
    await routes['/api/conciliacoes-cartao/rodar/:faturaId']({ params: { faturaId: id }, body: {} }, response);
    return response;
  }
  return { state: () => state, conciliar, manual: server.tentarAtualizarPendenciaPorCompra };
}

test('uma compra e duas transacoes: so uma recebe o vinculo, inclusive ao reexecutar', async () => {
  const app = preparar();
  const result = await app.conciliar();
  assert.equal(result.code, 200);
  assert.equal(app.state().vinculos.filter(v => v.compra_cartao_id).length, 1);
  assert.equal(app.state().transacoes[1].status_conciliacao, 'sem_registro');
  await app.conciliar();
  assert.equal(app.state().vinculos.length, 2);
  assert.equal(app.state().vinculos.filter(v => v.compra_cartao_id).length, 1);
});

test('duas compras iguais: ambas as transacoes ficam ambiguas e sem vinculo', async () => {
  const app = preparar({ compras: 2 });
  const result = await app.conciliar();
  assert.equal(result.data.ambiguas, 2);
  assert.ok(app.state().vinculos.every(v => v.compra_cartao_id === null));
  assert.ok(result.data.pendencias.every(p => p.observacaoConciliacao.includes('Mais de uma compra')));
});

test('compra vinculada em outra fatura nao e reutilizada', async () => {
  const app = preparar({ vinculoAnterior: true });
  await app.conciliar();
  assert.equal(app.state().vinculos.filter(v => v.compra_cartao_id).length, 1);
  assert.ok(app.state().transacoes.every(t => t.status_conciliacao === 'sem_registro'));
});

test('falha durante alerta desfaz compras, transacoes, vinculos e fatura', async () => {
  const app = preparar({ falharAlerta: true });
  const antes = structuredClone(app.state());
  const result = await app.conciliar();
  assert.equal(result.code, 500);
  assert.deepEqual(app.state(), antes);
});

test('vinculo manual explicito resolve ambiguidade e impede reutilizacao', async () => {
  const app = preparar({ compras: 2 });
  await app.conciliar();
  const result = await app.manual(1, 2);
  assert.equal(result.atualizada, true);
  assert.equal(app.state().vinculos.find(v => v.transacao_fatura_id === 2).compra_cartao_id, 1);
  const repetido = await app.manual(1, 1);
  assert.equal(repetido.atualizada, false);
  await app.conciliar();
  assert.equal(app.state().vinculos.find(v => v.transacao_fatura_id === 1).compra_cartao_id, 2);
});

test('manual sem escolha explicita nao escolhe primeira entre duas pendencias', async () => {
  const app = preparar();
  const result = await app.manual(1);
  assert.equal(result.atualizada, false);
  assert.equal(app.state().vinculos.length, 0);
});

test('fatura inexistente retorna 404', async () => {
  const app = preparar();
  assert.equal((await app.conciliar(999)).code, 404);
});

test('reprocessar apos anexar comprovante atualiza o status sem trocar o vinculo', async () => {
  const app = preparar({ transacoes: 1 });
  app.state().compras[0].comprovante_url = '';
  await app.conciliar();
  assert.equal(app.state().vinculos[0].status, 'aguardando_comprovante');
  app.state().compras[0].comprovante_url = 'novo.pdf';
  await app.conciliar();
  assert.equal(app.state().vinculos.length, 1);
  assert.equal(app.state().vinculos[0].compra_cartao_id, 1);
  assert.equal(app.state().vinculos[0].status, 'conciliada');
});
