const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { loadEnv } = require("./config");
const { initDb, all, get, run } = require("./db");
const { sendTeamsAlert } = require("./teamsNotificationService");

loadEnv();

const app = express();
const port = process.env.PORT || 3010;
const host = process.env.HOST || "0.0.0.0";
const publicDir = path.join(__dirname, "..");

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.static(publicDir));

function mapSaida(row) {
  return {
    id: row.id,
    materialId: row.material_id,
    quantidade: row.quantidade,
    data: row.data,
    setor: row.setor,
    responsavel: row.responsavel,
    localUso: row.local_uso || "",
    motivo: row.motivo || "",
    observacao: row.observacao || ""
  };
}

function mapEntrada(row) {
  return {
    id: row.id,
    materialId: row.material_id,
    quantidade: row.quantidade,
    valorTotal: row.valor_total,
    data: row.data,
    observacao: row.observacao || ""
  };
}

function mapUsuario(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    setor: row.setor,
    status: row.status || "pendente",
    perfil: row.perfil || "usuario",
    permissoes: {
      cadastrarMaterial: Boolean(row.pode_cadastrar_material),
      registrarSaida: Boolean(row.pode_registrar_saida),
      registrarEntrada: Boolean(row.pode_registrar_entrada),
      verRelatorios: Boolean(row.pode_ver_relatorios),
      administrarUsuarios: Boolean(row.pode_administrar_usuarios)
    }
  };
}

async function ensureAdminUser() {
  const admin = await get("SELECT id FROM usuarios WHERE email = ?", ["admin@sma.com"]);

  if (!admin) {
    await run(
      `INSERT INTO usuarios (
        nome, email, senha, setor, status, perfil,
        pode_cadastrar_material, pode_registrar_saida, pode_registrar_entrada,
        pode_ver_relatorios, pode_administrar_usuarios
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Administrador", "admin@sma.com", "admin123", "Administrativo", "ativo", "admin", 1, 1, 1, 1, 1]
    );
    return;
  }

  await run(
    `UPDATE usuarios
     SET status = 'ativo',
         perfil = 'admin',
         pode_cadastrar_material = 1,
         pode_registrar_saida = 1,
         pode_registrar_entrada = 1,
         pode_ver_relatorios = 1,
         pode_administrar_usuarios = 1
     WHERE email = ?`,
    ["admin@sma.com"]
  );
}

async function ensureCartoesSeed() {
  const row = await get("SELECT COUNT(*) AS total FROM cartoes_corporativos");
  if (row.total > 0) return;

  const admin = await get("SELECT id FROM usuarios WHERE email = ?", ["admin@sma.com"]);
  await run("INSERT OR IGNORE INTO setores (nome) VALUES ('Administrativo')");
  await run("INSERT OR IGNORE INTO setores (nome) VALUES ('Copa')");

  const ana = await get("SELECT id FROM usuarios WHERE email = ?", ["ana.pereira@sma.com"]);
  if (!ana) {
    await run(
      "INSERT INTO usuarios (nome, email, senha, setor, status, perfil, pode_registrar_saida, pode_registrar_entrada, pode_ver_relatorios) VALUES (?, ?, ?, ?, 'ativo', 'usuario', 1, 1, 1)",
      ["Ana Pereira", "ana.pereira@sma.com", "123456", "Copa"]
    );
  }
  const maria = await get("SELECT id FROM usuarios WHERE email = ?", ["maria.souza@sma.com"]);
  if (!maria) {
    await run(
      "INSERT INTO usuarios (nome, email, senha, setor, status, perfil, pode_registrar_saida, pode_registrar_entrada, pode_ver_relatorios) VALUES (?, ?, ?, ?, 'ativo', 'usuario', 1, 1, 1)",
      ["Maria Souza", "maria.souza@sma.com", "123456", "Administrativo"]
    );
  }

  const administrativo = await get("SELECT id FROM setores WHERE nome = ?", ["Administrativo"]);
  const copa = await get("SELECT id FROM setores WHERE nome = ?", ["Copa"]);
  const gerente = await get("SELECT id FROM usuarios WHERE email = ?", ["carlos.lima@empresa.com"]);
  const mariaAtual = await get("SELECT id FROM usuarios WHERE email = ?", ["maria.souza@sma.com"]);
  const anaAtual = await get("SELECT id FROM usuarios WHERE email = ?", ["ana.pereira@sma.com"]);
  const gerenteId = gerente?.id || admin.id;

  const cartaoAdm = await run(
    "INSERT INTO cartoes_corporativos (nome_cartao, departamento_id, responsavel_id, gerente_id, ultimos_4_digitos, limite_mensal, status, observacao) VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)",
    ["Cartão Administrativo", administrativo.id, mariaAtual.id, gerenteId, "4821", 2000, "Uso administrativo geral"]
  );
  const cartaoCopa = await run(
    "INSERT INTO cartoes_corporativos (nome_cartao, departamento_id, responsavel_id, gerente_id, ultimos_4_digitos, limite_mensal, status, observacao) VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)",
    ["Cartão Limpeza/Copa", copa.id, anaAtual.id, gerenteId, "9134", 1500, "Compras de copa e limpeza"]
  );

  await run(
    "INSERT INTO compras_cartao (cartao_id, departamento_id, responsavel_compra_id, data_compra, valor, fornecedor, categoria, motivo, comprovante_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [cartaoAdm.id, administrativo.id, mariaAtual.id, "2026-06-15", 86.90, "Supermercado BH", "copa", "Compra de café e papel toalha", "comprovante-supermercado.pdf", "registrada"]
  );
  await run(
    "INSERT INTO compras_cartao (cartao_id, departamento_id, responsavel_compra_id, data_compra, valor, fornecedor, categoria, motivo, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [cartaoAdm.id, administrativo.id, mariaAtual.id, "2026-06-16", 132.50, "Kalunga", "material_administrativo", "Compra de papel e canetas", "aguardando_conferencia"]
  );

  const fatura = await run(
    "INSERT INTO faturas_cartao (cartao_id, mes_referencia, ano_referencia, arquivo_nome, importado_por_id, status, observacao) VALUES (?, 6, 2026, ?, ?, 'importada', ?)",
    [cartaoAdm.id, "fatura-exemplo-junho.csv", admin.id, "Seed inicial"]
  );
  const transacoes = [
    ["2026-06-15", "Supermercado BH", 86.90, "4821", "AUT001", "copa"],
    ["2026-06-16", "Kalunga", 132.50, "4821", "AUT002", "material_administrativo"],
    ["2026-06-18", "Posto Avenida", 210.00, "4821", "AUT003", "transporte"]
  ];
  for (const transacao of transacoes) {
    await run(
      "INSERT INTO transacoes_fatura (fatura_id, cartao_id, data_transacao, estabelecimento, valor, ultimos_4_digitos, codigo_autorizacao, categoria_detectada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [fatura.id, cartaoAdm.id, ...transacao]
    );
  }
  await run(
    "INSERT INTO compras_cartao (cartao_id, departamento_id, responsavel_compra_id, data_compra, valor, fornecedor, categoria, motivo, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [cartaoCopa.id, copa.id, anaAtual.id, "2026-06-13", 54.30, "Mercado Central", "limpeza", "Compra de materiais de limpeza", "sem_comprovante"]
  );
}

function validateLast4(value) {
  return /^\d{4}$/.test(String(value || ""));
}

function assertNoSensitiveCardData(payload) {
  const joined = Object.values(payload).join(" ");
  if (/\b\d{12,19}\b/.test(joined)) {
    throw new Error("Não informe número completo do cartão. Use apenas os últimos 4 dígitos.");
  }
  if (/\bcvv\b/i.test(joined) || /\b\d{3,4}\b/.test(String(payload.cvv || ""))) {
    throw new Error("Não informe CVV ou dados sensíveis do cartão.");
  }
}

function safeFilePart(value) {
  return String(value || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "arquivo";
}

function monthFolder(value) {
  const text = String(value || new Date().toISOString().slice(0, 10));
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (!match) return new Date().toISOString().slice(0, 7);
  return `${match[1]}-${match[2]}`;
}

function extensionFromMime(mimeType, originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return ext;
  const map = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
  };
  return map[mimeType] || "";
}

function mapCartao(row) {
  return {
    id: row.id,
    nomeCartao: row.nome_cartao,
    departamentoId: row.departamento_id,
    departamento: row.departamento,
    responsavelId: row.responsavel_id,
    responsavel: row.responsavel,
    gerenteId: row.gerente_id,
    gerente: row.gerente,
    ultimos4Digitos: row.ultimos_4_digitos,
    limiteMensal: row.limite_mensal,
    status: row.status,
    observacao: row.observacao || ""
  };
}

function mapCompraCartao(row) {
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    cartao: row.cartao,
    ultimos4Digitos: row.ultimos_4_digitos,
    departamentoId: row.departamento_id,
    departamento: row.departamento,
    responsavelCompraId: row.responsavel_compra_id,
    responsavel: row.responsavel,
    dataCompra: row.data_compra,
    valor: row.valor,
    fornecedor: row.fornecedor,
    categoria: row.categoria,
    motivo: row.motivo,
    comprovanteUrl: row.comprovante_url || "",
    observacao: row.observacao || "",
    status: row.status
  };
}

function cardJoinSql() {
  return `SELECT c.*, s.nome AS departamento, r.nome AS responsavel, g.nome AS gerente
          FROM cartoes_corporativos c
          JOIN setores s ON s.id = c.departamento_id
          JOIN usuarios r ON r.id = c.responsavel_id
          JOIN usuarios g ON g.id = c.gerente_id`;
}

function compraJoinSql() {
  return `SELECT cc.*, c.nome_cartao AS cartao, c.ultimos_4_digitos, s.nome AS departamento, u.nome AS responsavel
          FROM compras_cartao cc
          JOIN cartoes_corporativos c ON c.id = cc.cartao_id
          JOIN setores s ON s.id = cc.departamento_id
          LEFT JOIN usuarios u ON u.id = cc.responsavel_compra_id`;
}

function daysDiff(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}

function similarText(a, b) {
  const left = String(a || "").toLowerCase();
  const right = String(b || "").toLowerCase();
  return left.includes(right.slice(0, 5)) || right.includes(left.slice(0, 5));
}

async function criarAlertaCartao({ cartaoId, departamentoId, gerenteId, transacaoId, compraId, tipo, mensagem }) {
  const existente = await get(
    "SELECT id FROM alertas_cartao WHERE tipo_alerta = ? AND ifnull(transacao_fatura_id, 0) = ifnull(?, 0) AND ifnull(compra_cartao_id, 0) = ifnull(?, 0) AND status != 'resolvido'",
    [tipo, transacaoId || null, compraId || null]
  );
  if (existente) return existente.id;
  const result = await run(
    "INSERT INTO alertas_cartao (cartao_id, departamento_id, gerente_id, transacao_fatura_id, compra_cartao_id, tipo_alerta, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [cartaoId, departamentoId, gerenteId, transacaoId || null, compraId || null, tipo, mensagem]
  );
  return result.id;
}

function mensagemAlerta(tipo, departamento, cartao, ultimos4, data, estabelecimento, valor) {
  return `⚠️ Alerta de inconsistência em cartão corporativo

Foi identificada uma inconsistência relacionada a uma compra no cartão corporativo.

Tipo: ${tipo}
Departamento: ${departamento}
Cartão: ${cartao} final ${ultimos4}
Data da compra: ${data}
Estabelecimento: ${estabelecimento}
Valor: ${valor}

Ação sugerida:
Verificar com o responsável pelo cartão e solicitar registro, justificativa ou comprovante.`;
}

async function criarAlertaCompraSemComprovante(compraId) {
  const compra = await get(
    `SELECT cc.*, c.nome_cartao, c.ultimos_4_digitos, c.gerente_id, s.nome AS departamento
     FROM compras_cartao cc
     JOIN cartoes_corporativos c ON c.id = cc.cartao_id
     JOIN setores s ON s.id = cc.departamento_id
     WHERE cc.id = ?`,
    [compraId]
  );

  if (!compra || compra.comprovante_url) return null;

  return criarAlertaCartao({
    cartaoId: compra.cartao_id,
    departamentoId: compra.departamento_id,
    gerenteId: compra.gerente_id,
    transacaoId: null,
    compraId: compra.id,
    tipo: "compra_sem_comprovante",
    mensagem: mensagemAlerta(
      "compra_sem_comprovante",
      compra.departamento,
      compra.nome_cartao,
      compra.ultimos_4_digitos,
      compra.data_compra,
      compra.fornecedor,
      compra.valor
    )
  });
}

async function ensureAlertasComprasSemComprovante() {
  const compras = await all(
    `SELECT cc.id
     FROM compras_cartao cc
     LEFT JOIN alertas_cartao a
       ON a.compra_cartao_id = cc.id
      AND a.tipo_alerta = 'compra_sem_comprovante'
      AND a.status != 'resolvido'
     WHERE cc.status = 'sem_comprovante'
       AND ifnull(cc.comprovante_url, '') = ''
       AND a.id IS NULL`
  );

  for (const compra of compras) {
    await criarAlertaCompraSemComprovante(compra.id);
  }
}

async function buscarPendenciasCompativeisCompra(compra) {
  const transacoes = await all(
    `SELECT t.*, c.nome_cartao AS cartao, s.nome AS departamento
     FROM transacoes_fatura t
     JOIN cartoes_corporativos c ON c.id = t.cartao_id
     JOIN setores s ON s.id = c.departamento_id
     LEFT JOIN conciliacoes_cartao co ON co.transacao_fatura_id = t.id
     WHERE t.cartao_id = ?
       AND t.status_conciliacao IN ('pendente', 'sem_registro')
       AND (co.id IS NULL OR co.status = 'sem_registro')
     ORDER BY ABS(julianday(t.data_transacao) - julianday(?)) ASC, t.id ASC`,
    [compra.cartao_id, compra.data_compra]
  );

  return transacoes.filter((transacao) => (
    Number(transacao.valor) === Number(compra.valor)
    && Math.abs(daysDiff(transacao.data_transacao, compra.data_compra)) <= 2
    && similarText(transacao.estabelecimento, compra.fornecedor)
  )).map((transacao) => ({
    id: transacao.id,
    dataTransacao: transacao.data_transacao,
    estabelecimento: transacao.estabelecimento,
    valor: transacao.valor,
    cartao: transacao.cartao,
    departamento: transacao.departamento,
    statusConciliacao: transacao.status_conciliacao
  }));
}

async function tentarAtualizarPendenciaPorCompra(compraId, transacaoId = null) {
  const compra = await get(
    `SELECT cc.*, c.gerente_id
     FROM compras_cartao cc
     JOIN cartoes_corporativos c ON c.id = cc.cartao_id
     WHERE cc.id = ?`,
    [compraId]
  );

  if (!compra) return { atualizada: false };

  const candidatas = await buscarPendenciasCompativeisCompra(compra);
  const candidataResumo = transacaoId
    ? candidatas.find((transacao) => Number(transacao.id) === Number(transacaoId))
    : candidatas[0];

  if (!candidataResumo) return { atualizada: false };

  const candidata = await get("SELECT * FROM transacoes_fatura WHERE id = ?", [candidataResumo.id]);

  const status = compra.comprovante_url ? "conciliada" : "aguardando_comprovante";
  const diferencaValor = Number((candidata.valor - compra.valor).toFixed(2));
  const diferencaDias = daysDiff(candidata.data_transacao, compra.data_compra);
  const conciliacao = await get("SELECT id FROM conciliacoes_cartao WHERE transacao_fatura_id = ?", [candidata.id]);

  if (conciliacao) {
    await run(
      "UPDATE conciliacoes_cartao SET compra_cartao_id = ?, status = ?, diferenca_valor = ?, diferenca_dias = ?, observacao = ?, conciliado_em = CURRENT_TIMESTAMP WHERE id = ?",
      [compra.id, status, diferencaValor, diferencaDias, "Atualizada automaticamente apos registro da compra", conciliacao.id]
    );
  } else {
    await run(
      "INSERT INTO conciliacoes_cartao (transacao_fatura_id, compra_cartao_id, cartao_id, status, diferenca_valor, diferenca_dias, observacao, conciliado_em) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [candidata.id, compra.id, compra.cartao_id, status, diferencaValor, diferencaDias, "Atualizada automaticamente apos registro da compra"]
    );
  }

  await run("UPDATE transacoes_fatura SET status_conciliacao = ? WHERE id = ?", [status, candidata.id]);
  await run("UPDATE compras_cartao SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [status === "conciliada" ? "conferida" : "sem_comprovante", compra.id]);
  await run(
    `UPDATE alertas_cartao
     SET status = 'resolvido',
         compra_cartao_id = ?,
         resolvido_em = CURRENT_TIMESTAMP,
         observacao_resolucao = ?
     WHERE tipo_alerta = 'compra_sem_registro'
       AND transacao_fatura_id = ?
       AND status != 'resolvido'`,
    [compra.id, "Compra registrada no sistema e vinculada automaticamente a fatura.", candidata.id]
  );

  if (status === "aguardando_comprovante") {
    await criarAlertaCompraSemComprovante(compra.id);
  }

  return { atualizada: true, transacaoId: candidata.id, status };
}

async function resolverAlertaAposAtualizarCompra(compraId, alertaId) {
  if (!alertaId) return { resolvido: false };

  const alerta = await get("SELECT * FROM alertas_cartao WHERE id = ? AND compra_cartao_id = ?", [alertaId, compraId]);
  if (!alerta) return { resolvido: false };

  const compra = await get("SELECT * FROM compras_cartao WHERE id = ?", [compraId]);
  if (!compra) return { resolvido: false };

  if (alerta.tipo_alerta === "compra_sem_comprovante" && !compra.comprovante_url) {
    return { resolvido: false, motivo: "comprovante_pendente" };
  }

  if (alerta.tipo_alerta === "compra_sem_comprovante") {
    await run("UPDATE compras_cartao SET status = 'registrada', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [compraId]);
    await run(
      `UPDATE conciliacoes_cartao
       SET status = 'conciliada',
           observacao = 'Comprovante anexado e alerta resolvido pelo formulario de compra.',
           conciliado_em = CURRENT_TIMESTAMP
       WHERE compra_cartao_id = ?
         AND status = 'aguardando_comprovante'`,
      [compraId]
    );
    await run(
      `UPDATE transacoes_fatura
       SET status_conciliacao = 'conciliada'
       WHERE id IN (
         SELECT transacao_fatura_id
         FROM conciliacoes_cartao
         WHERE compra_cartao_id = ?
       )
       AND status_conciliacao = 'aguardando_comprovante'`,
      [compraId]
    );
  }

  await run(
    `UPDATE alertas_cartao
     SET status = 'resolvido',
         resolvido_em = CURRENT_TIMESTAMP,
         observacao_resolucao = ?
     WHERE id = ?`,
    ["Compra atualizada pelo formulario de resolucao do alerta.", alertaId]
  );

  return { resolvido: true };
}

async function bootstrap() {
  const materiais = await all("SELECT id, nome, categoria, unidade, ativo FROM materiais ORDER BY nome");
  const setoresRows = await all("SELECT nome FROM setores ORDER BY nome");
  const usuarios = await all("SELECT * FROM usuarios ORDER BY nome");
  const saidasRows = await all("SELECT * FROM saidas ORDER BY data DESC, id DESC");
  const entradasRows = await all("SELECT * FROM entradas ORDER BY data DESC, id DESC");

  return {
    materiais: materiais.map((material) => ({ ...material, ativo: Boolean(material.ativo) })),
    setores: setoresRows.map((setor) => setor.nome),
    usuarios: usuarios.map(mapUsuario),
    saidas: saidasRows.map(mapSaida),
    entradas: entradasRows.map(mapEntrada)
  };
}

app.get("/api/bootstrap", async (_request, response) => {
  try {
    response.json(await bootstrap());
  } catch (error) {
    response.status(500).json({ erro: "Erro ao carregar dados.", detalhe: error.message });
  }
});

app.post("/api/login", async (request, response) => {
  try {
    const { email, senha } = request.body;
    const usuario = await get("SELECT * FROM usuarios WHERE lower(email) = lower(?)", [email || ""]);

    if (!usuario) {
      response.status(404).json({ erro: "Usuário não encontrado.", precisaCadastro: true });
      return;
    }

    if (usuario.senha !== senha) {
      response.status(401).json({ erro: "Senha incorreta." });
      return;
    }

    if (usuario.status !== "ativo") {
      response.status(403).json({ erro: "Usuário aguardando liberação do administrador." });
      return;
    }

    response.json(mapUsuario(usuario));
  } catch (error) {
    response.status(500).json({ erro: "Erro ao fazer login.", detalhe: error.message });
  }
});

app.post("/api/usuarios", async (request, response) => {
  try {
    const { nome, email, senha, setor } = request.body;

    if (!nome || !email || !senha || !setor) {
      response.status(400).json({ erro: "Preencha nome, e-mail, senha e setor." });
      return;
    }

    const existente = await get("SELECT id FROM usuarios WHERE lower(email) = lower(?)", [email]);

    if (existente) {
      response.status(409).json({ erro: "Já existe um usuário com este e-mail." });
      return;
    }

    const result = await run(
      "INSERT INTO usuarios (nome, email, senha, setor, status, perfil) VALUES (?, ?, ?, ?, 'pendente', 'usuario')",
      [nome, email, senha, setor]
    );

    response.status(201).json({ id: result.id, mensagem: "Usuário cadastrado. Aguarde liberação do administrador." });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao cadastrar usuário.", detalhe: error.message });
  }
});

app.get("/api/usuarios", async (_request, response) => {
  try {
    const usuarios = await all("SELECT * FROM usuarios ORDER BY status, nome");
    response.json(usuarios.map(mapUsuario));
  } catch (error) {
    response.status(500).json({ erro: "Erro ao listar usuários.", detalhe: error.message });
  }
});

app.put("/api/usuarios/:id/permissoes", async (request, response) => {
  try {
    const { status, permissoes } = request.body;
    await run(
      `UPDATE usuarios
       SET status = ?,
           pode_cadastrar_material = ?,
           pode_registrar_saida = ?,
           pode_registrar_entrada = ?,
           pode_ver_relatorios = ?,
           pode_administrar_usuarios = ?
       WHERE id = ?`,
      [
        status || "pendente",
        permissoes?.cadastrarMaterial ? 1 : 0,
        permissoes?.registrarSaida ? 1 : 0,
        permissoes?.registrarEntrada ? 1 : 0,
        permissoes?.verRelatorios ? 1 : 0,
        permissoes?.administrarUsuarios ? 1 : 0,
        request.params.id
      ]
    );

    response.json({ mensagem: "Permissões atualizadas." });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao atualizar permissões.", detalhe: error.message });
  }
});

app.get("/api/materiais", async (_request, response) => {
  response.json((await bootstrap()).materiais);
});

app.post("/api/materiais", async (request, response) => {
  try {
    const { nome, categoria, unidade } = request.body;

    if (!nome || !categoria || !unidade) {
      response.status(400).json({ erro: "Preencha nome, categoria e unidade." });
      return;
    }

    const result = await run(
      "INSERT INTO materiais (nome, categoria, unidade, ativo) VALUES (?, ?, ?, 1)",
      [nome, categoria, unidade]
    );

    response.status(201).json({ id: result.id });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao cadastrar material.", detalhe: error.message });
  }
});

app.put("/api/materiais/:id", async (request, response) => {
  try {
    const { nome, categoria, unidade } = request.body;

    if (!nome || !categoria || !unidade) {
      response.status(400).json({ erro: "Preencha nome, categoria e unidade." });
      return;
    }

    await run(
      "UPDATE materiais SET nome = ?, categoria = ?, unidade = ? WHERE id = ?",
      [nome, categoria, unidade, request.params.id]
    );

    response.json({ mensagem: "Material atualizado." });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao atualizar material.", detalhe: error.message });
  }
});

app.patch("/api/materiais/:id/status", async (request, response) => {
  try {
    const { ativo } = request.body;
    await run("UPDATE materiais SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, request.params.id]);
    response.json({ mensagem: "Status do material atualizado." });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao atualizar status do material.", detalhe: error.message });
  }
});

app.get("/api/setores", async (_request, response) => {
  response.json((await bootstrap()).setores);
});

app.get("/api/setores-detalhados", async (_request, response) => {
  response.json(await all("SELECT id, nome FROM setores ORDER BY nome"));
});

app.post("/api/uploads/comprovante", async (request, response) => {
  try {
    const { fileName, mimeType, base64, departamentoId, dataCompra } = request.body;
    if (!fileName || !mimeType || !base64 || !departamentoId || !dataCompra) {
      response.status(400).json({ erro: "Arquivo, departamento e data sao obrigatorios." });
      return;
    }

    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      response.status(400).json({ erro: "Envie PDF ou imagem nos formatos PNG, JPG ou WEBP." });
      return;
    }

    const buffer = Buffer.from(String(base64).split(",").pop(), "base64");
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      response.status(400).json({ erro: "Arquivo invalido ou maior que 10 MB." });
      return;
    }

    const departamento = await get("SELECT nome FROM setores WHERE id = ?", [departamentoId]);
    if (!departamento) {
      response.status(400).json({ erro: "Departamento nao encontrado." });
      return;
    }

    const ext = extensionFromMime(mimeType, fileName);
    if (!ext) {
      response.status(400).json({ erro: "Extensao de arquivo nao permitida." });
      return;
    }

    const relativeDir = path.join("uploads", "comprovantes", monthFolder(dataCompra), safeFilePart(departamento.nome));
    const absoluteDir = path.join(publicDir, relativeDir);
    fs.mkdirSync(absoluteDir, { recursive: true });

    const baseName = safeFilePart(path.basename(fileName, path.extname(fileName)));
    const savedName = `${Date.now()}-${baseName}${ext}`;
    const absolutePath = path.join(absoluteDir, savedName);
    fs.writeFileSync(absolutePath, buffer);

    response.status(201).json({
      caminho: `/${relativeDir.replace(/\\/g, "/")}/${savedName}`,
      nome: savedName
    });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao salvar comprovante.", detalhe: error.message });
  }
});

app.get("/api/saidas", async (_request, response) => {
  response.json((await bootstrap()).saidas);
});

app.post("/api/saidas", async (request, response) => {
  try {
    const { materialId, quantidade, data, setor, responsavel, localUso, motivo, observacao } = request.body;

    if (!materialId || !quantidade || !data || !setor || !responsavel) {
      response.status(400).json({ erro: "Campos obrigatórios ausentes." });
      return;
    }

    const result = await run(
      "INSERT INTO saidas (material_id, quantidade, data, setor, responsavel, local_uso, motivo, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [materialId, quantidade, data, setor, responsavel, localUso || "", motivo || "", observacao || ""]
    );

    response.status(201).json({ id: result.id });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao registrar saída.", detalhe: error.message });
  }
});

app.get("/api/entradas", async (_request, response) => {
  response.json((await bootstrap()).entradas);
});

app.post("/api/entradas", async (request, response) => {
  try {
    const { materialId, quantidade, valorTotal, data, observacao } = request.body;

    if (!materialId || !quantidade || !valorTotal || !data) {
      response.status(400).json({ erro: "Campos obrigatórios ausentes." });
      return;
    }

    const result = await run(
      "INSERT INTO entradas (material_id, quantidade, valor_total, data, observacao) VALUES (?, ?, ?, ?, ?)",
      [materialId, quantidade, valorTotal, data, observacao || ""]
    );

    response.status(201).json({ id: result.id });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao registrar entrada.", detalhe: error.message });
  }
});

app.get("/api/cartoes", async (request, response) => {
  try {
    const where = [];
    const params = [];
    if (request.query.departamentoId) {
      where.push("c.departamento_id = ?");
      params.push(request.query.departamentoId);
    }
    if (request.query.status) {
      where.push("c.status = ?");
      params.push(request.query.status);
    }
    const sql = `${cardJoinSql()} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY c.nome_cartao`;
    response.json((await all(sql, params)).map(mapCartao));
  } catch (error) {
    response.status(500).json({ erro: "Erro ao listar cartões.", detalhe: error.message });
  }
});

app.get("/api/cartoes/:id", async (request, response) => {
  const cartao = await get(`${cardJoinSql()} WHERE c.id = ?`, [request.params.id]);
  if (!cartao) return response.status(404).json({ erro: "Cartão não encontrado." });
  response.json(mapCartao(cartao));
});

app.post("/api/cartoes", async (request, response) => {
  try {
    assertNoSensitiveCardData(request.body);
    const { nomeCartao, departamentoId, responsavelId, gerenteId, ultimos4Digitos, limiteMensal, status, observacao } = request.body;
    if (!nomeCartao || !departamentoId || !responsavelId || !gerenteId) return response.status(400).json({ erro: "Preencha nome, departamento, responsável e gerente." });
    if (!validateLast4(ultimos4Digitos)) return response.status(400).json({ erro: "Últimos 4 dígitos devem conter exatamente 4 números." });
    if (limiteMensal !== null && limiteMensal !== "" && Number(limiteMensal) < 0) return response.status(400).json({ erro: "Limite mensal deve ser maior ou igual a zero." });
    const result = await run(
      "INSERT INTO cartoes_corporativos (nome_cartao, departamento_id, responsavel_id, gerente_id, ultimos_4_digitos, limite_mensal, status, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [nomeCartao, departamentoId, responsavelId, gerenteId, ultimos4Digitos, limiteMensal || null, status || "ativo", observacao || ""]
    );
    response.status(201).json({ id: result.id });
  } catch (error) {
    response.status(400).json({ erro: error.message });
  }
});

app.put("/api/cartoes/:id", async (request, response) => {
  try {
    assertNoSensitiveCardData(request.body);
    const { nomeCartao, departamentoId, responsavelId, gerenteId, ultimos4Digitos, limiteMensal, status, observacao } = request.body;
    if (!nomeCartao || !departamentoId || !responsavelId || !gerenteId) return response.status(400).json({ erro: "Preencha nome, departamento, responsável e gerente." });
    if (!validateLast4(ultimos4Digitos)) return response.status(400).json({ erro: "Últimos 4 dígitos devem conter exatamente 4 números." });
    await run(
      "UPDATE cartoes_corporativos SET nome_cartao = ?, departamento_id = ?, responsavel_id = ?, gerente_id = ?, ultimos_4_digitos = ?, limite_mensal = ?, status = ?, observacao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      [nomeCartao, departamentoId, responsavelId, gerenteId, ultimos4Digitos, limiteMensal || null, status || "ativo", observacao || "", request.params.id]
    );
    response.json({ mensagem: "Cartão atualizado." });
  } catch (error) {
    response.status(400).json({ erro: error.message });
  }
});

app.patch("/api/cartoes/:id/inativar", async (request, response) => {
  await run("UPDATE cartoes_corporativos SET status = 'inativo', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [request.params.id]);
  response.json({ mensagem: "Cartão inativado." });
});

app.patch("/api/cartoes/:id/ativar", async (request, response) => {
  await run("UPDATE cartoes_corporativos SET status = 'ativo', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [request.params.id]);
  response.json({ mensagem: "Cartão ativado." });
});

app.get("/api/compras-cartao", async (request, response) => {
  const where = [];
  const params = [];
  ["cartaoId", "departamentoId", "responsavelId", "categoria", "status"].forEach((key) => {
    const column = { cartaoId: "cc.cartao_id", departamentoId: "cc.departamento_id", responsavelId: "cc.responsavel_compra_id", categoria: "cc.categoria", status: "cc.status" }[key];
    if (request.query[key]) {
      where.push(`${column} = ?`);
      params.push(request.query[key]);
    }
  });
  if (request.query.dataInicial) {
    where.push("cc.data_compra >= ?");
    params.push(request.query.dataInicial);
  }
  if (request.query.dataFinal) {
    where.push("cc.data_compra <= ?");
    params.push(request.query.dataFinal);
  }
  if (request.query.fornecedor) {
    where.push("lower(cc.fornecedor) LIKE lower(?)");
    params.push(`%${request.query.fornecedor}%`);
  }
  const sql = `${compraJoinSql()} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY cc.data_compra DESC, cc.id DESC`;
  response.json((await all(sql, params)).map(mapCompraCartao));
});

function pendenciasCadastroCompra(compra) {
  const pendencias = [];
  if (!compra.responsavelCompraId) pendencias.push("Responsavel");
  if (!String(compra.categoria || "").trim()) pendencias.push("Categoria");
  if (!String(compra.motivo || "").trim()) pendencias.push("Motivo");
  if (!String(compra.comprovanteUrl || "").trim()) pendencias.push("Comprovante");
  if (compra.status === "aguardando_conferencia") pendencias.push("Conferencia");
  if (compra.status === "divergente") pendencias.push("Divergencia");
  return [...new Set(pendencias)];
}

app.get("/api/compras-cartao/pendentes", async (request, response) => {
  try {
    const where = [
      `(cc.status IN ('aguardando_conferencia', 'divergente', 'sem_comprovante')
          OR ifnull(trim(cc.comprovante_url), '') = ''
          OR ifnull(trim(cc.motivo), '') = ''
          OR ifnull(trim(cc.categoria), '') = ''
          OR cc.responsavel_compra_id IS NULL)`
    ];
    const params = [];
    if (request.query.cartaoId) {
      where.push("cc.cartao_id = ?");
      params.push(request.query.cartaoId);
    }
    if (request.query.status) {
      where.push("cc.status = ?");
      params.push(request.query.status);
    }
    if (request.query.fornecedor) {
      where.push("lower(cc.fornecedor) LIKE lower(?)");
      params.push(`%${request.query.fornecedor}%`);
    }

    const rows = await all(
      `${compraJoinSql()}
       WHERE ${where.join(" AND ")}
       ORDER BY cc.data_compra DESC, cc.id DESC`,
      params
    );

    const pendentes = rows.map((row) => {
      const compra = mapCompraCartao(row);

      return {
        ...compra,
        pendencias: pendenciasCadastroCompra(compra)
      };
    });

    response.json(pendentes);
  } catch (error) {
    response.status(500).json({ erro: "Erro ao listar compras pendentes.", detalhe: error.message });
  }
});

app.post("/api/compras-cartao/:id/enviar-pendencia-teams", async (request, response) => {
  try {
    const row = await get(
      `SELECT cc.*,
              c.nome_cartao AS cartao,
              c.ultimos_4_digitos,
              s.nome AS departamento,
              u.nome AS responsavel,
              u.email AS comprador_email,
              g.nome AS gerente,
              g.email AS gerente_email
       FROM compras_cartao cc
       JOIN cartoes_corporativos c ON c.id = cc.cartao_id
       JOIN setores s ON s.id = cc.departamento_id
       LEFT JOIN usuarios u ON u.id = cc.responsavel_compra_id
       LEFT JOIN usuarios g ON g.id = c.gerente_id
       WHERE cc.id = ?`,
      [request.params.id]
    );

    if (!row) {
      response.status(404).json({ erro: "Compra nao encontrada." });
      return;
    }

    const compra = mapCompraCartao(row);
    const pendencias = pendenciasCadastroCompra(compra);
    const temResponsavel = Boolean(row.responsavel_compra_id && row.comprador_email);
    const tipo = temResponsavel
      ? pendencias.includes("Comprovante") ? "compra_sem_comprovante" : "compra_fora_padrao"
      : "compra_sem_registro";
    const baseUrl = process.env.APP_BASE_URL || `${request.protocol}://${request.get("host")}`;
    const urlResolucao = `${baseUrl}/compra-cartao.html?compraId=${row.id}`;

    const envio = await sendTeamsAlert({
      id: `compra-${row.id}`,
      tipo_alerta: tipo,
      departamento: row.departamento,
      cartao: row.cartao,
      ultimos_4_digitos: row.ultimos_4_digitos,
      data_compra: row.data_compra,
      estabelecimento: row.fornecedor,
      valor: row.valor,
      comprador_nome: row.responsavel || "",
      comprador_email: row.comprador_email || "",
      gerente_nome: row.gerente || "",
      gerente_email: row.gerente_email || "",
      mensagem: `Compra pendente de conclusão. Falta resolver: ${pendencias.join(", ") || "Revisão"}.`,
      url_resolucao: urlResolucao,
      destinatarios_departamento: temResponsavel ? [] : await all(
        "SELECT id, nome, email FROM usuarios WHERE status = 'ativo' AND lower(setor) = lower(?) AND email IS NOT NULL AND email != '' ORDER BY nome",
        [row.departamento]
      )
    });

    response.json({
      mensagem: temResponsavel
        ? "Mensagem enviada/simulada para o responsavel pela compra."
        : "Mensagem enviada/simulada para o grupo do departamento.",
      envio
    });
  } catch (error) {
    response.status(502).json({ erro: "Erro ao chamar a automacao do Power Automate.", detalhe: error.message });
  }
});

app.get("/api/compras-cartao/:id", async (request, response) => {
  const compra = await get(`${compraJoinSql()} WHERE cc.id = ?`, [request.params.id]);
  if (!compra) return response.status(404).json({ erro: "Compra nao encontrada." });
  response.json(mapCompraCartao(compra));
});

app.post("/api/compras-cartao/pendencias-compativeis", async (request, response) => {
  try {
    const { cartaoId, dataCompra, valor, fornecedor } = request.body;
    if (!cartaoId || !dataCompra || !valor || !fornecedor) {
      response.json([]);
      return;
    }

    const pendencias = await buscarPendenciasCompativeisCompra({
      cartao_id: cartaoId,
      data_compra: dataCompra,
      valor: Number(valor),
      fornecedor
    });
    response.json(pendencias);
  } catch (error) {
    response.status(500).json({ erro: "Erro ao buscar pendencias compativeis.", detalhe: error.message });
  }
});

function normalizarDataCompraAutomatica(valor) {
  const texto = String(valor || "").trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return texto;
}

function normalizarValorCompraAutomatica(valor) {
  if (typeof valor === "number") {
    return Number.isInteger(valor) && Math.abs(valor) >= 10000 ? valor / 100 : valor;
  }

  const textoOriginal = String(valor || "").trim();
  const texto = textoOriginal
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (/^-?\d{5,}$/.test(texto)) {
    return Number(texto) / 100;
  }

  if (texto.includes(",") && texto.includes(".")) {
    const ultimoPonto = texto.lastIndexOf(".");
    const ultimaVirgula = texto.lastIndexOf(",");
    return Number(
      ultimaVirgula > ultimoPonto
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "")
    );
  }

  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", "."));
  }

  return Number(texto);
}

app.post("/api/compras-cartao/automatica", async (request, response) => {
  try {
    const {
      dataCompra,
      valor,
      fornecedor,
      ultimos4Digitos,
      codigoAutorizacao,
      emailOrigemId
    } = request.body;
    const dataNormalizada = normalizarDataCompraAutomatica(dataCompra);
    const valorNumerico = normalizarValorCompraAutomatica(valor);
    const finalCartao = String(ultimos4Digitos || "").replace(/\D/g, "").slice(-4);

    if (!dataNormalizada || !valorNumerico || !fornecedor || !finalCartao) {
      response.status(400).json({ erro: "Informe dataCompra, valor, fornecedor e ultimos4Digitos." });
      return;
    }

    const cartao = await get(
      `SELECT c.*, s.nome AS departamento
       FROM cartoes_corporativos c
       JOIN setores s ON s.id = c.departamento_id
       WHERE c.ultimos_4_digitos = ?
         AND c.status = 'ativo'`,
      [finalCartao]
    );

    if (!cartao) {
      response.status(404).json({ erro: "Nenhum cartão ativo encontrado com esses últimos 4 dígitos." });
      return;
    }

    const existente = await get(
      `SELECT id FROM compras_cartao
       WHERE cartao_id = ?
         AND data_compra = ?
         AND valor = ?
         AND lower(fornecedor) = lower(?)
         AND status != 'cancelada'`,
      [cartao.id, dataNormalizada, valorNumerico, fornecedor]
    );

    if (existente) {
      response.status(409).json({ erro: "Esta compra automática já parece estar cadastrada.", compraId: existente.id });
      return;
    }

    const observacao = "Compra cadastrada automaticamente.";

    const result = await run(
      `INSERT INTO compras_cartao (
        cartao_id,
        departamento_id,
        responsavel_compra_id,
        data_compra,
        valor,
        fornecedor,
        categoria,
        motivo,
        comprovante_url,
        observacao,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', ?, 'sem_comprovante')`,
      [
        cartao.id,
        cartao.departamento_id,
        null,
        dataNormalizada,
        valorNumerico,
        fornecedor,
        observacao
      ]
    );

    await criarAlertaCompraSemComprovante(result.id);
    let envioTeams = null;
    try {
      const baseUrl = process.env.APP_BASE_URL || `${request.protocol}://${request.get("host")}`;
      const urlResolucao = `${baseUrl}/compra-cartao.html?compraId=${result.id}`;
      const destinatariosDepartamento = await all(
        "SELECT id, nome, email FROM usuarios WHERE status = 'ativo' AND lower(setor) = lower(?) AND email IS NOT NULL AND email != '' ORDER BY nome",
        [cartao.departamento]
      );

      envioTeams = await sendTeamsAlert({
        id: `compra-auto-${result.id}`,
        compra_id: result.id,
        cartao_id: cartao.id,
        departamento_id: cartao.departamento_id,
        tipo_alerta: "compra_automatica_cadastrada",
        departamento: cartao.departamento,
        cartao: cartao.nome_cartao,
        data_compra: dataNormalizada,
        estabelecimento: fornecedor,
        valor: valorNumerico,
        mensagem: "Compra cadastrada automaticamente. Conclua o cadastro no sistema.",
        url_resolucao: urlResolucao,
        destinatarios_departamento: destinatariosDepartamento
      });
    } catch (teamsError) {
      console.warn("Compra automática cadastrada, mas não foi possível enviar aviso ao Teams:", teamsError.message);
      envioTeams = { enviado: false, erro: teamsError.message };
    }

    response.status(201).json({
      mensagem: "Compra automática cadastrada.",
      compraId: result.id,
      cartaoId: cartao.id,
      cartao: cartao.nome_cartao,
      departamentoId: cartao.departamento_id,
      departamento: cartao.departamento,
      status: "sem_comprovante",
      teams: envioTeams,
      proximoPasso: "A compra está em Compras pendentes para anexar comprovante e revisar o cadastro."
    });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao cadastrar compra automática.", detalhe: error.message });
  }
});

app.post("/api/compras-cartao", async (request, response) => {
  try {
    const { cartaoId, departamentoId, responsavelCompraId, dataCompra, valor, fornecedor, categoria, motivo, comprovanteUrl, observacao, vincularPendencia, transacaoFaturaId } = request.body;
    if (!cartaoId || !departamentoId || !responsavelCompraId || !dataCompra || !valor || !fornecedor || !categoria || !motivo) return response.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
    if (Number(valor) <= 0) return response.status(400).json({ erro: "Valor deve ser maior que zero." });
    const cartao = await get("SELECT * FROM cartoes_corporativos WHERE id = ?", [cartaoId]);
    if (!cartao || cartao.status !== "ativo") return response.status(400).json({ erro: "Selecione um cartão ativo." });
    const status = comprovanteUrl ? "registrada" : "sem_comprovante";
    const result = await run(
      "INSERT INTO compras_cartao (cartao_id, departamento_id, responsavel_compra_id, data_compra, valor, fornecedor, categoria, motivo, comprovante_url, observacao, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [cartaoId, departamentoId, responsavelCompraId, dataCompra, valor, fornecedor, categoria, motivo, comprovanteUrl || "", observacao || "", status]
    );
    const pendencia = vincularPendencia ? await tentarAtualizarPendenciaPorCompra(result.id, transacaoFaturaId) : { atualizada: false };
    if (!pendencia.atualizada && status === "sem_comprovante") {
      await criarAlertaCompraSemComprovante(result.id);
    }
    response.status(201).json({ id: result.id, pendenciaAtualizada: pendencia.atualizada, statusConciliacao: pendencia.status || null });
  } catch (error) {
    response.status(500).json({ erro: "Erro ao registrar compra.", detalhe: error.message });
  }
});

app.put("/api/compras-cartao/:id", async (request, response) => {
  const { cartaoId, departamentoId, responsavelCompraId, dataCompra, valor, fornecedor, categoria, motivo, comprovanteUrl, observacao, status, vincularPendencia, transacaoFaturaId, alertaId } = request.body;
  await run(
    "UPDATE compras_cartao SET cartao_id = ?, departamento_id = ?, responsavel_compra_id = ?, data_compra = ?, valor = ?, fornecedor = ?, categoria = ?, motivo = ?, comprovante_url = ?, observacao = ?, status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    [cartaoId, departamentoId, responsavelCompraId, dataCompra, valor, fornecedor, categoria, motivo, comprovanteUrl || "", observacao || "", status || "registrada", request.params.id]
  );
  const pendencia = vincularPendencia ? await tentarAtualizarPendenciaPorCompra(request.params.id, transacaoFaturaId) : { atualizada: false };
  const alerta = await resolverAlertaAposAtualizarCompra(request.params.id, alertaId);
  response.json({ mensagem: "Compra atualizada.", pendenciaAtualizada: pendencia.atualizada, statusConciliacao: pendencia.status || null, alertaResolvido: alerta.resolvido, motivoAlerta: alerta.motivo || null });
});

app.patch("/api/compras-cartao/:id/status", async (request, response) => {
  await run("UPDATE compras_cartao SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [request.body.status, request.params.id]);
  response.json({ mensagem: "Status atualizado." });
});

app.patch("/api/compras-cartao/:id/anexar-comprovante", async (request, response) => {
  await run("UPDATE compras_cartao SET comprovante_url = ?, status = 'registrada', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [request.body.comprovanteUrl || "", request.params.id]);
  response.json({ mensagem: "Comprovante anexado." });
});

app.get("/api/faturas-cartao", async (_request, response) => {
  response.json(await all(`SELECT f.*, c.nome_cartao AS cartao FROM faturas_cartao f JOIN cartoes_corporativos c ON c.id = f.cartao_id ORDER BY f.ano_referencia DESC, f.mes_referencia DESC`));
});

app.post("/api/faturas-cartao/importar", async (request, response) => {
  const { cartaoId, mesReferencia, anoReferencia, arquivoNome, importadoPorId, observacao, transacoes } = request.body;
  if (!cartaoId || !mesReferencia || !anoReferencia || !importadoPorId) return response.status(400).json({ erro: "Cartão, mês, ano e importador são obrigatórios." });
  const cartao = await get("SELECT * FROM cartoes_corporativos WHERE id = ?", [cartaoId]);
  const existente = await get("SELECT id FROM faturas_cartao WHERE cartao_id = ? AND mes_referencia = ? AND ano_referencia = ?", [cartaoId, mesReferencia, anoReferencia]);
  if (existente) return response.status(409).json({ erro: "Já existe fatura para este cartão/mês/ano." });
  const fatura = await run(
    "INSERT INTO faturas_cartao (cartao_id, mes_referencia, ano_referencia, arquivo_nome, importado_por_id, status, observacao) VALUES (?, ?, ?, ?, ?, 'importada', ?)",
    [cartaoId, mesReferencia, anoReferencia, arquivoNome || "lançamento manual", importadoPorId, observacao || ""]
  );
  for (const item of transacoes || []) {
    if (String(item.ultimos4Digitos) !== cartao.ultimos_4_digitos) continue;
    const dup = await get(
      "SELECT id FROM transacoes_fatura WHERE cartao_id = ? AND data_transacao = ? AND valor = ? AND lower(estabelecimento) = lower(?)",
      [cartaoId, item.dataTransacao, item.valor, item.estabelecimento]
    );
    if (!dup) {
      await run(
        "INSERT INTO transacoes_fatura (fatura_id, cartao_id, data_transacao, estabelecimento, valor, ultimos_4_digitos, codigo_autorizacao, categoria_detectada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [fatura.id, cartaoId, item.dataTransacao, item.estabelecimento, item.valor, item.ultimos4Digitos, item.codigoAutorizacao || "", item.categoriaDetectada || ""]
      );
    }
  }
  response.status(201).json({ id: fatura.id });
});

app.get("/api/faturas-cartao/:id/transacoes", async (request, response) => {
  response.json(await all("SELECT * FROM transacoes_fatura WHERE fatura_id = ? ORDER BY data_transacao DESC", [request.params.id]));
});

app.post("/api/faturas-cartao/:id/transacoes", async (request, response) => {
  const fatura = await get("SELECT * FROM faturas_cartao WHERE id = ?", [request.params.id]);
  const cartao = await get("SELECT * FROM cartoes_corporativos WHERE id = ?", [fatura.cartao_id]);
  const { dataTransacao, estabelecimento, valor, ultimos4Digitos, codigoAutorizacao, categoriaDetectada } = request.body;
  if (String(ultimos4Digitos) !== cartao.ultimos_4_digitos) return response.status(400).json({ erro: "Últimos 4 dígitos não correspondem ao cartão." });
  const result = await run(
    "INSERT INTO transacoes_fatura (fatura_id, cartao_id, data_transacao, estabelecimento, valor, ultimos_4_digitos, codigo_autorizacao, categoria_detectada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [request.params.id, fatura.cartao_id, dataTransacao, estabelecimento, valor, ultimos4Digitos, codigoAutorizacao || "", categoriaDetectada || ""]
  );
  response.status(201).json({ id: result.id });
});

app.delete("/api/faturas-cartao/:id/transacoes/:transacaoId", async (request, response) => {
  await run("DELETE FROM transacoes_fatura WHERE id = ? AND fatura_id = ?", [request.params.transacaoId, request.params.id]);
  response.json({ mensagem: "Transação removida." });
});

app.post("/api/conciliacoes-cartao/rodar/:faturaId", async (request, response) => {
  const transacoes = await all(
    `SELECT t.*, c.departamento_id, c.gerente_id, c.nome_cartao, c.ultimos_4_digitos, s.nome AS departamento
     FROM transacoes_fatura t
     JOIN cartoes_corporativos c ON c.id = t.cartao_id
     JOIN setores s ON s.id = c.departamento_id
     WHERE t.fatura_id = ?`,
    [request.params.faturaId]
  );
  let gerados = 0;

  for (const transacao of transacoes) {
    const jaConciliada = await get("SELECT id FROM conciliacoes_cartao WHERE transacao_fatura_id = ?", [transacao.id]);
    if (jaConciliada) continue;

    const compras = await all(
      "SELECT * FROM compras_cartao WHERE cartao_id = ? AND status != 'cancelada'",
      [transacao.cartao_id]
    );
    const valorIgual = compras.find((compra) => compra.valor === transacao.valor && Math.abs(daysDiff(transacao.data_transacao, compra.data_compra)) <= 2 && similarText(transacao.estabelecimento, compra.fornecedor));
    const valorDivergente = compras.find((compra) => Math.abs(daysDiff(transacao.data_transacao, compra.data_compra)) <= 2 && similarText(transacao.estabelecimento, compra.fornecedor));
    const dataDivergente = compras.find((compra) => compra.valor === transacao.valor && similarText(transacao.estabelecimento, compra.fornecedor));
    let compra = valorIgual || valorDivergente || dataDivergente || null;
    let status = "sem_registro";
    let diferencaValor = 0;
    let diferencaDias = 0;

    if (valorIgual) {
      status = valorIgual.comprovante_url ? "conciliada" : "aguardando_comprovante";
    } else if (valorDivergente) {
      status = "valor_divergente";
    } else if (dataDivergente) {
      status = "data_divergente";
    }

    if (compra) {
      diferencaValor = Number((transacao.valor - compra.valor).toFixed(2));
      diferencaDias = daysDiff(transacao.data_transacao, compra.data_compra);
    }

    await run(
      "INSERT INTO conciliacoes_cartao (transacao_fatura_id, compra_cartao_id, cartao_id, status, diferenca_valor, diferenca_dias, observacao, conciliado_por_id, conciliado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [transacao.id, compra?.id || null, transacao.cartao_id, status, diferencaValor, diferencaDias, "Conciliação automática", request.body.conciliadoPorId || null]
    );
    await run("UPDATE transacoes_fatura SET status_conciliacao = ? WHERE id = ?", [status, transacao.id]);
    if (compra && status === "conciliada") await run("UPDATE compras_cartao SET status = 'conferida' WHERE id = ?", [compra.id]);
    if (compra && status !== "conciliada") await run("UPDATE compras_cartao SET status = ? WHERE id = ?", [status === "aguardando_comprovante" ? "sem_comprovante" : "divergente", compra.id]);

    const alertTypes = {
      sem_registro: "compra_sem_registro",
      valor_divergente: "valor_divergente",
      data_divergente: "data_divergente",
      aguardando_comprovante: "compra_sem_comprovante"
    };
    if (alertTypes[status]) {
      await criarAlertaCartao({
        cartaoId: transacao.cartao_id,
        departamentoId: transacao.departamento_id,
        gerenteId: transacao.gerente_id,
        transacaoId: transacao.id,
        compraId: compra?.id || null,
        tipo: alertTypes[status],
        mensagem: mensagemAlerta(alertTypes[status], transacao.departamento, transacao.nome_cartao, transacao.ultimos_4_digitos, transacao.data_transacao, transacao.estabelecimento, transacao.valor)
      });
    }
    gerados += 1;
  }

  const pendencias = await get("SELECT COUNT(*) AS total FROM transacoes_fatura WHERE fatura_id = ? AND status_conciliacao != 'conciliada'", [request.params.faturaId]);
  await run("UPDATE faturas_cartao SET status = ? WHERE id = ?", [pendencias.total ? "com_pendencias" : "conciliada", request.params.faturaId]);
  const pendenciasAtuais = await all(
    `SELECT t.id AS transacaoId,
            co.compra_cartao_id AS compraId,
            (
              SELECT a.id
              FROM alertas_cartao a
              WHERE a.status != 'resolvido'
                AND a.transacao_fatura_id = t.id
                AND ifnull(a.compra_cartao_id, 0) = ifnull(co.compra_cartao_id, 0)
              ORDER BY a.id DESC
              LIMIT 1
            ) AS alertaId,
            ifnull(co.status, t.status_conciliacao) AS status,
            t.data_transacao AS dataTransacao,
            t.estabelecimento,
            t.valor,
            t.cartao_id AS cartaoId,
            c.nome_cartao AS cartao,
            c.ultimos_4_digitos AS ultimos4Digitos,
            c.departamento_id AS departamentoId,
            s.nome AS departamento,
            cc.fornecedor AS compraFornecedor,
            cc.data_compra AS compraData,
            cc.valor AS compraValor,
            ifnull(co.diferenca_valor, 0) AS diferencaValor,
            ifnull(co.diferenca_dias, 0) AS diferencaDias
     FROM transacoes_fatura t
     JOIN cartoes_corporativos c ON c.id = t.cartao_id
     JOIN setores s ON s.id = c.departamento_id
     LEFT JOIN conciliacoes_cartao co ON co.transacao_fatura_id = t.id
     LEFT JOIN compras_cartao cc ON cc.id = co.compra_cartao_id
     WHERE t.fatura_id = ?
       AND t.status_conciliacao != 'conciliada'
     ORDER BY t.data_transacao DESC, t.id DESC`,
    [request.params.faturaId]
  );
  response.json({ mensagem: "Conciliação concluída.", processadas: gerados, pendencias: pendenciasAtuais });
});

app.get("/api/conciliacoes-cartao", async (request, response) => {
  const where = [];
  const params = [];
  if (request.query.status) {
    where.push("co.status = ?");
    params.push(request.query.status);
  }
  if (request.query.cartaoId) {
    where.push("co.cartao_id = ?");
    params.push(request.query.cartaoId);
  }
  const sql = `SELECT co.*, t.data_transacao, t.estabelecimento, t.valor AS valor_fatura, t.categoria_detectada, c.nome_cartao AS cartao, c.departamento_id,
                      cc.fornecedor AS compra_fornecedor, cc.responsavel_compra_id, u.nome AS responsavel
               FROM conciliacoes_cartao co
               JOIN transacoes_fatura t ON t.id = co.transacao_fatura_id
               JOIN cartoes_corporativos c ON c.id = co.cartao_id
               LEFT JOIN compras_cartao cc ON cc.id = co.compra_cartao_id
               LEFT JOIN usuarios u ON u.id = cc.responsavel_compra_id
               ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
               ORDER BY co.criado_em DESC`;
  response.json(await all(sql, params));
});

app.patch("/api/conciliacoes-cartao/:id/resolver", async (request, response) => {
  if (!request.body.observacao) return response.status(400).json({ erro: "Informe uma observação de resolução." });
  await run("UPDATE conciliacoes_cartao SET status = 'resolvida', observacao = ?, conciliado_por_id = ?, conciliado_em = CURRENT_TIMESTAMP WHERE id = ?", [request.body.observacao, request.body.usuarioId || null, request.params.id]);
  response.json({ mensagem: "Conciliação resolvida." });
});

app.get("/api/alertas-cartao", async (request, response) => {
  const where = [];
  const params = [];
  if (!request.query.status || request.query.status === "abertos") {
    where.push("a.status != 'resolvido'");
  } else if (request.query.status !== "todos") {
    where.push("a.status = ?");
    params.push(request.query.status);
  }
  if (request.query.tipo) {
    where.push("a.tipo_alerta = ?");
    params.push(request.query.tipo);
  }
  const sql = `SELECT a.*, c.nome_cartao AS cartao, c.ultimos_4_digitos, s.nome AS departamento, g.nome AS gerente,
                      ifnull(t.estabelecimento, cc.fornecedor) AS estabelecimento,
                      ifnull(t.valor, cc.valor) AS valor,
                      ifnull(t.data_transacao, cc.data_compra) AS data_transacao
               FROM alertas_cartao a
               JOIN cartoes_corporativos c ON c.id = a.cartao_id
               JOIN setores s ON s.id = a.departamento_id
               JOIN usuarios g ON g.id = a.gerente_id
               LEFT JOIN transacoes_fatura t ON t.id = a.transacao_fatura_id
               LEFT JOIN compras_cartao cc ON cc.id = a.compra_cartao_id
               ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
               ORDER BY a.criado_em DESC`;
  response.json(await all(sql, params));
});

app.get("/api/alertas-cartao/:id", async (request, response) => {
  const alerta = await get(
    `SELECT a.*, c.nome_cartao AS cartao, c.ultimos_4_digitos, s.nome AS departamento, g.nome AS gerente,
            ifnull(t.estabelecimento, cc.fornecedor) AS estabelecimento,
            ifnull(t.valor, cc.valor) AS valor,
            ifnull(t.data_transacao, cc.data_compra) AS data_transacao,
            t.id AS transacao_id,
            t.categoria_detectada,
            c.departamento_id,
            cc.id AS compra_id
     FROM alertas_cartao a
     JOIN cartoes_corporativos c ON c.id = a.cartao_id
     JOIN setores s ON s.id = a.departamento_id
     JOIN usuarios g ON g.id = a.gerente_id
     LEFT JOIN transacoes_fatura t ON t.id = a.transacao_fatura_id
     LEFT JOIN compras_cartao cc ON cc.id = a.compra_cartao_id
     WHERE a.id = ?`,
    [request.params.id]
  );

  if (!alerta) return response.status(404).json({ erro: "Alerta nao encontrado." });
  response.json(alerta);
});

app.get("/api/alertas-cartao/:id/destinatarios", async (request, response) => {
  const alerta = await get(
    `SELECT a.*, s.nome AS departamento, g.nome AS gerente_nome, g.email AS gerente_email,
            uc.nome AS comprador_nome, uc.email AS comprador_email
     FROM alertas_cartao a
     JOIN setores s ON s.id = a.departamento_id
     JOIN usuarios g ON g.id = a.gerente_id
     LEFT JOIN compras_cartao cc ON cc.id = a.compra_cartao_id
     LEFT JOIN usuarios uc ON uc.id = cc.responsavel_compra_id
     WHERE a.id = ?`,
    [request.params.id]
  );

  if (!alerta) return response.status(404).json({ erro: "Alerta nao encontrado." });

  const departamento = alerta.tipo_alerta === "compra_sem_registro"
    ? await all(
        "SELECT id, nome, email FROM usuarios WHERE status = 'ativo' AND lower(setor) = lower(?) AND email IS NOT NULL AND email != '' ORDER BY nome",
        [alerta.departamento]
      )
    : [];

  response.json({
    tipo_alerta: alerta.tipo_alerta,
    departamento: alerta.departamento,
    comprador: alerta.comprador_email ? { nome: alerta.comprador_nome, email: alerta.comprador_email } : null,
    gerente: { nome: alerta.gerente_nome, email: alerta.gerente_email },
    destinatarios_departamento: departamento
  });
});

app.post("/api/alertas-cartao/:id/enviar-teams", async (request, response) => {
  try {
    const alerta = await get(
      `SELECT a.*,
              c.nome_cartao AS cartao,
              c.ultimos_4_digitos,
              ur.nome AS responsavel_cartao,
              ur.email AS responsavel_cartao_email,
              s.nome AS departamento,
              g.nome AS gerente_nome,
              g.email AS gerente_email,
              ifnull(t.estabelecimento, cc.fornecedor) AS estabelecimento,
              ifnull(t.valor, cc.valor) AS valor,
              ifnull(t.data_transacao, cc.data_compra) AS data_transacao,
              cc.fornecedor,
              cc.data_compra,
              uc.nome AS comprador_nome,
              uc.email AS comprador_email
       FROM alertas_cartao a
       JOIN cartoes_corporativos c ON c.id = a.cartao_id
       JOIN usuarios ur ON ur.id = c.responsavel_id
       JOIN setores s ON s.id = a.departamento_id
       JOIN usuarios g ON g.id = a.gerente_id
       LEFT JOIN transacoes_fatura t ON t.id = a.transacao_fatura_id
       LEFT JOIN compras_cartao cc ON cc.id = a.compra_cartao_id
       LEFT JOIN usuarios uc ON uc.id = cc.responsavel_compra_id
       WHERE a.id = ?`,
      [request.params.id]
    );
    if (!alerta) return response.status(404).json({ erro: "Alerta nao encontrado." });
    if (alerta.tipo_alerta === "compra_sem_registro") {
      alerta.destinatarios_departamento = await all(
        "SELECT id, nome, email FROM usuarios WHERE status = 'ativo' AND lower(setor) = lower(?) AND email IS NOT NULL AND email != '' ORDER BY nome",
        [alerta.departamento]
      );
    }
    const envio = await sendTeamsAlert(alerta);
    await run("UPDATE alertas_cartao SET enviado_teams = 1, data_envio_teams = CURRENT_TIMESTAMP, status = 'enviado' WHERE id = ?", [request.params.id]);
    response.json({ mensagem: "Notificacao Teams enviada/simulada.", envio });
  } catch (error) {
    response.status(502).json({ erro: "Erro ao chamar a automacao do Power Automate.", detalhe: error.message });
  }
});

app.post("/api/alertas-cartao/:id/enviar-teams-legado", async (request, response) => {
  const alerta = await get("SELECT * FROM alertas_cartao WHERE id = ?", [request.params.id]);
  if (!alerta) return response.status(404).json({ erro: "Alerta não encontrado." });
  await sendTeamsAlert(alerta);
  await run("UPDATE alertas_cartao SET enviado_teams = 1, data_envio_teams = CURRENT_TIMESTAMP, status = 'enviado' WHERE id = ?", [request.params.id]);
  response.json({ mensagem: "Notificação Teams enviada/simulada." });
});

app.patch("/api/alertas-cartao/:id/em-analise", async (request, response) => {
  await run("UPDATE alertas_cartao SET status = 'em_analise' WHERE id = ?", [request.params.id]);
  response.json({ mensagem: "Alerta marcado em análise." });
});

app.patch("/api/alertas-cartao/:id/resolver", async (request, response) => {
  if (!request.body.observacaoResolucao) return response.status(400).json({ erro: "Informe a observação de resolução." });
  await run("UPDATE alertas_cartao SET status = 'resolvido', resolvido_por_id = ?, resolvido_em = CURRENT_TIMESTAMP, observacao_resolucao = ? WHERE id = ?", [request.body.usuarioId || null, request.body.observacaoResolucao, request.params.id]);
  response.json({ mensagem: "Alerta resolvido." });
});

app.get("/api/dashboard/cartoes", async (_request, response) => {
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const ano = String(now.getFullYear());
  const prefixo = `${ano}-${mes}`;
  const [ativos, comprasMes, transacoesMes, semRegistro, alertasPendentes, semComprovante, divergencias, deptoMaior, cartaoMaior] = await Promise.all([
    get("SELECT COUNT(*) AS total FROM cartoes_corporativos WHERE status = 'ativo'"),
    get("SELECT COUNT(*) AS qtd, ifnull(SUM(valor), 0) AS total FROM compras_cartao WHERE data_compra LIKE ?", [`${prefixo}%`]),
    get("SELECT COUNT(*) AS total FROM transacoes_fatura WHERE data_transacao LIKE ?", [`${prefixo}%`]),
    get("SELECT COUNT(*) AS total FROM transacoes_fatura WHERE status_conciliacao = 'sem_registro'"),
    get("SELECT COUNT(*) AS total FROM alertas_cartao WHERE status != 'resolvido'"),
    get("SELECT COUNT(*) AS total FROM compras_cartao WHERE status = 'sem_comprovante'"),
    get("SELECT COUNT(*) AS total FROM conciliacoes_cartao WHERE status IN ('valor_divergente', 'data_divergente', 'aguardando_comprovante', 'sem_registro')"),
    get("SELECT s.nome AS nome, SUM(cc.valor) AS total FROM compras_cartao cc JOIN setores s ON s.id = cc.departamento_id GROUP BY s.nome ORDER BY total DESC LIMIT 1"),
    get("SELECT c.nome_cartao AS nome, SUM(cc.valor) AS total FROM compras_cartao cc JOIN cartoes_corporativos c ON c.id = cc.cartao_id GROUP BY c.nome_cartao ORDER BY total DESC LIMIT 1")
  ]);
  response.json({
    total_cartoes_ativos: ativos.total,
    compras_registradas_mes: comprasMes.qtd,
    valor_total_mes: comprasMes.total,
    transacoes_fatura_mes: transacoesMes.total,
    compras_sem_registro: semRegistro.total,
    alertas_pendentes: alertasPendentes.total,
    departamento_maior_gasto: deptoMaior?.nome || "-",
    cartao_maior_gasto: cartaoMaior?.nome || "-",
    compras_sem_comprovante: semComprovante.total,
    divergencias_abertas: divergencias.total
  });
});

function filtrosRelatorioComprasCartao(query) {
  const where = [];
  const params = [];
  if (query.departamentoId) {
    where.push("cc.departamento_id = ?");
    params.push(query.departamentoId);
  }
  if (query.cartaoId) {
    where.push("cc.cartao_id = ?");
    params.push(query.cartaoId);
  }
  if (query.categoria) {
    where.push("cc.categoria = ?");
    params.push(query.categoria);
  }
  if (query.status) {
    const statusCompra = {
      aguardando_comprovante: "sem_comprovante",
      valor_divergente: "divergente",
      data_divergente: "divergente",
      resolvida: "resolvida",
      conciliada: "conferida"
    }[query.status] || query.status;
    where.push("cc.status = ?");
    params.push(statusCompra);
  }
  if (query.dataInicial) {
    where.push("cc.data_compra >= ?");
    params.push(query.dataInicial);
  }
  if (query.dataFinal) {
    where.push("cc.data_compra <= ?");
    params.push(query.dataFinal);
  }
  return { where, params };
}

function filtrosRelatorioPendenciasCartao(query) {
  const where = [];
  const params = [];
  if (query.departamentoId) {
    where.push("c.departamento_id = ?");
    params.push(query.departamentoId);
  }
  if (query.cartaoId) {
    where.push("co.cartao_id = ?");
    params.push(query.cartaoId);
  }
  if (query.status) {
    where.push("co.status = ?");
    params.push(query.status);
  }
  if (query.dataInicial) {
    where.push("t.data_transacao >= ?");
    params.push(query.dataInicial);
  }
  if (query.dataFinal) {
    where.push("t.data_transacao <= ?");
    params.push(query.dataFinal);
  }
  return { where, params };
}

app.get("/api/relatorios-cartao/gastos-por-cartao", async (request, response) => {
  const { where, params } = filtrosRelatorioComprasCartao(request.query);
  response.json(await all(`SELECT c.nome_cartao AS cartao, s.nome AS departamento, SUM(cc.valor) AS total_gasto, COUNT(*) AS quantidade_compras, AVG(cc.valor) AS media_compra
                           FROM compras_cartao cc JOIN cartoes_corporativos c ON c.id = cc.cartao_id JOIN setores s ON s.id = cc.departamento_id
                           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                           GROUP BY c.id, s.nome ORDER BY total_gasto DESC`, params));
});

app.get("/api/relatorios-cartao/gastos-por-departamento", async (request, response) => {
  const { where, params } = filtrosRelatorioComprasCartao(request.query);
  const rows = await all(`SELECT s.nome AS departamento, SUM(cc.valor) AS total_gasto, COUNT(*) AS quantidade_compras
                          FROM compras_cartao cc JOIN setores s ON s.id = cc.departamento_id
                          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                          GROUP BY s.id ORDER BY total_gasto DESC`, params);
  const total = rows.reduce((sum, row) => sum + row.total_gasto, 0);
  response.json(rows.map((row) => ({ ...row, percentual: total ? (row.total_gasto / total) * 100 : 0 })));
});

app.get("/api/relatorios-cartao/gastos-por-categoria", async (request, response) => {
  const { where, params } = filtrosRelatorioComprasCartao(request.query);
  response.json(await all(`SELECT categoria, SUM(valor) AS total_gasto, COUNT(*) AS quantidade_compras
                           FROM compras_cartao cc
                           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                           GROUP BY categoria ORDER BY total_gasto DESC`, params));
});

app.get("/api/relatorios-cartao/pendencias", async (request, response) => {
  const { where, params } = filtrosRelatorioPendenciasCartao(request.query);
  response.json(await all(`SELECT co.status, COUNT(*) AS total
                           FROM conciliacoes_cartao co
                           JOIN cartoes_corporativos c ON c.id = co.cartao_id
                           JOIN transacoes_fatura t ON t.id = co.transacao_fatura_id
                           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                           GROUP BY co.status`, params));
});

app.get("/api/relatorios-cartao/compras", async (request, response) => {
  const { where, params } = filtrosRelatorioComprasCartao(request.query);
  response.json(await all(`SELECT cc.id, cc.data_compra, cc.valor, cc.fornecedor, cc.categoria, cc.status,
                                  c.nome_cartao AS cartao, s.nome AS departamento, u.nome AS responsavel
                           FROM compras_cartao cc
                           JOIN cartoes_corporativos c ON c.id = cc.cartao_id
                           JOIN setores s ON s.id = cc.departamento_id
                           JOIN usuarios u ON u.id = cc.responsavel_compra_id
                           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                           ORDER BY cc.data_compra DESC, cc.id DESC`, params));
});

app.get("/", (_request, response) => {
  response.sendFile(path.join(publicDir, "login.html"));
});

initDb()
  .then(ensureAdminUser)
  .then(ensureCartoesSeed)
  .then(ensureAlertasComprasSemComprovante)
  .then(() => {
    app.listen(port, host, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
      console.log(`Na rede local, acesse http://SEU-IP:${port}/login.html`);
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar banco:", error);
    process.exit(1);
  });
