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
const observacaoInput = document.getElementById("observacao");
const saidaMaterialNomeResumo = document.getElementById("saidaMaterialNomeResumo");
const saidaEstoqueDisponivel = document.getElementById("saidaEstoqueDisponivel");
const saidaEstoqueReservado = document.getElementById("saidaEstoqueReservado");
const saidaEstoqueMinimo = document.getElementById("saidaEstoqueMinimo");
const saidaResumoPeriodo = document.getElementById("saidaResumoPeriodo");
const saidaResumoSaidas = document.getElementById("saidaResumoSaidas");
const saidaResumoItens = document.getElementById("saidaResumoItens");
const saidaResumoMaterial = document.getElementById("saidaResumoMaterial");

function materialSelecionado() {
  return materiais.find((material) => material.id === Number(materialSelect.value));
}

function somaMovimentacoes(lista, materialId) {
  return lista
    .filter((item) => Number(item.materialId) === Number(materialId))
    .reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

function estoqueDisponivel(materialId) {
  return somaMovimentacoes(entradas, materialId) - somaMovimentacoes(saidas, materialId);
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
  quantidadeLabel.childNodes[0].textContent = registrarCaixas ? "Caixas " : "Unidades ";
  unidadesPorCaixaLabel.classList.toggle("hidden", !registrarCaixas);
  atualizarPainelRetirada();
}

function formatarQuantidade(valor, unidade) {
  const total = Number(valor || 0);
  return `${total.toLocaleString("pt-BR")} ${unidade || "unidade"}`;
}

function mesAnoAtual() {
  const data = new Date();
  return {
    mes: data.getMonth(),
    ano: data.getFullYear(),
    label: data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  };
}

function atualizarResumoMes() {
  const { mes, ano, label } = mesAnoAtual();
  const saidasDoMes = saidas.filter((saida) => {
    const data = new Date(`${saida.data}T00:00:00`);
    return data.getMonth() === mes && data.getFullYear() === ano;
  });
  const totalItens = saidasDoMes.reduce((total, saida) => total + Number(saida.quantidade || 0), 0);
  const material = materialSelecionado();

  saidaResumoPeriodo.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  saidaResumoSaidas.textContent = saidasDoMes.length.toLocaleString("pt-BR");
  saidaResumoItens.textContent = totalItens.toLocaleString("pt-BR");
  saidaResumoMaterial.textContent = material ? material.nome : "-";
}

function atualizarContadorObservacao() {
  const contador = observacaoInput?.parentElement?.querySelector("small");
  if (contador) {
    contador.textContent = `${observacaoInput.value.length}/500`;
  }
}

function atualizarPainelRetirada() {
  const material = materialSelecionado();

  if (!material) {
    saidaMaterialNomeResumo.textContent = "Selecione um material para ver o estoque disponível.";
    saidaEstoqueDisponivel.textContent = "-";
    saidaEstoqueReservado.textContent = "-";
    saidaEstoqueMinimo.textContent = "-";
    atualizarResumoMes();
    return;
  }

  const disponivel = estoqueDisponivel(material.id);
  saidaMaterialNomeResumo.textContent = `${material.nome} cadastrado em ${material.unidade || "unidade"}.`;
  saidaEstoqueDisponivel.textContent = formatarQuantidade(disponivel, material.unidade);
  saidaEstoqueReservado.textContent = formatarQuantidade(0, material.unidade);
  saidaEstoqueMinimo.textContent = formatarQuantidade(material.estoqueMinimo || 0, material.unidade);
  atualizarResumoMes();
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
  atualizarPainelRetirada();
  atualizarContadorObservacao();
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
  const material = materialSelecionado();
  const disponivel = estoqueDisponivel(novaSaida.materialId);

  if (novaSaida.quantidade > disponivel) {
    mensagemSucesso.textContent = `Saída rejeitada. Estoque disponível de ${material?.nome || "material"}: ${disponivel} ${material?.unidade || "unidade(s)"}. Quantidade solicitada: ${novaSaida.quantidade}.`;
    mensagemSucesso.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  try {
    const resposta = await fetch("/api/saidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaSaida)
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro.erro || "Erro ao registrar saída.");
    }

    const resultado = await resposta.json();
    saidas.unshift({ id: resultado.id, ...novaSaida });
    mensagemSucesso.textContent = "Saída registrada com sucesso no banco de dados.";
    mensagemSucesso.classList.remove("hidden");
    saidaForm.reset();
    preencherFormulario();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    mensagemSucesso.textContent = error.message || "Não foi possível registrar no banco. Verifique se o servidor está rodando.";
    mensagemSucesso.classList.remove("hidden");
    console.error(error);
  }
});

materialSelect.addEventListener("change", atualizarUnidadesPorCaixa);
tipoQuantidadeSelect.addEventListener("change", calcularTotalUnidades);
quantidadeInput.addEventListener("input", calcularTotalUnidades);
unidadesPorCaixaInput.addEventListener("input", calcularTotalUnidades);
observacaoInput?.addEventListener("input", atualizarContadorObservacao);
saidaForm.addEventListener("reset", function () {
  window.setTimeout(preencherFormulario, 0);
});
preencherFormulario();
