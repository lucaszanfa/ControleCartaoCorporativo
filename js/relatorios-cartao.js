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
  const status = document.getElementById("filtroStatus").value;
  const dataInicial = document.getElementById("filtroDataInicial").value;
  const dataFinal = document.getElementById("filtroDataFinal").value;

  if (departamentoId) qs.set("departamentoId", departamentoId);
  if (cartaoId) qs.set("cartaoId", cartaoId);
  if (status) qs.set("status", status);
  if (dataInicial) qs.set("dataInicial", dataInicial);
  if (dataFinal) qs.set("dataFinal", dataFinal);
  qs.set("usuarioId", usuarioIdAtual());
  return qs.toString();
}

function qsComprasPeriodo() {
  return { query: qsRelatorio(), blocked: "" };
}

async function carregarFiltros() {
  const [departamentos, cartoes] = await Promise.all([
    fetch("/api/setores-detalhados").then((r) => r.json()),
    fetch(`/api/cartoes?usuarioId=${usuarioIdAtual()}&permissao=ver`).then((r) => r.json())
  ]);

  preencherSelect(document.getElementById("filtroDepartamento"), departamentos, "id", "nome", "Todos os departamentos");
  preencherSelect(document.getElementById("filtroCartao"), cartoes, "id", "nomeCartao", "Todos os cartões");
}

function definirPeriodoPadraoMesAtual() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const paraISO = (data) => data.toISOString().slice(0, 10);

  document.getElementById("filtroDataInicial").value = paraISO(primeiroDia);
  document.getElementById("filtroDataFinal").value = paraISO(ultimoDia);
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

function agruparValorPorMes(compras) {
  const mapa = new Map();
  (compras || []).forEach((compra) => {
    const chave = String(compra.data_compra || "").slice(0, 7);
    if (!chave) return;
    mapa.set(chave, (mapa.get(chave) || 0) + Number(compra.valor || 0));
  });
  return mapa;
}

function rotuloMesAno(chaveAnoMes) {
  const [ano, mes] = chaveAnoMes.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

function mesesEntre(dataInicioISO, dataFimISO) {
  if (!dataInicioISO || !dataFimISO) return [];
  const resultado = [];
  const [anoIni, mesIni] = dataInicioISO.split("-").map(Number);
  const [anoFim, mesFim] = dataFimISO.split("-").map(Number);
  let ano = anoIni;
  let mes = mesIni;
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    resultado.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return resultado;
}

function formatarIntervaloCurto(dataInicioISO, dataFimISO) {
  return `${formatarData(dataInicioISO)} – ${formatarData(dataFimISO)}`;
}

function calcularTicksEixoY(valorMaximo, quantidade = 4) {
  if (!valorMaximo || valorMaximo <= 0) return [0, 1];
  const passoBruto = valorMaximo / quantidade;
  const magnitude = Math.pow(10, Math.floor(Math.log10(passoBruto)));
  const normalizado = passoBruto / magnitude;
  let passo;
  if (normalizado <= 1) passo = 1;
  else if (normalizado <= 2) passo = 2;
  else if (normalizado <= 5) passo = 5;
  else passo = 10;
  passo *= magnitude;

  const ticks = [];
  let valor = 0;
  while (valor < valorMaximo + passo * 0.999) {
    ticks.push(Math.round(valor));
    valor += passo;
  }
  return ticks;
}

function calcularMargemEixoY(ctx, ticks) {
  ctx.font = "12px Arial";
  const larguras = ticks.map((valor) => ctx.measureText(moeda(valor).replace("R$", "R$ ")).width);
  return Math.max(50, Math.ceil(Math.max(...larguras)) + 18);
}

function desenharGradeEixoY(ctx, ticks, valorTopo, margem, altura, baseY, largura, escuro) {
  ctx.strokeStyle = escuro ? "rgba(148, 163, 184, 0.18)" : "#e8eef7";
  ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ticks.forEach((valor) => {
    const y = baseY - (altura * valor / valorTopo);
    ctx.beginPath();
    ctx.moveTo(margem, y);
    ctx.lineTo(margem + largura, y);
    ctx.stroke();
    ctx.fillText(moeda(valor).replace("R$", "R$ "), margem - 10, y);
  });
}

let barrasGraficoTempo = [];

function desenharGraficoTempo(relatorio) {
  const canvas = document.getElementById("graficoCartaoTempo");
  const legenda = document.getElementById("graficoCartaoTempoLegenda");
  if (!canvas) return;
  const comparativoAtivo = Boolean(document.getElementById("compararPeriodoAnterior")?.checked && relatorio.comprasPeriodoAnterior);
  const escuro = document.documentElement.dataset.theme === "dark";
  barrasGraficoTempo = [];

  if (legenda) {
    const corAtual = escuro ? "#22d3ee" : "#2563eb";
    legenda.innerHTML = comparativoAtivo
      ? `<span class="card-report-trend-legend-item"><i style="background:${corAtual}"></i>Atual</span><span class="card-report-trend-legend-item"><i style="background:#94a3b8"></i>Período anterior</span>`
      : "Últimos 6 meses";
  }

  if (comparativoAtivo) {
    const dataInicial = document.getElementById("filtroDataInicial").value;
    const dataFinal = document.getElementById("filtroDataFinal").value;
    const prevInicio = document.getElementById("comparaDataInicial").value;
    const prevFim = document.getElementById("comparaDataFinal").value;
    const atualMultiMes = !dataInicial || !dataFinal || dataInicial.slice(0, 7) !== dataFinal.slice(0, 7);
    const anteriorMultiMes = !prevInicio || !prevFim || prevInicio.slice(0, 7) !== prevFim.slice(0, 7);

    if (!atualMultiMes && !anteriorMultiMes) {
      desenharGraficoTempoParPeriodos(canvas, relatorio.comprasPeriodo, relatorio.comprasPeriodoAnterior, { dataInicial, dataFinal, prevInicio, prevFim });
    } else {
      const meses = Array.from(new Set([...mesesEntre(dataInicial, dataFinal), ...mesesEntre(prevInicio, prevFim)])).sort();
      desenharGraficoTempoComparativo(canvas, relatorio.comprasPeriodo, relatorio.comprasPeriodoAnterior, meses);
    }
  } else {
    desenharGraficoTempoSimples(canvas, relatorio.comprasPeriodo);
  }
}

function desenharGraficoTempoSimples(canvas, compras) {
  const { ctx, escuro } = prepararCanvasRelatorioCartao(canvas);
  const pontos = [-5, -4, -3, -2, -1, 0].map((offset) => filtrarComprasPorMes(compras, offset));
  const ticks = calcularTicksEixoY(Math.max(1, ...pontos.map((item) => item.total)));
  const valorTopo = ticks[ticks.length - 1] || 1;
  const margem = calcularMargemEixoY(ctx, ticks);
  const altura = canvas.height - 78;
  const baseY = altura + 34;
  const largura = canvas.width - margem - 20;

  desenharGradeEixoY(ctx, ticks, valorTopo, margem, altura, baseY, largura, escuro);

  const barraLargura = Math.min(56, largura / pontos.length * 0.45);
  pontos.forEach((item, index) => {
    const grupo = largura / pontos.length;
    const h = (item.total / valorTopo) * altura;
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

    barrasGraficoTempo.push({ x, y, width: barraLargura, height: Math.max(h, 4), detalhe: `${item.label}: ${moeda(item.total)}` });
  });
}

function desenharGraficoTempoParPeriodos(canvas, comprasAtual, comprasAnterior, periodos) {
  const { ctx, escuro } = prepararCanvasRelatorioCartao(canvas);
  const totalAtual = (comprasAtual || []).reduce((soma, compra) => soma + Number(compra.valor || 0), 0);
  const totalAnterior = (comprasAnterior || []).reduce((soma, compra) => soma + Number(compra.valor || 0), 0);

  const ticks = calcularTicksEixoY(Math.max(totalAtual, totalAnterior));
  const valorTopo = ticks[ticks.length - 1] || 1;
  const margem = calcularMargemEixoY(ctx, ticks);
  const altura = canvas.height - 78;
  const baseY = altura + 34;
  const largura = canvas.width - margem - 20;

  desenharGradeEixoY(ctx, ticks, valorTopo, margem, altura, baseY, largura, escuro);

  const barraLargura = Math.min(90, largura * 0.22);
  const espacoEntreBarras = largura * 0.14;
  const centro = margem + largura / 2;

  const barras = [
    { valor: totalAnterior, cor: ["#cbd5e1", "#94a3b8"], x: centro - espacoEntreBarras / 2 - barraLargura, rotulo: "Período anterior", intervalo: formatarIntervaloCurto(periodos.prevInicio, periodos.prevFim) },
    { valor: totalAtual, cor: escuro ? ["#22d3ee", "#0f766e"] : ["#2563eb", "#14b8a6"], x: centro + espacoEntreBarras / 2, rotulo: "Atual", intervalo: formatarIntervaloCurto(periodos.dataInicial, periodos.dataFinal) }
  ];

  barras.forEach(({ valor, cor, x, rotulo, intervalo }) => {
    const h = (valor / valorTopo) * altura;
    const y = baseY - h;
    const grad = ctx.createLinearGradient(0, y, 0, baseY);
    grad.addColorStop(0, cor[0]);
    grad.addColorStop(1, cor[1]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barraLargura, Math.max(h, 0), 8);
    ctx.fill();

    ctx.fillStyle = escuro ? "#dbeafe" : "#475569";
    ctx.textAlign = "center";
    ctx.font = "700 12px Arial";
    ctx.fillText(rotulo, x + barraLargura / 2, baseY + 20);
    ctx.font = "11px Arial";
    ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
    ctx.fillText(intervalo, x + barraLargura / 2, baseY + 35);

    barrasGraficoTempo.push({ x, y, width: barraLargura, height: Math.max(h, 4), detalhe: `${rotulo} (${intervalo}): ${moeda(valor)}` });
  });
}

function desenharGraficoTempoComparativo(canvas, comprasAtual, comprasAnterior, meses) {
  const { ctx, escuro } = prepararCanvasRelatorioCartao(canvas);
  const mapaAtual = agruparValorPorMes(comprasAtual);
  const mapaAnterior = agruparValorPorMes(comprasAnterior);

  if (!meses.length) {
    ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados para exibir.", canvas.width / 2, canvas.height / 2);
    return;
  }

  const pontos = meses.map((chave) => ({
    label: rotuloMesAno(chave),
    atual: mapaAtual.get(chave) || 0,
    anterior: mapaAnterior.get(chave) || 0
  }));

  const ticks = calcularTicksEixoY(Math.max(1, ...pontos.map((item) => Math.max(item.atual, item.anterior))));
  const valorTopo = ticks[ticks.length - 1] || 1;
  const margem = calcularMargemEixoY(ctx, ticks);
  const altura = canvas.height - 78;
  const baseY = altura + 34;
  const largura = canvas.width - margem - 20;

  desenharGradeEixoY(ctx, ticks, valorTopo, margem, altura, baseY, largura, escuro);

  const grupo = largura / pontos.length;
  const barraLargura = Math.min(34, grupo * 0.28);
  const espacoEntreBarras = 6;

  pontos.forEach((item, index) => {
    const centroGrupo = margem + index * grupo + grupo / 2;

    [
      { valor: item.anterior, cor: ["#cbd5e1", "#94a3b8"], deslocamento: -(barraLargura + espacoEntreBarras / 2), rotulo: "Período anterior" },
      { valor: item.atual, cor: escuro ? ["#22d3ee", "#0f766e"] : ["#2563eb", "#14b8a6"], deslocamento: espacoEntreBarras / 2, rotulo: "Atual" }
    ].forEach(({ valor, cor, deslocamento, rotulo }) => {
      const h = (valor / valorTopo) * altura;
      const x = centroGrupo + deslocamento;
      const y = baseY - h;
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, cor[0]);
      grad.addColorStop(1, cor[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barraLargura, Math.max(h, 0), 6);
      ctx.fill();

      barrasGraficoTempo.push({ x, y, width: barraLargura, height: Math.max(h, 4), detalhe: `${rotulo} — ${item.label}: ${moeda(valor)}` });
    });

    ctx.fillStyle = escuro ? "#dbeafe" : "#475569";
    ctx.textAlign = "center";
    ctx.font = "700 12px Arial";
    ctx.fillText(item.label, centroGrupo, baseY + 24);
  });
}

function configurarTooltipGraficoTempo() {
  const canvas = document.getElementById("graficoCartaoTempo");
  if (!canvas || canvas.dataset.tooltipConfigurado) return;
  canvas.dataset.tooltipConfigurado = "true";

  const container = canvas.parentElement;
  container.style.position = "relative";
  const tooltip = document.createElement("div");
  tooltip.id = "graficoCartaoTempoTooltip";
  tooltip.className = "card-report-chart-tooltip hidden";
  container.appendChild(tooltip);

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * escalaX;
    const y = (event.clientY - rect.top) * escalaY;

    const barra = barrasGraficoTempo.find((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
    if (barra) {
      tooltip.textContent = barra.detalhe;
      tooltip.style.left = `${event.clientX - rect.left + 14}px`;
      tooltip.style.top = `${event.clientY - rect.top + 14}px`;
      tooltip.classList.remove("hidden");
      canvas.style.cursor = "pointer";
    } else {
      tooltip.classList.add("hidden");
      canvas.style.cursor = "default";
    }
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.classList.add("hidden");
  });
}

function dadosDistribuicaoAtual(relatorio) {
  if (abaRelatorioCartaoAtiva === "departamento") {
    return {
      titulo: "Por departamento",
      itens: relatorio.porDepartamento.map((item) => ({ nome: item.departamento, total: Number(item.total_gasto || 0) }))
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
  const menor = relatorio.porCartao[relatorio.porCartao.length - 1];
  const participacao = total && maior ? (Number(maior.total_gasto || 0) / total) * 100 : 0;

  document.getElementById("insightMaiorGasto").textContent = maior ? moeda(maior.total_gasto) : moeda(0);
  document.getElementById("insightMaiorGastoTexto").textContent = maior?.cartao || "-";
  document.getElementById("insightMenorGasto").textContent = menor ? moeda(menor.total_gasto) : moeda(0);
  document.getElementById("insightMenorGastoTexto").textContent = menor?.cartao || "-";
  document.getElementById("insightTicketMedio").textContent = moeda(compras ? total / compras : 0);
  document.getElementById("insightParticipacaoMaior").textContent = `${participacao.toFixed(1).replace(".", ",")}%`;
  document.getElementById("insightPeriodo").textContent = textoPeriodoSelecionado();
}

function paraISO(data) {
  return data.toISOString().slice(0, 10);
}

function calcularPeriodoAnteriorPadrao(dataInicial, dataFinal) {
  const inicio = new Date(`${dataInicial}T00:00:00`);
  const fim = new Date(`${dataFinal}T00:00:00`);
  const diasPeriodo = Math.round((fim - inicio) / 86400000) + 1;
  const prevFim = new Date(inicio);
  prevFim.setDate(prevFim.getDate() - 1);
  const prevInicio = new Date(prevFim);
  prevInicio.setDate(prevInicio.getDate() - diasPeriodo + 1);
  return { inicio: paraISO(prevInicio), fim: paraISO(prevFim) };
}

function sincronizarPeriodoComparativoPadrao() {
  const dataInicial = document.getElementById("filtroDataInicial").value;
  const dataFinal = document.getElementById("filtroDataFinal").value;
  if (!dataInicial || !dataFinal) return;

  const padrao = calcularPeriodoAnteriorPadrao(dataInicial, dataFinal);
  document.getElementById("comparaDataInicial").value = padrao.inicio;
  document.getElementById("comparaDataFinal").value = padrao.fim;
}

async function renderComparativoPeriodoAnterior(totalAtual) {
  const elemento = document.getElementById("resumoTotalComparativo");
  const barra = document.getElementById("compararPeriodoBar");
  if (!elemento) return;
  const ativo = document.getElementById("compararPeriodoAnterior")?.checked;

  if (!ativo) {
    elemento.textContent = "";
    elemento.className = "card-report-kpi-delta hidden";
    barra.classList.add("hidden");
    if (ultimoRelatorioCartao) ultimoRelatorioCartao.comprasPeriodoAnterior = null;
    desenharGraficoTempo(ultimoRelatorioCartao || {});
    return;
  }

  barra.classList.remove("hidden");
  const prevInicio = document.getElementById("comparaDataInicial").value;
  const prevFim = document.getElementById("comparaDataFinal").value;
  if (!prevInicio || !prevFim) {
    elemento.textContent = "";
    elemento.className = "card-report-kpi-delta hidden";
    if (ultimoRelatorioCartao) ultimoRelatorioCartao.comprasPeriodoAnterior = null;
    desenharGraficoTempo(ultimoRelatorioCartao || {});
    return;
  }

  const qs = new URLSearchParams();
  const departamentoId = document.getElementById("filtroDepartamento").value;
  const cartaoId = document.getElementById("filtroCartao").value;
  const status = document.getElementById("filtroStatus").value;
  if (departamentoId) qs.set("departamentoId", departamentoId);
  if (cartaoId) qs.set("cartaoId", cartaoId);
  qs.set("dataInicial", prevInicio);
  qs.set("dataFinal", prevFim);
  qs.set("usuarioId", usuarioIdAtual());

  const qsCompras = new URLSearchParams(qs);
  if (status) qsCompras.set("status", status);

  const periodoTexto = `${formatarData(prevInicio)} – ${formatarData(prevFim)}`;
  const [porCartaoAnterior, comprasAnterior] = await Promise.all([
    fetch(`/api/relatorios-cartao/gastos-por-cartao?${qs.toString()}`).then((r) => r.json()),
    fetch(`/api/relatorios-cartao/compras?${qsCompras.toString()}`).then((r) => r.json())
  ]);
  const totalAnterior = porCartaoAnterior.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);

  if (ultimoRelatorioCartao) ultimoRelatorioCartao.comprasPeriodoAnterior = comprasAnterior;
  desenharGraficoTempo(ultimoRelatorioCartao || {});

  if (!totalAnterior) {
    elemento.textContent = `Sem gastos no período comparado (${periodoTexto})`;
    elemento.className = "card-report-kpi-delta";
    return;
  }

  const variacao = ((totalAtual - totalAnterior) / totalAnterior) * 100;
  const subiu = variacao > 0;
  const seta = subiu ? "↑" : "↓";
  elemento.className = `card-report-kpi-delta ${subiu ? "is-up" : "is-down"}`;
  elemento.textContent = `${seta} ${Math.abs(variacao).toFixed(1).replace(".", ",")}% vs ${periodoTexto}`;
}

function textoPeriodoSelecionado() {
  const dataInicial = document.getElementById("filtroDataInicial").value;
  const dataFinal = document.getElementById("filtroDataFinal").value;
  if (!dataInicial && !dataFinal) return "Todos";

  const hoje = new Date();
  const paraISO = (data) => data.toISOString().slice(0, 10);
  const inicioMesAtual = paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const fimMesAtual = paraISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));

  if (dataInicial === inicioMesAtual && dataFinal === fimMesAtual) return "Este mês";
  return "Personalizado";
}

function renderVisualRelatorioCartao() {
  if (!ultimoRelatorioCartao) return;
  desenharGraficoTempo(ultimoRelatorioCartao);
  desenharGraficoDistribuicao(ultimoRelatorioCartao);
  renderInsightsRelatorioCartao(ultimoRelatorioCartao);
}

function renderTabelas({ porCartao, porDepartamento, comprasPeriodo }) {
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

  document.getElementById("comprasPeriodoTabela").innerHTML = comprasPeriodo.length
    ? comprasPeriodo.map((r) => linha([
        formatarData(r.data_compra),
        `<strong>${r.cartao}</strong>`,
        r.departamento,
        r.responsavel,
        r.fornecedor,
        `<span class="report-money-pill">${moeda(r.valor)}</span>`,
        `<span class="${classeStatus(r.status)}">${String(r.status || "-").replaceAll("_", " ")}</span>`,
        `<a class="btn btn-secondary" href="compra-cartao.html?compraId=${r.id}">Ver compra</a>`
      ])).join("")
    : vazio(8, "Nenhuma compra encontrada para o período selecionado.");
}

async function carregarRelatoriosCartao() {
  const query = qsRelatorio();
  const suffix = query ? `?${query}` : "";
  const comprasFiltro = qsComprasPeriodo();
  const comprasPromise = comprasFiltro.blocked
    ? Promise.resolve({ blocked: comprasFiltro.blocked, rows: [] })
    : fetch(`/api/relatorios-cartao/compras${comprasFiltro.query ? `?${comprasFiltro.query}` : ""}`).then((r) => r.json()).then((rows) => ({ blocked: "", rows }));

  const [porCartao, porDepartamento, pendencias, comprasResultado] = await Promise.all([
    fetch(`/api/relatorios-cartao/gastos-por-cartao${suffix}`).then((r) => r.json()),
    fetch(`/api/relatorios-cartao/gastos-por-departamento${suffix}`).then((r) => r.json()),
    fetch(`/api/relatorios-cartao/pendencias${suffix}`).then((r) => r.json()),
    comprasPromise
  ]);

  ultimoRelatorioCartao = {
    porCartao,
    porDepartamento,
    pendencias,
    comprasPeriodo: comprasResultado.rows,
    comprasBloqueadas: comprasResultado.blocked || ""
  };
  renderResumo({ porCartao, porDepartamento, pendencias });
  renderTabelas({ porCartao, porDepartamento, pendencias, comprasPeriodo: comprasResultado.rows });
  renderVisualRelatorioCartao();
  if (comprasResultado.blocked) {
    document.getElementById("comprasPeriodoTabela").innerHTML = vazio(8, comprasResultado.blocked);
  }
  const totalAtual = porCartao.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
  renderComparativoPeriodoAnterior(totalAtual);
}

function textoSelecionadoCartao(id) {
  const select = document.getElementById(id);
  return select.options[select.selectedIndex]?.textContent || "-";
}

function baixarPdfRelatorioCartao() {
  if (!ultimoRelatorioCartao) return;

  const { porCartao, porDepartamento, pendencias, comprasPeriodo, comprasBloqueadas } = ultimoRelatorioCartao;
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
      ["Data", "Cartao", "Departamento", "Responsavel", "Fornecedor", "Valor", "Status"],
      comprasPeriodo.map((r) => [
        formatarData(r.data_compra),
        r.cartao,
        r.departamento,
        r.responsavel,
        r.fornecedor,
        moeda(r.valor),
        String(r.status || "-").replaceAll("_", " ")
      ]),
      [70, 130, 110, 105, 145, 80, 90]
    );
  }

  pdf.output(`relatorio-cartoes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function configurarEventos() {
  ["filtroDepartamento", "filtroCartao", "filtroStatus", "filtroDataInicial", "filtroDataFinal"].forEach((id) => {
    document.getElementById(id).addEventListener("change", carregarRelatoriosCartao);
  });

  ["filtroDataInicial", "filtroDataFinal"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (document.getElementById("compararPeriodoAnterior").checked) {
        sincronizarPeriodoComparativoPadrao();
      }
    });
  });

  document.getElementById("limparFiltros").addEventListener("click", () => {
    ["filtroDepartamento", "filtroCartao", "filtroStatus", "filtroDataInicial", "filtroDataFinal"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("compararPeriodoAnterior").checked = false;
    document.getElementById("comparaDataInicial").value = "";
    document.getElementById("comparaDataFinal").value = "";
    document.getElementById("compararPeriodoBar").classList.add("hidden");
    carregarRelatoriosCartao();
  });

  document.getElementById("baixarPdfCartao").addEventListener("click", baixarPdfRelatorioCartao);

  document.getElementById("compararPeriodoAnterior").addEventListener("change", (event) => {
    if (event.target.checked && !document.getElementById("comparaDataInicial").value) {
      sincronizarPeriodoComparativoPadrao();
    }
    const porCartao = ultimoRelatorioCartao?.porCartao || [];
    const totalAtual = porCartao.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
    renderComparativoPeriodoAnterior(totalAtual);
  });

  ["comparaDataInicial", "comparaDataFinal"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const porCartao = ultimoRelatorioCartao?.porCartao || [];
      const totalAtual = porCartao.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
      renderComparativoPeriodoAnterior(totalAtual);
    });
  });

  document.getElementById("alternarFiltrosAvancados").addEventListener("click", () => {
    const painel = document.getElementById("filtrosAvancados");
    const botao = document.getElementById("alternarFiltrosAvancados");
    const expandido = painel.classList.toggle("hidden") === false;
    botao.setAttribute("aria-expanded", String(expandido));
  });

  document.addEventListener("click", (event) => {
    const ancora = document.querySelector(".card-report-filtros-anchor");
    const painel = document.getElementById("filtrosAvancados");
    if (!ancora || painel.classList.contains("hidden")) return;
    if (!ancora.contains(event.target)) {
      painel.classList.add("hidden");
      document.getElementById("alternarFiltrosAvancados").setAttribute("aria-expanded", "false");
    }
  });

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
  definirPeriodoPadraoMesAtual();
  configurarEventos();
  configurarTooltipGraficoTempo();
  await carregarRelatoriosCartao();
}

initRelatoriosCartao();
