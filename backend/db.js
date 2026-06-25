const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "database.sqlite");
const schemaPath = path.join(__dirname, "sql", "schema.sql");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function initDb() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  await exec(schema);
  await ensureMateriaisColumns();
  await ensureUsuarioColumns();
  await ensureComprasCartaoNullableFields();
}

async function ensureMateriaisColumns() {
  const columns = await all("PRAGMA table_info(materiais)");
  const names = columns.map((column) => column.name);

  if (!names.includes("unidades_por_caixa")) {
    await run("ALTER TABLE materiais ADD COLUMN unidades_por_caixa INTEGER NOT NULL DEFAULT 1");
  }
}

async function ensureUsuarioColumns() {
  const columns = await all("PRAGMA table_info(usuarios)");
  const names = columns.map((column) => column.name);
  const additions = [
    ["senha", "TEXT NOT NULL DEFAULT '123456'"],
    ["status", "TEXT NOT NULL DEFAULT 'pendente'"],
    ["perfil", "TEXT NOT NULL DEFAULT 'usuario'"],
    ["pode_cadastrar_material", "INTEGER NOT NULL DEFAULT 0"],
    ["pode_registrar_saida", "INTEGER NOT NULL DEFAULT 0"],
    ["pode_registrar_entrada", "INTEGER NOT NULL DEFAULT 0"],
    ["pode_ver_relatorios", "INTEGER NOT NULL DEFAULT 0"],
    ["pode_administrar_usuarios", "INTEGER NOT NULL DEFAULT 0"]
  ];

  for (const [name, definition] of additions) {
    if (!names.includes(name)) {
      await run(`ALTER TABLE usuarios ADD COLUMN ${name} ${definition}`);
    }
  }
}

async function ensureComprasCartaoNullableFields() {
  const columns = await all("PRAGMA table_info(compras_cartao)");
  const responsavel = columns.find((column) => column.name === "responsavel_compra_id");
  const categoria = columns.find((column) => column.name === "categoria");
  const motivo = columns.find((column) => column.name === "motivo");

  if (!responsavel || (responsavel.notnull === 0 && categoria?.notnull === 0 && motivo?.notnull === 0)) {
    return;
  }

  await exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE IF NOT EXISTS compras_cartao_migracao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cartao_id INTEGER NOT NULL,
      departamento_id INTEGER NOT NULL,
      responsavel_compra_id INTEGER,
      data_compra TEXT NOT NULL,
      valor REAL NOT NULL CHECK (valor > 0),
      fornecedor TEXT NOT NULL,
      categoria TEXT CHECK (categoria IS NULL OR categoria = '' OR categoria IN ('material_administrativo', 'copa', 'limpeza', 'manutencao', 'transporte', 'servicos', 'outros')),
      motivo TEXT,
      comprovante_url TEXT,
      observacao TEXT,
      status TEXT NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada', 'aguardando_conferencia', 'conferida', 'divergente', 'sem_comprovante', 'resolvida', 'cancelada')),
      criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cartao_id) REFERENCES cartoes_corporativos(id),
      FOREIGN KEY (departamento_id) REFERENCES setores(id),
      FOREIGN KEY (responsavel_compra_id) REFERENCES usuarios(id)
    );

    INSERT INTO compras_cartao_migracao (
      id, cartao_id, departamento_id, responsavel_compra_id, data_compra, valor, fornecedor,
      categoria, motivo, comprovante_url, observacao, status, criado_em, atualizado_em
    )
    SELECT
      id, cartao_id, departamento_id, responsavel_compra_id, data_compra, valor, fornecedor,
      categoria, motivo, comprovante_url, observacao, status, criado_em, atualizado_em
    FROM compras_cartao;

    DROP TABLE compras_cartao;
    ALTER TABLE compras_cartao_migracao RENAME TO compras_cartao;

    PRAGMA foreign_keys = ON;
  `);
}

module.exports = {
  db,
  dbPath,
  run,
  all,
  get,
  exec,
  initDb
};
