const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAtualizadorLancamento, mapLancamento } = require('../backend/lancamentoCompra');

function preparar({ ativo = true, permitido = true, falhaAuditoria = false } = {}) {
  let compras = [1, 2].map(id => ({ id, cartao_id: 10, status: 'conferida', parcela_atual: id, parcela_total: 6, lancado_externamente: false, lancamento_versao: 0 }));
  let logs = [];
  const db = {
    async withTransaction(fn) {
      const anterior = structuredClone({ compras, logs });
      try { return await fn(); } catch (error) { compras = anterior.compras; logs = anterior.logs; throw error; }
    },
    async get(sql, params) {
      if (sql.startsWith('SELECT id, nome, status FROM usuarios')) return { id: 7, nome: 'Ana', status: ativo ? 'ativo' : 'inativo' };
      if (sql.startsWith('SELECT nome FROM usuarios')) return { nome: 'Ana' };
      if (sql.startsWith('SELECT * FROM compras_cartao')) return structuredClone(compras.find(c => c.id === params[0]));
      if (sql.startsWith('UPDATE compras_cartao')) {
        const compra = compras.find(c => c.id === params[2]);
        compra.lancado_externamente = params[0];
        compra.lancamento_atualizado_por_id = params[1];
        compra.lancamento_atualizado_em = '2026-09-15T12:00:00Z';
        compra.lancamento_versao += 1;
        return structuredClone(compra);
      }
      throw new Error('SQL nao previsto: ' + sql);
    }
  };
  const atualizar = criarAtualizadorLancamento({ db,
    cartoesPermitidosParaUsuario: async (_, tipo) => { assert.equal(tipo, 'cadastrar'); return permitido ? [10] : []; },
    registrarAuditoria: async log => { if (falhaAuditoria) throw new Error('falha auditoria'); logs.push(log); }
  });
  return { atualizar, compras: () => compras, logs: () => logs };
}
const pedido = { compraId: 1, usuarioId: 7, lancado: true, versao: 0 };

test('marca e desmarca com autoria, sem alterar conciliacao ou outras parcelas', async () => {
  const app = preparar();
  const marcado = await app.atualizar(pedido);
  assert.equal(marcado.lancadoExternamente, true);
  assert.equal(marcado.lancamentoAtualizadoPor, 'Ana');
  assert.equal(marcado.lancamentoVersao, 1);
  assert.equal(app.compras()[0].status, 'conferida');
  assert.equal(app.compras()[1].lancado_externamente, false);
  const desmarcado = await app.atualizar({ ...pedido, lancado: false, versao: 1 });
  assert.equal(desmarcado.lancadoExternamente, false);
  assert.equal(desmarcado.lancamentoVersao, 2);
  assert.equal(app.logs().length, 2);
});

test('repetir estado atual nao cria auditoria nem altera autoria', async () => {
  const app = preparar();
  await app.atualizar(pedido);
  const repetido = await app.atualizar({ ...pedido, versao: 1 });
  assert.equal(repetido.lancamentoVersao, 1);
  assert.equal(app.logs().length, 1);
});

test('versao antiga nao sobrescreve marcacao de outro usuario', async () => {
  const app = preparar();
  await app.atualizar(pedido);
  await assert.rejects(app.atualizar({ ...pedido, lancado: false }), e => e.status === 409);
  assert.equal(app.compras()[0].lancado_externamente, true);
});

test('usuario sem permissao ou inativo nao altera a compra', async () => {
  for (const options of [{ permitido: false }, { ativo: false }]) {
    const app = preparar(options);
    await assert.rejects(app.atualizar(pedido), e => e.status === 403);
    assert.equal(app.compras()[0].lancado_externamente, false);
    assert.equal(app.logs().length, 0);
  }
});

test('entrada invalida e compra inexistente sao rejeitadas', async () => {
  const app = preparar();
  await assert.rejects(app.atualizar({ ...pedido, lancado: 'true' }), e => e.status === 400);
  await assert.rejects(app.atualizar({ ...pedido, usuarioId: 0 }), e => e.status === 400);
  await assert.rejects(app.atualizar({ ...pedido, versao: -1 }), e => e.status === 400);
  await assert.rejects(app.atualizar({ ...pedido, compraId: 999 }), e => e.status === 404);
});

test('falha na auditoria desfaz a marcacao', async () => {
  const app = preparar({ falhaAuditoria: true });
  await assert.rejects(app.atualizar(pedido), /falha auditoria/);
  assert.equal(app.compras()[0].lancado_externamente, false);
  assert.equal(app.compras()[0].lancamento_versao, 0);
});

test('compras sem marcacao mapeiam como nao lancadas', () => {
  assert.equal(mapLancamento({ id: 1 }).lancadoExternamente, false);
  assert.equal(mapLancamento({ id: 1 }).lancamentoVersao, 0);
});
