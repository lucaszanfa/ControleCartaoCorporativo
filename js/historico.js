const filtroTipo = document.getElementById("filtroTipo");
const filtroData = document.getElementById("filtroData");
const filtroMaterial = document.getElementById("filtroMaterial");
const filtroSetor = document.getElementById("filtroSetor");
const filtroResponsavel = document.getElementById("filtroResponsavel");
const historicoTabela = document.getElementById("historicoTabela");
const resumoMovimentacoes = document.getElementById("resumoMovimentacoes");
const resumoSaidas = document.getElementById("resumoSaidas");
const resumoEntradas = document.getElementById("resumoEntradas");
const resumoValorEntradas = document.getElementById("resumoValorEntradas");
const historyTypeTabs = document.querySelectorAll(".history-type-tabs button");

function preencherFiltrosHistorico() {
  filtroMaterial.innerHTML += materiais.map((material) => {
    return `<option value="${material.id}">${material.nome}</option>`;
  }).join("");

  filtroSetor.innerHTML += setores.map((setor) => {
    return `<option value="${setor}">${setor}</option>`;
  }).join("");
}

function formatarMoedaHistorico(valor) {
  if (!valor) return "-";

  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function montarMovimentacoes() {
  const movimentacoesSaida = saidas.map((saida) => ({
    tipo: "saida",
    data: saida.data,
    materialId: saida.materialId,
    quantidade: saida.quantidade,
    setor: saida.setor,
    responsavel: saida.responsavel,
    valor: null,
    detalhes: `${saida.localUso || "-"} | ${saida.motivo || "-"}`
  }));

  const movimentacoesEntrada = entradas.map((entrada) => ({
    tipo: "entrada",
    data: entrada.data,
    materialId: entrada.materialId,
    quantidade: entrada.quantidade,
    setor: "Geral",
    responsavel: "Compra da empresa",
    valor: entrada.valorTotal,
    detalhes: entrada.observacao || "Entrada de material"
  }));

  return [...movimentacoesSaida, ...movimentacoesEntrada]
    .sort((a, b) => b.data.localeCompare(a.data));
}

function atualizarResumo(movimentacoesFiltradas) {
  const totalSaidas = movimentacoesFiltradas.filter((movimentacao) => movimentacao.tipo === "saida").length;
  const totalEntradas = movimentacoesFiltradas.filter((movimentacao) => movimentacao.tipo === "entrada").length;
  const valorEntradas = movimentacoesFiltradas
    .filter((movimentacao) => movimentacao.tipo === "entrada")
    .reduce((total, movimentacao) => total + Number(movimentacao.valor || 0), 0);

  resumoMovimentacoes.textContent = movimentacoesFiltradas.length;
  resumoSaidas.textContent = totalSaidas;
  resumoEntradas.textContent = totalEntradas;
  resumoValorEntradas.textContent = formatarMoedaHistorico(valorEntradas);
}

function movimentacoesFiltradas() {
  const tipo = filtroTipo.value;
  const data = filtroData.value;
  const materialId = filtroMaterial.value;
  const setor = filtroSetor.value;
  const responsavel = filtroResponsavel.value.toLowerCase();

  return montarMovimentacoes().filter((movimentacao) => {
    const correspondeTipo = !tipo || movimentacao.tipo === tipo;
    const correspondeData = !data || movimentacao.data === data;
    const correspondeMaterial = !materialId || movimentacao.materialId === Number(materialId);
    const correspondeSetor = !setor || movimentacao.setor === setor;
    const correspondeResponsavel = movimentacao.responsavel.toLowerCase().includes(responsavel);
    return correspondeTipo && correspondeData && correspondeMaterial && correspondeSetor && correspondeResponsavel;
  });
}

function renderizarTabsTipo() {
  historyTypeTabs.forEach((botao) => {
    botao.classList.toggle("active", botao.dataset.tipo === filtroTipo.value);
  });
}

function renderizarHistorico() {
  const lista = movimentacoesFiltradas();

  atualizarResumo(lista);
  renderizarTabsTipo();

  if (!lista.length) {
    historicoTabela.innerHTML = `<tr><td class="empty-state" colspan="8">Nenhuma movimentacao encontrada.</td></tr>`;
    return;
  }

  historicoTabela.innerHTML = lista.map((movimentacao) => {
    const material = buscarMaterial(movimentacao.materialId);
    const entrada = movimentacao.tipo === "entrada";
    const tipoTexto = entrada ? "Entrada" : "Saida";
    const tipoClasse = entrada ? "history-badge-in" : "history-badge-out";
    const tipoIcone = entrada ? "↓" : "↗";
    const detalhePrincipal = entrada ? "Reposicao de estoque" : movimentacao.setor;
    const detalheSecundario = entrada ? movimentacao.detalhes : `${movimentacao.responsavel} | ${movimentacao.detalhes}`;

    return `
      <tr class="history-row history-row-${movimentacao.tipo}">
        <td>
          <div class="history-date">
            <strong>${formatarData(movimentacao.data)}</strong>
            <span>${tipoTexto}</span>
          </div>
        </td>
        <td><span class="status ${tipoClasse}"><em>${tipoIcone}</em>${tipoTexto}</span></td>
        <td>
          <div class="history-material-cell">
            <strong>${material?.nome || "-"}</strong>
            <span>${detalhePrincipal}</span>
          </div>
        </td>
        <td><span class="history-quantity">${movimentacao.quantidade} ${material?.unidade || ""}</span></td>
        <td>${movimentacao.setor}</td>
        <td>${movimentacao.responsavel}</td>
        <td>${formatarMoedaHistorico(movimentacao.valor)}</td>
        <td>${detalheSecundario}</td>
      </tr>
    `;
  }).join("");
}

preencherFiltrosHistorico();
renderizarHistorico();

[filtroTipo, filtroData, filtroMaterial, filtroSetor, filtroResponsavel].forEach((campo) => {
  campo.addEventListener("input", renderizarHistorico);
  campo.addEventListener("change", renderizarHistorico);
});

historyTypeTabs.forEach((botao) => {
  botao.addEventListener("click", () => {
    filtroTipo.value = botao.dataset.tipo;
    renderizarHistorico();
  });
});
