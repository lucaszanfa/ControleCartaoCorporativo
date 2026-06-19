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

function preencherFiltrosHistorico() {
  filtroMaterial.innerHTML += materiais.map((material) => {
    return `<option value="${material.id}">${material.nome}</option>`;
  }).join("");

  filtroSetor.innerHTML += setores.map((setor) => {
    return `<option value="${setor}">${setor}</option>`;
  }).join("");
}

function formatarMoedaHistorico(valor) {
  if (!valor) {
    return "-";
  }

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

function renderizarHistorico() {
  const tipo = filtroTipo.value;
  const data = filtroData.value;
  const materialId = filtroMaterial.value;
  const setor = filtroSetor.value;
  const responsavel = filtroResponsavel.value.toLowerCase();

  const movimentacoesFiltradas = montarMovimentacoes().filter((movimentacao) => {
    const correspondeTipo = !tipo || movimentacao.tipo === tipo;
    const correspondeData = !data || movimentacao.data === data;
    const correspondeMaterial = !materialId || movimentacao.materialId === Number(materialId);
    const correspondeSetor = !setor || movimentacao.setor === setor;
    const correspondeResponsavel = movimentacao.responsavel.toLowerCase().includes(responsavel);
    return correspondeTipo && correspondeData && correspondeMaterial && correspondeSetor && correspondeResponsavel;
  });
  const totalSaidas = movimentacoesFiltradas.filter((movimentacao) => movimentacao.tipo === "saida").length;
  const totalEntradas = movimentacoesFiltradas.filter((movimentacao) => movimentacao.tipo === "entrada").length;
  const valorEntradas = movimentacoesFiltradas
    .filter((movimentacao) => movimentacao.tipo === "entrada")
    .reduce((total, movimentacao) => total + Number(movimentacao.valor || 0), 0);

  resumoMovimentacoes.textContent = movimentacoesFiltradas.length;
  resumoSaidas.textContent = totalSaidas;
  resumoEntradas.textContent = totalEntradas;
  resumoValorEntradas.textContent = formatarMoedaHistorico(valorEntradas);

  historicoTabela.innerHTML = movimentacoesFiltradas.map((movimentacao) => {
    const material = buscarMaterial(movimentacao.materialId);
    const tipoTexto = movimentacao.tipo === "entrada" ? "Entrada" : "Saída";
    const tipoClasse = movimentacao.tipo === "entrada" ? "history-badge-in" : "history-badge-out";

    return `
      <tr class="history-row history-row-${movimentacao.tipo}">
        <td><strong>${formatarData(movimentacao.data)}</strong></td>
        <td><span class="status ${tipoClasse}">${tipoTexto}</span></td>
        <td><strong>${material?.nome || "-"}</strong></td>
        <td><span class="history-quantity">${movimentacao.quantidade} ${material?.unidade || ""}</span></td>
        <td>${movimentacao.setor}</td>
        <td>${movimentacao.responsavel}</td>
        <td>${formatarMoedaHistorico(movimentacao.valor)}</td>
        <td>${movimentacao.detalhes}</td>
      </tr>
    `;
  }).join("");

  if (!movimentacoesFiltradas.length) {
    historicoTabela.innerHTML = `<tr><td class="empty-state" colspan="8">Nenhuma movimentação encontrada.</td></tr>`;
  }
}

preencherFiltrosHistorico();
renderizarHistorico();
[filtroTipo, filtroData, filtroMaterial, filtroSetor, filtroResponsavel].forEach((campo) => {
  campo.addEventListener("input", renderizarHistorico);
  campo.addEventListener("change", renderizarHistorico);
});
