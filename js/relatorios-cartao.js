const categoriasRelatorioCartao = [
  "material_administrativo",
  "copa",
  "limpeza",
  "manutencao",
  "transporte",
  "servicos",
  "outros"
];
let ultimoRelatorioCartao = null;

function linha(cells, options = {}) {
  const classe = options.destaque ? ` class="${options.destaque}"` : "";
  return `<tr${classe}>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

function vazio(colspan, texto = "Nenhum registro encontrado para os filtros selecionados.") {
  return `<tr><td colspan="${colspan}" class="empty-state">${texto}</td></tr>`;
}

function qsRelatorio() {
  const qs = new URLSearchParams();
  const departamentoId = document.getElementById("filtroDepartamento").value;
  const cartaoId = document.getElementById("filtroCartao").value;
  const categoria = document.getElementById("filtroCategoria").value;
  const status = document.getElementById("filtroStatus").value;
  const dataInicial = document.getElementById("filtroDataInicial").value;
  const dataFinal = document.getElementById("filtroDataFinal").value;

  if (departamentoId) qs.set("departamentoId", departamentoId);
  if (cartaoId) qs.set("cartaoId", cartaoId);
  if (categoria) qs.set("categoria", categoria);
  if (status) qs.set("status", status);
  if (dataInicial) qs.set("dataInicial", dataInicial);
  if (dataFinal) qs.set("dataFinal", dataFinal);
  return qs.toString();
}

function qsComprasPeriodo() {
  const qs = new URLSearchParams();
  const tipo = document.getElementById("filtroTipoCompras").value;
  const cartaoId = document.getElementById("filtroComprasCartao").value;
  const departamentoId = document.getElementById("filtroComprasDepartamento").value;
  const categoria = document.getElementById("filtroCategoria").value;
  const dataInicial = document.getElementById("filtroDataInicial").value;
  const dataFinal = document.getElementById("filtroDataFinal").value;

  if (tipo === "cartao" && !cartaoId) return { query: "", blocked: "Selecione um cartão para listar as compras." };
  if (tipo === "departamento" && !departamentoId) return { query: "", blocked: "Selecione um departamento para listar as compras." };

  if (tipo === "cartao") qs.set("cartaoId", cartaoId);
  if (tipo === "departamento") qs.set("departamentoId", departamentoId);
  if (categoria) qs.set("categoria", categoria);
  if (dataInicial) qs.set("dataInicial", dataInicial);
  if (dataFinal) qs.set("dataFinal", dataFinal);
  return { query: qs.toString(), blocked: "" };
}

async function carregarFiltros() {
  const [departamentos, cartoes] = await Promise.all([
    fetch("/api/setores-detalhados").then((r) => r.json()),
    fetch("/api/cartoes").then((r) => r.json())
  ]);

  preencherSelect(document.getElementById("filtroDepartamento"), departamentos, "id", "nome", "Todos os departamentos");
  preencherSelect(document.getElementById("filtroCartao"), cartoes, "id", "nomeCartao", "Todos os cartões");
  preencherSelect(document.getElementById("filtroComprasDepartamento"), departamentos, "id", "nome", "Selecione um departamento");
  preencherSelect(document.getElementById("filtroComprasCartao"), cartoes, "id", "nomeCartao", "Selecione um cartão");
  document.getElementById("filtroCategoria").innerHTML = [
    '<option value="">Todas as categorias</option>',
    ...categoriasRelatorioCartao.map((categoria) => `<option value="${categoria}">${categoria.replaceAll("_", " ")}</option>`)
  ].join("");
}

function renderResumo({ porCartao, porDepartamento, pendencias }) {
  const total = porCartao.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
  const compras = porCartao.reduce((sum, item) => sum + Number(item.quantidade_compras || 0), 0);
  const maiorDepartamento = porDepartamento[0]?.departamento || "-";
  const totalPendencias = pendencias
    .filter((item) => item.status !== "conciliada" && item.status !== "resolvida")
    .reduce((sum, item) => sum + Number(item.total || 0), 0);

  document.getElementById("resumoTotal").textContent = moeda(total);
  document.getElementById("resumoCompras").textContent = compras;
  document.getElementById("resumoDepartamento").textContent = maiorDepartamento;
  document.getElementById("resumoPendencias").textContent = totalPendencias;
}

function renderTabelas({ porCartao, porDepartamento, porCategoria, pendencias, comprasPeriodo }) {
  document.getElementById("gastosCartaoTabela").innerHTML = porCartao.length
    ? porCartao.map((r) => linha([
        `<strong>${r.cartao}</strong>`,
        r.departamento,
        moeda(r.total_gasto),
        r.quantidade_compras,
        moeda(r.media_compra)
      ])).join("")
    : vazio(5);

  document.getElementById("gastosDepartamentoTabela").innerHTML = porDepartamento.length
    ? porDepartamento.map((r) => linha([
        `<strong>${r.departamento}</strong>`,
        moeda(r.total_gasto),
        r.quantidade_compras,
        `${Number(r.percentual || 0).toFixed(1)}%`
      ])).join("")
    : vazio(4);

  document.getElementById("gastosCategoriaTabela").innerHTML = porCategoria.length
    ? porCategoria.map((r) => linha([
        String(r.categoria || "-").replaceAll("_", " "),
        moeda(r.total_gasto),
        r.quantidade_compras
      ])).join("")
    : vazio(3);

  document.getElementById("comprasPeriodoTabela").innerHTML = comprasPeriodo.length
    ? comprasPeriodo.map((r) => linha([
        formatarData(r.data_compra),
        `<strong>${r.cartao}</strong>`,
        r.departamento,
        r.responsavel,
        r.fornecedor,
        String(r.categoria || "-").replaceAll("_", " "),
        moeda(r.valor),
        `<span class="${classeStatus(r.status)}">${String(r.status || "-").replaceAll("_", " ")}</span>`
      ])).join("")
    : vazio(8, "Nenhuma compra encontrada para o período selecionado.");

  document.getElementById("pendenciasTabela").innerHTML = pendencias.length
    ? pendencias.map((r) => linha([
        `<span class="${classeStatus(r.status)}">${String(r.status || "-").replaceAll("_", " ")}</span>`,
        r.total
      ], { destaque: r.status !== "conciliada" && r.status !== "resolvida" ? "row-inactive" : "" })).join("")
    : vazio(2, "Nenhuma pendência encontrada.");
}

async function carregarRelatoriosCartao() {
  const query = qsRelatorio();
  const suffix = query ? `?${query}` : "";
  const comprasFiltro = qsComprasPeriodo();
  const comprasPromise = comprasFiltro.blocked
    ? Promise.resolve({ blocked: comprasFiltro.blocked, rows: [] })
    : fetch(`/api/relatorios-cartao/compras${comprasFiltro.query ? `?${comprasFiltro.query}` : ""}`).then((r) => r.json()).then((rows) => ({ blocked: "", rows }));

  const [porCartao, porDepartamento, porCategoria, pendencias, comprasResultado] = await Promise.all([
    fetch(`/api/relatorios-cartao/gastos-por-cartao${suffix}`).then((r) => r.json()),
    fetch(`/api/relatorios-cartao/gastos-por-departamento${suffix}`).then((r) => r.json()),
    fetch(`/api/relatorios-cartao/gastos-por-categoria${suffix}`).then((r) => r.json()),
    fetch(`/api/relatorios-cartao/pendencias${suffix}`).then((r) => r.json()),
    comprasPromise
  ]);

  ultimoRelatorioCartao = {
    porCartao,
    porDepartamento,
    porCategoria,
    pendencias,
    comprasPeriodo: comprasResultado.rows,
    comprasBloqueadas: comprasResultado.blocked || ""
  };
  renderResumo({ porCartao, porDepartamento, pendencias });
  renderTabelas({ porCartao, porDepartamento, porCategoria, pendencias, comprasPeriodo: comprasResultado.rows });
  if (comprasResultado.blocked) {
    document.getElementById("comprasPeriodoTabela").innerHTML = vazio(8, comprasResultado.blocked);
  }
}

function textoSelecionadoCartao(id) {
  const select = document.getElementById(id);
  return select.options[select.selectedIndex]?.textContent || "-";
}

function baixarPdfRelatorioCartao() {
  if (!ultimoRelatorioCartao) return;

  const { porCartao, porDepartamento, porCategoria, pendencias, comprasPeriodo, comprasBloqueadas } = ultimoRelatorioCartao;
  const total = porCartao.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
  const compras = porCartao.reduce((sum, item) => sum + Number(item.quantidade_compras || 0), 0);
  const totalPendencias = pendencias
    .filter((item) => item.status !== "conciliada" && item.status !== "resolvida")
    .reduce((sum, item) => sum + Number(item.total || 0), 0);

  const pdf = new PdfReport({
    title: "Relatorio de cartoes corporativos",
    subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")} - Filtros selecionados`
  });

  pdf.section("Filtros selecionados");
  pdf.keyValues([
    { label: "Departamento", value: textoSelecionadoCartao("filtroDepartamento") },
    { label: "Cartao", value: textoSelecionadoCartao("filtroCartao") },
    { label: "Categoria", value: textoSelecionadoCartao("filtroCategoria") },
    { label: "Status da pendencia", value: textoSelecionadoCartao("filtroStatus") },
    { label: "Data inicial", value: document.getElementById("filtroDataInicial").value || "-" },
    { label: "Data final", value: document.getElementById("filtroDataFinal").value || "-" },
    { label: "Tipo compras", value: textoSelecionadoCartao("filtroTipoCompras") },
    { label: "Cartao compras", value: textoSelecionadoCartao("filtroComprasCartao") },
    { label: "Departamento compras", value: textoSelecionadoCartao("filtroComprasDepartamento") }
  ]);

  pdf.section("Resumo executivo");
  pdf.keyValues([
    { label: "Total gasto", value: moeda(total) },
    { label: "Compras registradas", value: compras },
    { label: "Maior departamento", value: porDepartamento[0]?.departamento || "-" },
    { label: "Pendencias abertas", value: totalPendencias }
  ]);

  pdf.section("Gastos por cartao");
  pdf.table(
    ["Cartao", "Departamento", "Total", "Compras", "Media"],
    porCartao.map((r) => [r.cartao, r.departamento, moeda(r.total_gasto), r.quantidade_compras, moeda(r.media_compra)]),
    [210, 170, 105, 75, 105]
  );

  pdf.section("Gastos por departamento");
  pdf.table(
    ["Departamento", "Total", "Compras", "Participacao"],
    porDepartamento.map((r) => [r.departamento, moeda(r.total_gasto), r.quantidade_compras, `${Number(r.percentual || 0).toFixed(1)}%`]),
    [260, 130, 90, 110]
  );

  pdf.section("Compras por categoria");
  pdf.table(
    ["Categoria", "Total", "Compras"],
    porCategoria.map((r) => [String(r.categoria || "-").replaceAll("_", " "), moeda(r.total_gasto), r.quantidade_compras]),
    [260, 130, 90]
  );

  pdf.section("Pendencias de conciliacao");
  pdf.table(
    ["Status", "Total"],
    pendencias.map((r) => [String(r.status || "-").replaceAll("_", " "), r.total]),
    [260, 80]
  );

  pdf.section("Compras do periodo");
  if (comprasBloqueadas) {
    pdf.text(comprasBloqueadas, pdf.margin, pdf.y, { size: 10 });
  } else {
    pdf.table(
      ["Data", "Cartao", "Departamento", "Responsavel", "Fornecedor", "Categoria", "Valor", "Status"],
      comprasPeriodo.map((r) => [
        formatarData(r.data_compra),
        r.cartao,
        r.departamento,
        r.responsavel,
        r.fornecedor,
        String(r.categoria || "-").replaceAll("_", " "),
        moeda(r.valor),
        String(r.status || "-").replaceAll("_", " ")
      ]),
      [62, 115, 100, 95, 125, 85, 70, 85]
    );
  }

  pdf.output(`relatorio-cartoes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function configurarEventos() {
  ["filtroDepartamento", "filtroCartao", "filtroCategoria", "filtroStatus", "filtroDataInicial", "filtroDataFinal", "filtroTipoCompras", "filtroComprasCartao", "filtroComprasDepartamento"].forEach((id) => {
    document.getElementById(id).addEventListener("change", carregarRelatoriosCartao);
  });

  document.getElementById("limparFiltros").addEventListener("click", () => {
    ["filtroDepartamento", "filtroCartao", "filtroCategoria", "filtroStatus", "filtroDataInicial", "filtroDataFinal", "filtroTipoCompras", "filtroComprasCartao", "filtroComprasDepartamento"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("filtroTipoCompras").value = "geral";
    carregarRelatoriosCartao();
  });

  document.getElementById("baixarPdfCartao").addEventListener("click", baixarPdfRelatorioCartao);

  document.querySelectorAll(".report-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".report-tabs button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".report-panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
    });
  });
}

async function initRelatoriosCartao() {
  await carregarFiltros();
  configurarEventos();
  await carregarRelatoriosCartao();
}

initRelatoriosCartao();
