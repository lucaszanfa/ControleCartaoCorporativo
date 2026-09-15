const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { AsyncLocalStorage } = require("node:async_hooks");
const { loadEnv } = require("./config");

loadEnv();

const schemaPath = path.join(__dirname, "sql", "schema.sql");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const contextoTransacao = new AsyncLocalStorage();

function conexaoAtual() {
  return contextoTransacao.getStore() || pool;
}

// Todos os helpers chamados pelo callback compartilham a mesma conexao.
async function withTransaction(callback) {
  if (contextoTransacao.getStore()) return callback();
  const client = await pool.connect();
  let erroConexao;
  try {
    await client.query("BEGIN");
    const resultado = await contextoTransacao.run(client, callback);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      erroConexao = rollbackError;
    }
    throw error;
  } finally {
    client.release(erroConexao);
  }
}

function paraPlaceholdersPostgres(sql) {
  let indice = 0;
  return sql.replace(/\?/g, () => `$${++indice}`);
}

function precisaRetornarId(sql) {
  return /^\s*insert/i.test(sql) && !/returning/i.test(sql);
}

async function run(sql, params = []) {
  let texto = paraPlaceholdersPostgres(sql);
  if (precisaRetornarId(texto)) {
    texto = `${texto.replace(/;\s*$/, "")} RETURNING id`;
  }

  const resultado = await conexaoAtual().query(texto, params);
  return { id: resultado.rows[0]?.id ?? null, changes: resultado.rowCount };
}

async function all(sql, params = []) {
  const resultado = await conexaoAtual().query(paraPlaceholdersPostgres(sql), params);
  return resultado.rows;
}

async function get(sql, params = []) {
  const resultado = await conexaoAtual().query(paraPlaceholdersPostgres(sql), params);
  return resultado.rows[0];
}

async function exec(sql) {
  await conexaoAtual().query(sql);
}

async function initDb() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  await exec(schema);
  await ensureBancosSeed();
}

async function ensureBancosSeed() {
  const existentes = await get("SELECT COUNT(*) AS total FROM bancos");
  if (Number(existentes.total) > 0) return;

  const padrao = ["Inter", "Bradesco"];
  for (const nome of padrao) {
    await run("INSERT INTO bancos (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING", [nome]);
  }
}

async function ensureCartaoBancoSeed() {
  const vinculos = [
    ["Cartão Administrativo", "Inter"],
    ["Cartão Limpeza/Copa", "Bradesco"]
  ];

  for (const [nomeCartao, nomeBanco] of vinculos) {
    await run(
      `UPDATE cartoes_corporativos
       SET banco_id = (SELECT id FROM bancos WHERE nome = ?)
       WHERE nome_cartao = ? AND banco_id IS NULL`,
      [nomeBanco, nomeCartao]
    );
  }
}

module.exports = {
  pool,
  withTransaction,
  run,
  all,
  get,
  exec,
  initDb,
  ensureCartaoBancoSeed
};
