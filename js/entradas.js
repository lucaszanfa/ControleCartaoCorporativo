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
const observacaoEntradaInput = document.getElementById("observacaoEntrada");
const entradaMaterialNomeResumo = document.getElementById("entradaMaterialNomeResumo");
const entradaEstoqueAtual = document.getElementById("entradaEstoqueAtual");
const entradaQuantidadeResumo = document.getElementById("entradaQuantidadeResumo");
const entradaEstoqueFinal = document.getElementById("entradaEstoqueFinal");
const entradaResumoPeriodo = document.getElementById("entradaResumoPeriodo");
const entradaResumoEntradas = document.getElementById("entradaResumoEntradas");
const entradaResumoItens = document.getElementById("entradaResumoItens");
const entradaResumoValor = document.getElementById("entradaResumoValor");

function materialEntradaSelecionado() {
  return materiais.find((material) => material.id === Number(materialEntradaSelect.value));
}

function somaMovimentacoesEntrada(lista, materialId) {
  return lista
    .filter((item) => Number(item.materialId) === Number(materialId))
    .reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

function estoqueDisponivelEntrada(materialId) {
  return somaMovimentacoesEntrada(entradas, materialId) - somaMovimentacoesEntrada(saidas, materialId);
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
  quantidadeEntradaLabel.childNodes[0].textContent = registrarCaixas ? "Caixas " : "Unidades ";
  unidadesPorCaixaEntradaLabel.classList.toggle("hidden", !registrarCaixas);
  atualizarPainelEntrada();
}

function formatarQuantidadeEntrada(valor, unidade) {
  const total = Number(valor || 0);
  return `${total.toLocaleString("pt-BR")} ${unidade || "unidade"}`;
}

function formatarMoedaEntrada(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesAnoAtualEntrada() {
  const data = new Date();
  return {
    mes: data.getMonth(),
    ano: data.getFullYear(),
    label: data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  };
}

function atualizarResumoMesEntrada() {
  const { mes, ano, label } = mesAnoAtualEntrada();
  const entradasDoMes = entradas.filter((entrada) => {
    const data = new Date(`${entrada.data}T00:00:00`);
    return data.getMonth() === mes && data.getFullYear() === ano;
  });
  const totalItens = entradasDoMes.reduce((total, entrada) => total + Number(entrada.quantidade || 0), 0);
  const totalValor = entradasDoMes.reduce((total, entrada) => total + Number(entrada.valorTotal || 0), 0);

  entradaResumoPeriodo.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  entradaResumoEntradas.textContent = entradasDoMes.length.toLocaleString("pt-BR");
  entradaResumoItens.textContent = totalItens.toLocaleString("pt-BR");
  entradaResumoValor.textContent = formatarMoedaEntrada(totalValor);
}

function atualizarContadorObservacaoEntrada() {
  const contador = observacaoEntradaInput?.parentElement?.querySelector("small");
  if (contador) {
    contador.textContent = `${observacaoEntradaInput.value.length}/500`;
  }
}

function atualizarPainelEntrada() {
  const material = materialEntradaSelecionado();

  if (!material) {
    entradaMaterialNomeResumo.textContent = "Selecione um material para ver o impacto no estoque.";
    entradaEstoqueAtual.textContent = "-";
    entradaQuantidadeResumo.textContent = "-";
    entradaEstoqueFinal.textContent = "-";
    atualizarResumoMesEntrada();
    return;
  }

  const atual = estoqueDisponivelEntrada(material.id);
  const entradaInformada = Number(totalUnidadesEntradaInput.value || 0);
  entradaMaterialNomeResumo.textContent = `${material.nome} cadastrado em ${material.unidade || "unidade"}.`;
  entradaEstoqueAtual.textContent = formatarQuantidadeEntrada(atual, material.unidade);
  entradaQuantidadeResumo.textContent = formatarQuantidadeEntrada(entradaInformada, material.unidade);
  entradaEstoqueFinal.textContent = formatarQuantidadeEntrada(atual + entradaInformada, material.unidade);
  atualizarResumoMesEntrada();
}

function preencherMateriaisEntrada() {
  materialEntradaSelect.innerHTML = materiais
    .filter((material) => material.ativo)
    .map((material) => `<option value="${material.id}">${material.nome} (${material.unidade})</option>`)
    .join("");

  dataEntradaInput.value = new Date().toISOString().slice(0, 10);
  atualizarUnidadesPorCaixaEntrada();
  atualizarPainelEntrada();
  atualizarContadorObservacaoEntrada();
}

entradaForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const novaEntrada = {
    materialId: Number(materialEntradaSelect.value),
    quantidade: Number(totalUnidadesEntradaInput.value),
    valorTotal: Number(document.getElementById("valorEntrada").value),
    data: dataEntradaInput.value,
    observacao: observacaoEntradaInput.value
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
    mensagemEntradaSucesso.textContent = "Nao foi possivel registrar no banco. Verifique se o servidor esta rodando.";
    mensagemEntradaSucesso.classList.remove("hidden");
    console.error(error);
  }
});

materialEntradaSelect.addEventListener("change", atualizarUnidadesPorCaixaEntrada);
tipoQuantidadeEntradaSelect.addEventListener("change", calcularTotalUnidadesEntrada);
quantidadeEntradaInput.addEventListener("input", calcularTotalUnidadesEntrada);
unidadesPorCaixaEntradaInput.addEventListener("input", calcularTotalUnidadesEntrada);
observacaoEntradaInput?.addEventListener("input", atualizarContadorObservacaoEntrada);
entradaForm.addEventListener("reset", function () {
  window.setTimeout(preencherMateriaisEntrada, 0);
});
preencherMateriaisEntrada();
