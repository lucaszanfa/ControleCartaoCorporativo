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
const coresRelatorioCartao = ["#2563eb", "#14b8a6", "#8b5cf6", "#f59e0b", "#94a3b8", "#ef4444"];
let abaRelatorioCartaoAtiva = "cartao";

function linha(cells, options = {}) {
  const classes = ["report-data-row", options.destaque].filter(Boolean).join(" ");
  const classe = classes ? ` class="${classes}"` : "";
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
  return { query: qsRelatorio(), blocked: "" };
}

async function carregarFiltros() {
  const [departamentos, cartoes] = await Promise.all([
    fetch("/api/setores-detalhados").then((r) => r.json()),
    fetch("/api/cartoes").then((r) => r.json())
  ]);

  preencherSelect(document.getElementById("filtroDepartamento"), departamentos, "id", "nome", "Todos os departamentos");
  preencherSelect(document.getElementById("filtroCartao"), cartoes, "id", "nomeCartao", "Todos os cartões");
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

function prepararCanvasRelatorioCartao(canvas) {
  const ctx = canvas.getContext("2d");
  const escuro = document.documentElement.dataset.theme === "dark";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, escuro ? "#071d33" : "#ffffff");
  grad.addColorStop(1, escuro ? "#061426" : "#f8fbff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { ctx, escuro };
}

function filtrarComprasPorMes(compras, mesOffset) {
  const hoje = new Date();
  const data = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const prefixo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
  return {
    label: data.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
    total: compras
      .filter((compra) => String(compra.data_compra || "").startsWith(prefixo))
      .reduce((soma, compra) => soma + Number(compra.valor || 0), 0)
  };
}

function desenharGraficoTempo(compras) {
  const canvas = document.getElementById("graficoCartaoTempo");
  if (!canvas) return;
  const { ctx, escuro } = prepararCanvasRelatorioCartao(canvas);
  const pontos = [-5, -4, -3, -2, -1, 0].map((offset) => filtrarComprasPorMes(compras, offset));
  const maior = Math.max(1, ...pontos.map((item) => item.total));
  const margem = 58;
  const altura = canvas.height - 78;
  const baseY = altura + 34;
  const largura = canvas.width - margem * 2;

  ctx.strokeStyle = escuro ? "rgba(148, 163, 184, 0.18)" : "#e8eef7";
  ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const valor = maior * (i / 4);
    const y = baseY - (altura * i / 4);
    ctx.beginPath();
    ctx.moveTo(margem, y);
    ctx.lineTo(canvas.width - margem, y);
    ctx.stroke();
    ctx.fillText(moeda(valor).replace("R$", "R$ "), margem - 10, y);
  }

  const barraLargura = Math.min(56, largura / pontos.length * 0.45);
  pontos.forEach((item, index) => {
    const grupo = largura / pontos.length;
    const h = (item.total / maior) * altura;
    const x = margem + index * grupo + (grupo - barraLargura) / 2;
    const y = baseY - h;
    const grad = ctx.createLinearGradient(0, y, 0, baseY);
    grad.addColorStop(0, escuro ? "#22d3ee" : "#2563eb");
    grad.addColorStop(1, escuro ? "#0f766e" : "#14b8a6");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barraLargura, h, 7);
    ctx.fill();
    ctx.fillStyle = escuro ? "#dbeafe" : "#475569";
    ctx.textAlign = "center";
    ctx.font = "700 12px Arial";
    ctx.fillText(item.label, x + barraLargura / 2, baseY + 24);
  });
}

function dadosDistribuicaoAtual(relatorio) {
  if (abaRelatorioCartaoAtiva === "departamento") {
    return {
      titulo: "Por departamento",
      itens: relatorio.porDepartamento.map((item) => ({ nome: item.departamento, total: Number(item.total_gasto || 0) }))
    };
  }
  if (abaRelatorioCartaoAtiva === "categoria") {
    return {
      titulo: "Por categoria",
      itens: relatorio.porCategoria.map((item) => ({ nome: String(item.categoria || "-").replaceAll("_", " "), total: Number(item.total_gasto || 0) }))
    };
  }
  return {
    titulo: "Por cartão",
    itens: relatorio.porCartao.map((item) => ({ nome: item.cartao, total: Number(item.total_gasto || 0) }))
  };
}

function desenharGraficoDistribuicao(relatorio) {
  const canvas = document.getElementById("graficoCartaoDistribuicao");
  if (!canvas) return;
  const { ctx, escuro } = prepararCanvasRelatorioCartao(canvas);
  const { titulo, itens } = dadosDistribuicaoAtual(relatorio);
  const dados = itens.filter((item) => item.total > 0).slice(0, 6);
  const total = dados.reduce((soma, item) => soma + item.total, 0);
  let inicio = -Math.PI / 2;
  const cx = 130;
  const cy = 130;
  const raio = 92;
  document.getElementById("graficoCartaoDistribuicaoTitulo").textContent = titulo;

  if (!dados.length) {
    ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados para exibir.", canvas.width / 2, canvas.height / 2);
    document.getElementById("legendaCartaoDistribuicao").innerHTML = "";
    return;
  }

  dados.forEach((item, index) => {
    const angulo = (item.total / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, inicio, inicio + angulo);
    ctx.arc(cx, cy, 54, inicio + angulo, inicio, true);
    ctx.closePath();
    ctx.fillStyle = coresRelatorioCartao[index % coresRelatorioCartao.length];
    ctx.fill();
    inicio += angulo;
  });

  ctx.fillStyle = escuro ? "#071d33" : "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = escuro ? "#f8fbff" : "#0f1b3d";
  ctx.textAlign = "center";
  ctx.font = "700 15px Arial";
  ctx.fillText(moeda(total), cx, cy - 4);
  ctx.font = "12px Arial";
  ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
  ctx.fillText("Total", cx, cy + 18);

  document.getElementById("legendaCartaoDistribuicao").innerHTML = dados.map((item, index) => {
    const percentual = total ? ((item.total / total) * 100).toFixed(1).replace(".", ",") : "0";
    return `
      <div>
        <span><i style="background:${coresRelatorioCartao[index % coresRelatorioCartao.length]}"></i>${item.nome}</span>
        <strong>${percentual}%</strong>
        <small>${moeda(item.total)}</small>
      </div>
    `;
  }).join("");
}

function renderInsightsRelatorioCartao(relatorio) {
  const total = relatorio.porCartao.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
  const compras = relatorio.porCartao.reduce((sum, item) => sum + Number(item.quantidade_compras || 0), 0);
  const maior = relatorio.porCartao[0];
  const participacao = total && maior ? (Number(maior.total_gasto || 0) / total) * 100 : 0;

  document.getElementById("insightMaiorGasto").textContent = maior ? moeda(maior.total_gasto) : moeda(0);
  document.getElementById("insightMaiorGastoTexto").textContent = maior?.cartao || "-";
  document.getElementById("insightTicketMedio").textContent = moeda(compras ? total / compras : 0);
  document.getElementById("insightParticipacaoMaior").textContent = `${participacao.toFixed(1).replace(".", ",")}%`;
  document.getElementById("insightPeriodo").textContent = document.getElementById("filtroDataInicial").value || document.getElementById("filtroDataFinal").value ? "Personalizado" : "Todos";
}

function renderVisualRelatorioCartao() {
  if (!ultimoRelatorioCartao) return;
  desenharGraficoTempo(ultimoRelatorioCartao.comprasPeriodo);
  desenharGraficoDistribuicao(ultimoRelatorioCartao);
  renderInsightsRelatorioCartao(ultimoRelatorioCartao);
}

function renderTabelas({ porCartao, porDepartamento, porCategoria, pendencias, comprasPeriodo }) {
  document.getElementById("gastosCartaoTabela").innerHTML = porCartao.length
    ? porCartao.map((r) => linha([
        `<strong>${r.cartao}</strong>`,
        r.departamento,
        `<span class="report-money-pill">${moeda(r.total_gasto)}</span>`,
        `<span class="report-number-pill">${r.quantidade_compras}</span>`,
        `<span class="report-money-pill">${moeda(r.media_compra)}</span>`
      ])).join("")
    : vazio(5);

  document.getElementById("gastosDepartamentoTabela").innerHTML = porDepartamento.length
    ? porDepartamento.map((r) => linha([
        `<strong>${r.departamento}</strong>`,
        `<span class="report-money-pill">${moeda(r.total_gasto)}</span>`,
        `<span class="report-number-pill">${r.quantidade_compras}</span>`,
        `<span class="report-number-pill">${Number(r.percentual || 0).toFixed(1)}%</span>`
      ])).join("")
    : vazio(4);

  document.getElementById("gastosCategoriaTabela").innerHTML = porCategoria.length
    ? porCategoria.map((r) => linha([
        String(r.categoria || "-").replaceAll("_", " "),
        `<span class="report-money-pill">${moeda(r.total_gasto)}</span>`,
        `<span class="report-number-pill">${r.quantidade_compras}</span>`
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
        `<span class="report-money-pill">${moeda(r.valor)}</span>`,
        `<span class="${classeStatus(r.status)}">${String(r.status || "-").replaceAll("_", " ")}</span>`
      ])).join("")
    : vazio(8, "Nenhuma compra encontrada para o período selecionado.");

  document.getElementById("pendenciasTabela").innerHTML = pendencias.length
    ? pendencias.map((r) => linha([
        `<span class="${classeStatus(r.status)}">${String(r.status || "-").replaceAll("_", " ")}</span>`,
        `<span class="report-number-pill">${r.total}</span>`
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
  renderVisualRelatorioCartao();
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
    { label: "Listagem de compras", value: "Mesmo filtro do relatório" }
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
  ["filtroDepartamento", "filtroCartao", "filtroCategoria", "filtroStatus", "filtroDataInicial", "filtroDataFinal"].forEach((id) => {
    document.getElementById(id).addEventListener("change", carregarRelatoriosCartao);
  });

  document.getElementById("limparFiltros").addEventListener("click", () => {
    ["filtroDepartamento", "filtroCartao", "filtroCategoria", "filtroStatus", "filtroDataInicial", "filtroDataFinal"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    carregarRelatoriosCartao();
  });

  document.getElementById("baixarPdfCartao").addEventListener("click", baixarPdfRelatorioCartao);

  document.querySelectorAll(".report-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".report-tabs button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".report-panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
      abaRelatorioCartaoAtiva = button.dataset.tab;
      renderVisualRelatorioCartao();
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#themeToggle")) {
      window.setTimeout(renderVisualRelatorioCartao, 0);
    }
  });
}

async function initRelatoriosCartao() {
  await carregarFiltros();
  configurarEventos();
  await carregarRelatoriosCartao();
}

initRelatoriosCartao();
