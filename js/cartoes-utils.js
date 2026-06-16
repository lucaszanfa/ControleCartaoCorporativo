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

function preencherSelect(select, items, valueKey, labelKey, primeiraOpcao = "") {
  select.innerHTML = primeiraOpcao ? `<option value="">${primeiraOpcao}</option>` : "";
  select.innerHTML += items.map((item) => `<option value="${item[valueKey]}">${item[labelKey]}</option>`).join("");
}

function usuarioIdAtual() {
  return JSON.parse(localStorage.getItem("usuarioLogado") || "{}").id || 1;
}
