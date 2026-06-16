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
  await ensureUsuarioColumns();
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

module.exports = {
  db,
  dbPath,
  run,
  all,
  get,
  exec,
  initDb
};
