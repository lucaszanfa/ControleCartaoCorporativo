const CARTAO_CATEGORIAS = [
  "material_administrativo",
  "copa",
  "limpeza",
  "manutencao",
  "transporte",
  "servicos",
  "outros"
];

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function classeStatus(valor) {
  const status = String(valor || "").toLowerCase();
  const ok = ["ativo", "aprovado", "conciliada", "conferida", "registrada", "resolvida", "resolvido"];
  const pendencia = [
    "aguardando_comprovante",
    "com_pendencias",
    "data_divergente",
    "divergente",
    "em_analise",
    "enviado",
    "importada",
    "inativo",
    "pendente",
    "sem_comprovante",
    "sem_registro",
    "valor_divergente"
  ];

  if (ok.includes(status)) return "status status-ok";
  if (pendencia.includes(status)) return "status status-pending";
  return "status";
}

function preencherSelect(select, items, valueKey, labelKey, primeiraOpcao = "") {
  select.innerHTML = primeiraOpcao ? `<option value="">${primeiraOpcao}</option>` : "";
  select.innerHTML += items.map((item) => `<option value="${item[valueKey]}">${item[labelKey]}</option>`).join("");
}

function usuarioIdAtual() {
  return JSON.parse(localStorage.getItem("usuarioLogado") || "{}").id || 1;
}
