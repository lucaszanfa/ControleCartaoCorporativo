const materialSelect = document.getElementById("material");
const setorSelect = document.getElementById("setor");
const dataInput = document.getElementById("data");
const saidaForm = document.getElementById("saidaForm");
const mensagemSucesso = document.getElementById("mensagemSucesso");
const tipoQuantidadeSelect = document.getElementById("tipoQuantidade");
const quantidadeInput = document.getElementById("quantidade");
const unidadesPorCaixaInput = document.getElementById("unidadesPorCaixa");
const totalUnidadesInput = document.getElementById("totalUnidades");
const quantidadeLabel = document.getElementById("quantidadeLabel");
const unidadesPorCaixaLabel = document.getElementById("unidadesPorCaixaLabel");

function materialSelecionado() {
  return materiais.find((material) => material.id === Number(materialSelect.value));
}

function atualizarUnidadesPorCaixa() {
  const material = materialSelecionado();
  unidadesPorCaixaInput.value = material?.unidadesPorCaixa || 1;
  calcularTotalUnidades();
}

function calcularTotalUnidades() {
  const quantidade = Number(quantidadeInput.value) || 0;
  const unidadesPorCaixa = Number(unidadesPorCaixaInput.value) || 1;
  const registrarCaixas = tipoQuantidadeSelect.value === "caixas";
  const total = registrarCaixas ? quantidade * unidadesPorCaixa : quantidade;
  totalUnidadesInput.value = Math.max(1, total);
  quantidadeLabel.childNodes[0].textContent = registrarCaixas ? "Caixas" : "Unidades";
  unidadesPorCaixaLabel.classList.toggle("hidden", !registrarCaixas);
}

function preencherFormulario() {
  materialSelect.innerHTML = materiais
    .filter((material) => material.ativo)
    .map((material) => `<option value="${material.id}">${material.nome}</option>`)
    .join("");

  setorSelect.innerHTML = setores
    .map((setor) => `<option value="${setor}">${setor}</option>`)
    .join("");

  dataInput.value = new Date().toISOString().slice(0, 10);
  atualizarUnidadesPorCaixa();
}

saidaForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const novaSaida = {
    materialId: Number(materialSelect.value),
    quantidade: Number(totalUnidadesInput.value),
    data: dataInput.value,
    setor: setorSelect.value,
    responsavel: document.getElementById("responsavel").value,
    localUso: document.getElementById("localUso").value,
    motivo: document.getElementById("motivo").value,
    observacao: document.getElementById("observacao").value
  };

  try {
    const resposta = await fetch("/api/saidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaSaida)
    });

    if (!resposta.ok) {
      throw new Error("Erro ao registrar saída.");
    }

    const resultado = await resposta.json();
    saidas.unshift({ id: resultado.id, ...novaSaida });
    mensagemSucesso.textContent = "Saída registrada com sucesso no banco de dados.";
    mensagemSucesso.classList.remove("hidden");
    saidaForm.reset();
    preencherFormulario();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    mensagemSucesso.textContent = "Não foi possível registrar no banco. Verifique se o servidor está rodando.";
    mensagemSucesso.classList.remove("hidden");
    console.error(error);
  }
});

materialSelect.addEventListener("change", atualizarUnidadesPorCaixa);
tipoQuantidadeSelect.addEventListener("change", calcularTotalUnidades);
quantidadeInput.addEventListener("input", calcularTotalUnidades);
unidadesPorCaixaInput.addEventListener("input", calcularTotalUnidades);
preencherFormulario();
