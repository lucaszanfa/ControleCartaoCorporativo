const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./helpers');

function preparar() {
  const clients = [];
  const poolCalls = [];
  class Pool {
    async query(sql) { poolCalls.push(sql); return { rows: [{ id: 9 }], rowCount: 1 }; }
    async connect() {
      const client = { calls: [], released: false, async query(sql, params) {
        this.calls.push({ sql, params });
        await Promise.resolve();
        return { rows: [{ id: 7 }], rowCount: 1 };
      }, release() { this.released = true; } };
      clients.push(client);
      return client;
    }
  }
  const db = carregar('backend/db.js', { pg: { Pool }, './config': { loadEnv() {} } });
  return { db, clients, poolCalls };
}

test('todos os helpers e callbacks aninhados usam uma conexao ate o commit', async () => {
  const { db, clients, poolCalls } = preparar();
  const result = await db.withTransaction(async () => {
    await db.run('INSERT INTO exemplo (valor) VALUES (?)', [10]);
    await db.all('SELECT * FROM exemplo WHERE id = ?', [7]);
    await db.withTransaction(() => db.get('SELECT * FROM exemplo'));
    await db.exec('UPDATE exemplo SET valor = 20');
    return 42;
  });
  assert.equal(result, 42);
  assert.equal(clients.length, 1);
  assert.deepEqual(poolCalls, []);
  const sql = clients[0].calls.map(c => c.sql);
  assert.equal(sql[0], 'BEGIN');
  assert.equal(sql.at(-1), 'COMMIT');
  assert.equal(sql[1], 'INSERT INTO exemplo (valor) VALUES ($1) RETURNING id');
  assert.equal(clients[0].released, true);
  await db.get('SELECT 1');
  assert.deepEqual(poolCalls, ['SELECT 1']);
});

test('falha desfaz a transacao e libera a conexao sem commit', async () => {
  const { db, clients } = preparar();
  await assert.rejects(db.withTransaction(async () => {
    await db.run('UPDATE exemplo SET valor = 1');
    throw new Error('falha injetada');
  }), /falha injetada/);
  assert.equal(clients[0].calls.at(-1).sql, 'ROLLBACK');
  assert.ok(!clients[0].calls.some(c => c.sql === 'COMMIT'));
  assert.equal(clients[0].released, true);
});

test('requisicoes simultaneas mantem contextos de conexao separados', async () => {
  const { db, clients } = preparar();
  await Promise.all([1, 2].map(id => db.withTransaction(async () => {
    await db.get('SELECT ?', [id]);
    await new Promise(resolve => setTimeout(resolve, 5));
    await db.get('SELECT ?', [id]);
  })));
  assert.equal(clients.length, 2);
  for (const client of clients) {
    const reads = client.calls.filter(c => c.params);
    assert.equal(reads.length, 2);
    assert.equal(reads[0].params[0], reads[1].params[0]);
  }
});
