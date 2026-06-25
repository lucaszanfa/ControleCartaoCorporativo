const materialEntradaSelect = document.getElementById("materialEntrada");
const dataEntradaInput = document.getElementById("dataEntrada");
const entradaForm = document.getElementById("entradaForm");
const mensagemEntradaSucesso = document.getElementById("mensagemEntradaSucesso");
const tipoQuantidadeEntradaSelect = document.getElementById("tipoQuantidadeEntrada");
const quantidadeEntradaInput = document.getElementById("quantidadeEntrada");
const unidadesPorCaixaEntradaInput = document.getElementById("unidadesPorCaixaEntrada");
const totalUnidadesEntradaInput = document.getElementById("totalUnidadesEntrada");
const quantidadeEntradaLabel = document.getElementById("quantidadeEntradaLabel");
const unidadesPorCaixaEntradaLabel = document.getElementById("unidadesPorCaixaEntradaLabel");

function materialEntradaSelecionado() {
  return materiais.find((material) => material.id === Number(materialEntradaSelect.value));
}

function atualizarUnidadesPorCaixaEntrada() {
  const material = materialEntradaSelecionado();
  unidadesPorCaixaEntradaInput.value = material?.unidadesPorCaixa || 1;
  calcularTotalUnidadesEntrada();
}

function calcularTotalUnidadesEntrada() {
  const quantidade = Number(quantidadeEntradaInput.value) || 0;
  const unidadesPorCaixa = Number(unidadesPorCaixaEntradaInput.value) || 1;
  const registrarCaixas = tipoQuantidadeEntradaSelect.value === "caixas";
  const total = registrarCaixas ? quantidade * unidadesPorCaixa : quantidade;
  totalUnidadesEntradaInput.value = Math.max(1, total);
  quantidadeEntradaLabel.childNodes[0].textContent = registrarCaixas ? "Caixas" : "Unidades";
  unidadesPorCaixaEntradaLabel.classList.toggle("hidden", !registrarCaixas);
}

function preencherMateriaisEntrada() {
  materialEntradaSelect.innerHTML = materiais
    .filter((material) => material.ativo)
    .map((material) => `<option value="${material.id}">${material.nome} (${material.unidade})</option>`)
    .join("");

  dataEntradaInput.value = new Date().toISOString().slice(0, 10);
  atualizarUnidadesPorCaixaEntrada();
}

entradaForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const novaEntrada = {
    materialId: Number(materialEntradaSelect.value),
    quantidade: Number(totalUnidadesEntradaInput.value),
    valorTotal: Number(document.getElementById("valorEntrada").value),
    data: dataEntradaInput.value,
    observacao: document.getElementById("observacaoEntrada").value
  };

  try {
    const resposta = await fetch("/api/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaEntrada)
    });

    if (!resposta.ok) {
      throw new Error("Erro ao registrar entrada.");
    }

    const resultado = await resposta.json();
    entradas.unshift({ id: resultado.id, ...novaEntrada });
    mensagemEntradaSucesso.textContent = "Entrada registrada com sucesso no banco de dados.";
    mensagemEntradaSucesso.classList.remove("hidden");
    entradaForm.reset();
    preencherMateriaisEntrada();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    mensagemEntradaSucesso.textContent = "Não foi possível registrar no banco. Verifique se o servidor está rodando.";
    mensagemEntradaSucesso.classList.remove("hidden");
    console.error(error);
  }
});

materialEntradaSelect.addEventListener("change", atualizarUnidadesPorCaixaEntrada);
tipoQuantidadeEntradaSelect.addEventListener("change", calcularTotalUnidadesEntrada);
quantidadeEntradaInput.addEventListener("input", calcularTotalUnidadesEntrada);
unidadesPorCaixaEntradaInput.addEventListener("input", calcularTotalUnidadesEntrada);
preencherMateriaisEntrada();
