const { initDb, run, get } = require("./db");

const materiais = [
  ["Caneta", "Escritório", "unidade", 1],
  ["Papel", "Escritório", "resma", 1],
  ["Corretivo", "Escritório", "unidade", 1],
  ["Marca-texto", "Escritório", "unidade", 1],
  ["Café", "Copa", "pacote", 1],
  ["Papel toalha", "Limpeza", "pacote", 1],
  ["Detergente", "Limpeza", "unidade", 1],
  ["Bucha", "Limpeza", "unidade", 1],
  ["Papel higiênico", "Limpeza", "pacote", 1],
  ["Bom ar", "Limpeza", "unidade", 1]
];

const setores = ["Administrativo", "Financeiro", "Recursos Humanos", "Compras", "Recepção", "Operações"];

const usuarios = [
  ["Administrador", "admin@sma.com", "admin123", "Administrativo", "ativo", "admin", 1, 1, 1, 1, 1],
  ["Ana Souza", "ana.souza@empresa.com", "123456", "Administrativo", "ativo", "usuario", 0, 1, 1, 1, 0],
  ["Carlos Lima", "carlos.lima@empresa.com", "123456", "Financeiro", "ativo", "usuario", 0, 1, 0, 1, 0],
  ["Marina Costa", "marina.costa@empresa.com", "123456", "Recursos Humanos", "ativo", "usuario", 0, 1, 0, 0, 0],
  ["João Pereira", "joao.pereira@empresa.com", "123456", "Compras", "ativo", "usuario", 1, 1, 1, 1, 0]
];

const saidas = [
  [1, 12, "2026-06-03", "Administrativo", "Ana Souza", "Sala administrativa", "Reposição de mesa", ""],
  [2, 8, "2026-06-04", "Financeiro", "Carlos Lima", "Arquivo fiscal", "Impressão de relatórios", ""],
  [5, 6, "2026-06-05", "Recepção", "Beatriz Rocha", "Copa principal", "Consumo mensal", "Retirada programada"],
  [6, 10, "2026-06-06", "Operações", "Rafael Mendes", "Banheiros", "Reposição", ""],
  [9, 14, "2026-06-07", "Operações", "Rafael Mendes", "Banheiros", "Reposição", ""],
  [4, 5, "2026-06-08", "Recursos Humanos", "Marina Costa", "Sala de treinamento", "Treinamento interno", ""],
  [7, 4, "2026-06-09", "Recepção", "Beatriz Rocha", "Copa principal", "Limpeza", ""],
  [1, 9, "2026-06-10", "Compras", "João Pereira", "Mesa da equipe", "Reposição", ""],
  [10, 3, "2026-06-11", "Administrativo", "Ana Souza", "Salas de reunião", "Manutenção do ambiente", ""],
  [8, 6, "2026-06-12", "Recepção", "Beatriz Rocha", "Copa principal", "Limpeza", ""],
  [2, 6, "2026-05-12", "Administrativo", "Ana Souza", "Impressoras", "Rotina administrativa", ""],
  [5, 4, "2026-05-14", "Recepção", "Beatriz Rocha", "Copa principal", "Consumo mensal", ""],
  [9, 9, "2026-05-18", "Operações", "Rafael Mendes", "Banheiros", "Reposição", ""],
  [3, 3, "2026-05-20", "Financeiro", "Carlos Lima", "Mesa da equipe", "Correção de documentos", ""],
  [7, 5, "2026-04-10", "Recepção", "Beatriz Rocha", "Copa principal", "Limpeza", ""],
  [1, 7, "2026-04-16", "Recursos Humanos", "Marina Costa", "Sala de treinamento", "Treinamento interno", ""]
];

const entradas = [
  [1, 100, 185.00, "2026-06-02", "Compra mensal"],
  [2, 25, 725.00, "2026-06-03", "Reposição de papel A4"],
  [5, 18, 342.00, "2026-06-04", "Copa administrativa"],
  [6, 30, 390.00, "2026-06-05", "Limpeza geral"],
  [9, 24, 456.00, "2026-06-06", "Reposição sanitários"],
  [7, 16, 128.00, "2026-06-08", "Limpeza copa"],
  [4, 40, 220.00, "2026-05-07", "Treinamentos"],
  [2, 20, 580.00, "2026-05-10", "Rotina administrativa"],
  [5, 15, 285.00, "2026-05-12", "Copa"],
  [10, 12, 156.00, "2026-05-18", "Ambientes comuns"],
  [1, 80, 148.00, "2026-04-08", "Reposição inicial"],
  [8, 25, 87.50, "2026-04-11", "Limpeza copa"]
];

async function seed() {
  await initDb();
  const row = await get("SELECT COUNT(*) AS total FROM materiais");

  if (row.total > 0) {
    console.log("Banco já possui dados. Seed ignorado.");
    return;
  }

  for (const material of materiais) {
    await run("INSERT INTO materiais (nome, categoria, unidade, ativo) VALUES (?, ?, ?, ?)", material);
  }

  for (const setor of setores) {
    await run("INSERT INTO setores (nome) VALUES (?)", [setor]);
  }

  for (const usuario of usuarios) {
    await run(
      `INSERT INTO usuarios (
        nome, email, senha, setor, status, perfil,
        pode_cadastrar_material, pode_registrar_saida, pode_registrar_entrada,
        pode_ver_relatorios, pode_administrar_usuarios
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      usuario
    );
  }

  for (const saida of saidas) {
    await run(
      "INSERT INTO saidas (material_id, quantidade, data, setor, responsavel, local_uso, motivo, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      saida
    );
  }

  for (const entrada of entradas) {
    await run(
      "INSERT INTO entradas (material_id, quantidade, valor_total, data, observacao) VALUES (?, ?, ?, ?, ?)",
      entrada
    );
  }

  console.log("Banco criado e populado com dados iniciais.");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 100);
  });
