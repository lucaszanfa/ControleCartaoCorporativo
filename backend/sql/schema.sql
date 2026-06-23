PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS materiais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS setores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL DEFAULT '123456',
  setor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  perfil TEXT NOT NULL DEFAULT 'usuario',
  pode_cadastrar_material INTEGER NOT NULL DEFAULT 0,
  pode_registrar_saida INTEGER NOT NULL DEFAULT 0,
  pode_registrar_entrada INTEGER NOT NULL DEFAULT 0,
  pode_ver_relatorios INTEGER NOT NULL DEFAULT 0,
  pode_administrar_usuarios INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL,
  data TEXT NOT NULL,
  setor TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  local_uso TEXT,
  motivo TEXT,
  observacao TEXT,
  FOREIGN KEY (material_id) REFERENCES materiais(id)
);

CREATE TABLE IF NOT EXISTS entradas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL,
  valor_total REAL NOT NULL,
  data TEXT NOT NULL,
  observacao TEXT,
  FOREIGN KEY (material_id) REFERENCES materiais(id)
);

CREATE TABLE IF NOT EXISTS cartoes_corporativos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_cartao TEXT NOT NULL,
  departamento_id INTEGER NOT NULL,
  responsavel_id INTEGER NOT NULL,
  gerente_id INTEGER NOT NULL,
  ultimos_4_digitos TEXT NOT NULL CHECK (length(ultimos_4_digitos) = 4 AND ultimos_4_digitos GLOB '[0-9][0-9][0-9][0-9]'),
  limite_mensal REAL CHECK (limite_mensal IS NULL OR limite_mensal >= 0),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  observacao TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (departamento_id) REFERENCES setores(id),
  FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
  FOREIGN KEY (gerente_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS compras_cartao (
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

CREATE TABLE IF NOT EXISTS faturas_cartao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cartao_id INTEGER NOT NULL,
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  arquivo_nome TEXT,
  importado_por_id INTEGER NOT NULL,
  data_importacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'importada' CHECK (status IN ('importada', 'em_conciliacao', 'conciliada', 'com_pendencias')),
  observacao TEXT,
  FOREIGN KEY (cartao_id) REFERENCES cartoes_corporativos(id),
  FOREIGN KEY (importado_por_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS transacoes_fatura (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fatura_id INTEGER NOT NULL,
  cartao_id INTEGER NOT NULL,
  data_transacao TEXT NOT NULL,
  estabelecimento TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor > 0),
  ultimos_4_digitos TEXT NOT NULL,
  codigo_autorizacao TEXT,
  categoria_detectada TEXT,
  status_conciliacao TEXT NOT NULL DEFAULT 'pendente' CHECK (status_conciliacao IN ('pendente', 'conciliada', 'sem_registro', 'valor_divergente', 'data_divergente', 'aguardando_comprovante', 'resolvida')),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fatura_id) REFERENCES faturas_cartao(id),
  FOREIGN KEY (cartao_id) REFERENCES cartoes_corporativos(id)
);

CREATE TABLE IF NOT EXISTS conciliacoes_cartao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transacao_fatura_id INTEGER NOT NULL,
  compra_cartao_id INTEGER,
  cartao_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('conciliada', 'sem_registro', 'valor_divergente', 'data_divergente', 'aguardando_comprovante', 'resolvida')),
  diferenca_valor REAL NOT NULL DEFAULT 0,
  diferenca_dias INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  conciliado_por_id INTEGER,
  conciliado_em TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transacao_fatura_id) REFERENCES transacoes_fatura(id),
  FOREIGN KEY (compra_cartao_id) REFERENCES compras_cartao(id),
  FOREIGN KEY (cartao_id) REFERENCES cartoes_corporativos(id),
  FOREIGN KEY (conciliado_por_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS alertas_cartao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cartao_id INTEGER NOT NULL,
  departamento_id INTEGER NOT NULL,
  gerente_id INTEGER NOT NULL,
  transacao_fatura_id INTEGER,
  compra_cartao_id INTEGER,
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('compra_sem_registro', 'compra_sem_comprovante', 'valor_divergente', 'data_divergente', 'compra_acima_limite', 'compra_fora_padrao')),
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'em_analise', 'resolvido')),
  enviado_teams INTEGER NOT NULL DEFAULT 0,
  data_envio_teams TEXT,
  resolvido_por_id INTEGER,
  resolvido_em TEXT,
  observacao_resolucao TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cartao_id) REFERENCES cartoes_corporativos(id),
  FOREIGN KEY (departamento_id) REFERENCES setores(id),
  FOREIGN KEY (gerente_id) REFERENCES usuarios(id),
  FOREIGN KEY (transacao_fatura_id) REFERENCES transacoes_fatura(id),
  FOREIGN KEY (compra_cartao_id) REFERENCES compras_cartao(id),
  FOREIGN KEY (resolvido_por_id) REFERENCES usuarios(id)
);
