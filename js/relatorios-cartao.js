function escaparRelatorio(valor) { return String(valor ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
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

// ---- Infraestrutura de canvas responsivo -----------------------------------
// Os dois gráficos são desenhados em Canvas 2D "na mão" (não há Chart.js ou
// biblioteca similar no projeto). Isso significa que não existem "instâncias"
// de gráfico para destruir, mas existe um problema equivalente: se o canvas
// não acompanha o tamanho real do seu contêiner, ele fica com resolução fixa
// (borrado quando esticado por CSS, ou desperdiçando espaço quando o
// contêiner é maior). A função abaixo redimensiona o canvas para o tamanho
// real exibido (em pixels físicos, usando devicePixelRatio) e devolve as
// dimensões lógicas em pixels de CSS — todo o código de desenho abaixo usa
// essas dimensões lógicas, nunca canvas.width/height diretamente.
function prepararCanvasRelatorioCartao(canvas, alturaPreferida) {
  const escuro = document.documentElement.dataset.theme === "dark";
  const dpr = window.devicePixelRatio || 1;
  const largura = Math.max(canvas.clientWidth || canvas.parentElement?.clientWidth || 0, 240);
  const altura = alturaPreferida || canvas.clientHeight || 260;
  const larguraPx = Math.max(1, Math.round(largura * dpr));
  const alturaPx = Math.max(1, Math.round(altura * dpr));

  // Só reatribui width/height quando o valor muda de fato: escrever nesses
  // atributos sempre reseta e limpa o bitmap do canvas, então fazer isso a
  // cada frame sem necessidade seria desperdício e poderia mascarar outros
  // bugs de redesenho.
  if (canvas.width !== larguraPx || canvas.height !== alturaPx) {
    canvas.width = larguraPx;
    canvas.height = alturaPx;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);
  const grad = ctx.createLinearGradient(0, 0, 0, altura);
  grad.addColorStop(0, escuro ? "#071d33" : "#ffffff");
  grad.addColorStop(1, escuro ? "#061426" : "#f8fbff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, largura, altura);
  return { ctx, escuro, largura, altura };
}

// Registra (uma única vez por canvas, via WeakMap) um ResizeObserver que
// observa o CONTÊINER PAI do canvas — nunca o próprio canvas — e dispara um
// redesenho quando a largura realmente muda. Observar o pai evita loop de
// realimentação (o canvas nunca dispara o próprio observer ao ser
// redimensionado) e o guard por WeakMap evita registrar o mesmo observer
// duas vezes se a função de setup for chamada mais de uma vez.
const observadoresRedimensionamento = new WeakMap();

function garantirRedesenhoResponsivo(canvas, redesenhar) {
  if (!canvas || observadoresRedimensionamento.has(canvas)) return;
  const alvo = canvas.parentElement || canvas;
  let larguraAnterior = alvo.clientWidth;
  let quadroAgendado = null;

  const observer = new ResizeObserver(() => {
    if (quadroAgendado) cancelAnimationFrame(quadroAgendado);
    quadroAgendado = requestAnimationFrame(() => {
      quadroAgendado = null;
      const larguraAtual = alvo.clientWidth;
      if (Math.abs(larguraAtual - larguraAnterior) < 1) return;
      larguraAnterior = larguraAtual;
      redesenhar();
    });
  });

  observer.observe(alvo);
  observadoresRedimensionamento.set(canvas, observer);
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

// Agrupamento adaptativo do eixo do tempo: até 12 meses o gráfico mostra um
// mês por coluna; de 13 a 36 meses agrupa por trimestre; acima disso, por ano.
// Isso evita que um período longo (ex.: um ano inteiro ou vários anos) gere
// dezenas de colunas apertadas e ilegíveis no eixo X.
function escolherGranularidade(quantidadeMeses) {
  if (quantidadeMeses <= 12) return "mes";
  if (quantidadeMeses <= 36) return "trimestre";
  return "ano";
}

function rotuloGranularidade(granularidade) {
  if (granularidade === "total") return "Totais dos períodos";
  if (granularidade === "trimestre") return "Por trimestre";
  if (granularidade === "ano") return "Por ano";
  return "Por mês";
}

function chaveBucket(chaveAnoMes, granularidade) {
  if (granularidade === "ano") return chaveAnoMes.slice(0, 4);
  if (granularidade === "trimestre") {
    const [ano, mes] = chaveAnoMes.split("-").map(Number);
    return `${ano}-T${Math.ceil(mes / 3)}`;
  }
  return chaveAnoMes;
}

function rotuloBucket(chave, granularidade) {
  if (granularidade === "ano") return chave;
  if (granularidade === "trimestre") {
    const [ano, trimestre] = chave.split("-T");
    return `T${trimestre}/${ano.slice(2)}`;
  }
  const [ano, mes] = chave.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  // Formato compacto ("ago/26") em vez de "ago de 26": no gráfico de
  // comparação cabem até 12 colunas lado a lado e o rótulo mais longo
  // esbarrava no vizinho, deixando o eixo ilegível.
  return `${nomeMes}/${String(ano).slice(2)}`;
}

// Reduz a lista de meses do período aos buckets únicos (mês, trimestre ou
// ano), preservando a ordem cronológica.
function bucketizarMeses(meses, granularidade) {
  const vistos = new Set();
  const resultado = [];
  meses.forEach((mes) => {
    const chave = chaveBucket(mes, granularidade);
    if (!vistos.has(chave)) {
      vistos.add(chave);
      resultado.push(chave);
    }
  });
  return resultado;
}

function agruparValorPorBucket(compras, granularidade) {
  const mapa = new Map();
  (compras || []).forEach((compra) => {
    const anoMes = String(compra.data_compra || "").slice(0, 7);
    if (!anoMes) return;
    const chave = chaveBucket(anoMes, granularidade);
    mapa.set(chave, (mapa.get(chave) || 0) + Number(compra.valor || 0));
  });
  return mapa;
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
    ticks.push(Number(valor.toPrecision(12)));
    valor += passo;
  }
  return ticks;
}

function calcularMargemEixoY(ctx, ticks) {
  ctx.font = "12px Arial";
  const larguras = ticks.map((valor) => ctx.measureText(moeda(valor).replace("R$", "R$ ")).width);
  return Math.max(50, Math.ceil(Math.max(...larguras)) + 18);
}

// Escolhe fonte e espaçamento do rótulo de cada coluna com base na largura
// disponível por grupo: com poucas colunas usa fonte normal e mostra todas;
// com muitas colunas apertadas, reduz a fonte e, no limite, mostra só uma a
// cada duas para não sobrepor o texto do vizinho.
function planoRotulosEixoX(grupoLargura, quantidade) {
  if (grupoLargura >= 50) return { fonte: 12, pular: 1 };
  if (grupoLargura >= 36) return { fonte: 11, pular: 1 };
  if (quantidade > 8) return { fonte: 10, pular: 2 };
  return { fonte: 10, pular: 1 };
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

// Monta os pontos do gráfico a partir do relatório (função pura, sem tocar em
// canvas/DOM). `relatorio.anterior` é o único indicador de "modo comparação":
// ele só existe quando o carregamento buscou e trouxe de volta os dados do
// período anterior — nunca um estado "meio carregado" (ver
// carregarRelatoriosCartao), então esta função nunca vê uma comparação
// parcialmente pronta.
function construirDadosGraficoTempo(relatorio) {
  const datas = (relatorio.comprasPeriodo || []).map(c => String(c.data_compra).slice(0,10)).sort();
  const dataInicial = relatorio.periodo.inicio || datas[0];
  const dataFinal = relatorio.periodo.fim || datas[datas.length - 1];
  const mesesAtual = mesesEntre(dataInicial, dataFinal);
  const comparando = Boolean(relatorio.anterior);

  if (!comparando) {
    const granularidade = escolherGranularidade(mesesAtual.length || 1);
    const buckets = bucketizarMeses(mesesAtual, granularidade);
    const mapa = agruparValorPorBucket(relatorio.comprasPeriodo, granularidade);
    const pontos = buckets.map((chave) => ({
      label: rotuloBucket(chave, granularidade),
      atual: mapa.get(chave) || 0,
      anterior: null
    }));
    return { comparando: false, granularidade, pontos };
  }

  const prevInicio = relatorio.periodo.anteriorInicio;
  const prevFim = relatorio.periodo.anteriorFim;
  const mesesAnterior = mesesEntre(prevInicio, prevFim);
  if (mesesAtual.length !== mesesAnterior.length) return {
    comparando: true, granularidade: "total",
    pontos: [{ label: "Totais dos períodos", atual: somaTotalGasto(relatorio.porCartao),
      anterior: somaTotalGasto(relatorio.anterior.porCartao),
      rotuloAtual: formatarData(dataInicial) + " a " + formatarData(dataFinal),
      rotuloAnterior: formatarData(prevInicio) + " a " + formatarData(prevFim) }]
  };
  const granularidade = escolherGranularidade(Math.max(mesesAtual.length, mesesAnterior.length, 1));

  // Reduz cada período aos seus buckets únicos (mês/trimestre/ano) e alinha
  // pela posição relativa (1º bucket do atual com o 1º do anterior, e assim
  // por diante) — do contrário, comparar anos diferentes geraria uma coluna
  // por bucket de cada ano em vez de colunas pareadas.
  const bucketsAtual = bucketizarMeses(mesesAtual, granularidade);
  const bucketsAnterior = bucketizarMeses(mesesAnterior, granularidade);
  const mapaAtual = agruparValorPorBucket(relatorio.comprasPeriodo, granularidade);
  const mapaAnterior = agruparValorPorBucket(relatorio.anterior.comprasPeriodo, granularidade);
  const quantidade = Math.max(bucketsAtual.length, bucketsAnterior.length);

  const pontos = Array.from({ length: quantidade }, (_, index) => {
    const chaveAtual = bucketsAtual[index];
    const chaveAnterior = bucketsAnterior[index];
    const rotuloAtual = chaveAtual ? rotuloBucket(chaveAtual, granularidade) : null;
    const rotuloAnterior = chaveAnterior ? rotuloBucket(chaveAnterior, granularidade) : null;
    return {
      label: `${index + 1}º ${granularidade === "mes" ? "mês" : granularidade === "trimestre" ? "trimestre" : "ano"}`,
      // null (não 0) marca "esse período não cobre essa posição" — o
      // desenho usa isso para não pintar uma barra fantasma de valor zero.
      atual: chaveAtual ? (mapaAtual.get(chaveAtual) || 0) : null,
      anterior: chaveAnterior ? (mapaAnterior.get(chaveAnterior) || 0) : null,
      rotuloAtual,
      rotuloAnterior
    };
  });

  return { comparando: true, granularidade, pontos };
}

function atualizarLegendaGraficoTempo(dados) {
  const legenda = document.getElementById("graficoCartaoTempoLegenda");
  if (!legenda) return;
  if (!dados.comparando) {
    legenda.textContent = rotuloGranularidade(dados.granularidade);
    return;
  }
  const escuro = document.documentElement.dataset.theme === "dark";
  const corAtual = escuro ? "#22d3ee" : "#2563eb";
  legenda.innerHTML = `<span class="card-report-trend-legend-item"><i style="background:${corAtual}"></i>Atual</span><span class="card-report-trend-legend-item"><i style="background:#94a3b8"></i>Período anterior</span><span class="card-report-trend-legend-item">${rotuloGranularidade(dados.granularidade)}</span>`;
}

function desenharGraficoTempo(relatorio) {
  const canvas = document.getElementById("graficoCartaoTempo");
  if (!canvas) return;
  const dados = construirDadosGraficoTempo(relatorio);
  atualizarLegendaGraficoTempo(dados);
  renderizarGraficoTempo(canvas, dados);
}

// Único desenhista para os dois modos (com e sem comparação). Antes existiam
// três funções quase idênticas (modo único, "dois totais lado a lado" e
// "comparativo mês a mês") — qualquer correção precisava ser replicada nas
// três, e foi assim que um bug (variável órfã) passou despercebido. Agora é
// uma função só: sem comparação desenha uma barra por ponto; comparando,
// desenha o par atual/anterior lado a lado, pulando o lado que não tem dado
// naquela posição (em vez de desenhar uma barra de altura zero).
function renderizarGraficoTempo(canvas, dados) {
  const { ctx, escuro, largura: larguraCanvas, altura: alturaCanvas } = prepararCanvasRelatorioCartao(canvas);
  barrasGraficoTempo = [];

  if (!dados.pontos.length) {
    ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Selecione um período para exibir o gráfico.", larguraCanvas / 2, alturaCanvas / 2);
    return;
  }

  const valores = dados.pontos.flatMap((ponto) => [ponto.atual, ponto.anterior]).filter((valor) => valor != null);
  const ticks = calcularTicksEixoY(Math.max(1, ...valores, 0));
  const valorTopo = ticks[ticks.length - 1] || 1;
  const margem = calcularMargemEixoY(ctx, ticks);
  const altura = alturaCanvas - 78;
  const baseY = altura + 34;
  const largura = larguraCanvas - margem - 20;

  desenharGradeEixoY(ctx, ticks, valorTopo, margem, altura, baseY, largura, escuro);

  const grupo = largura / dados.pontos.length;
  const rotuloPlano = planoRotulosEixoX(grupo, dados.pontos.length);
  const barraLarguraSimples = Math.min(56, grupo * 0.45);
  // Com poucos grupos (ex.: "este mês" vs "mês passado", só 1 grupo) as
  // barras podem ficar bem largas, como um comparativo de totais; com muitos
  // grupos ficam finas, como o gráfico mensal de sempre.
  const larguraMaximaDupla = dados.pontos.length <= 2 ? 90 : 34;
  const proporcaoDupla = dados.pontos.length <= 2 ? 0.32 : 0.28;
  const barraLarguraDupla = Math.min(larguraMaximaDupla, grupo * proporcaoDupla);
  const espacoEntreBarras = 6;

  dados.pontos.forEach((ponto, index) => {
    const centroGrupo = margem + index * grupo + grupo / 2;

    if (!dados.comparando) {
      const valor = ponto.atual || 0;
      const h = (valor / valorTopo) * altura;
      const x = centroGrupo - barraLarguraSimples / 2;
      const y = baseY - h;
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, escuro ? "#22d3ee" : "#2563eb");
      grad.addColorStop(1, escuro ? "#0f766e" : "#14b8a6");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barraLarguraSimples, h, 7);
      ctx.fill();
      barrasGraficoTempo.push({ x, y, width: barraLarguraSimples, height: Math.max(h, 4), detalhe: `${ponto.label}: ${moeda(valor)}` });
    } else {
      [
        { valor: ponto.anterior, cor: ["#cbd5e1", "#94a3b8"], deslocamento: -(barraLarguraDupla + espacoEntreBarras / 2), rotulo: "Período anterior", rotuloPeriodo: ponto.rotuloAnterior },
        { valor: ponto.atual, cor: escuro ? ["#22d3ee", "#0f766e"] : ["#2563eb", "#14b8a6"], deslocamento: espacoEntreBarras / 2, rotulo: "Atual", rotuloPeriodo: ponto.rotuloAtual }
      ].forEach(({ valor, cor, deslocamento, rotulo, rotuloPeriodo }) => {
        if (valor == null) return;
        const h = (valor / valorTopo) * altura;
        const x = centroGrupo + deslocamento;
        const y = baseY - h;
        const grad = ctx.createLinearGradient(0, y, 0, baseY);
        grad.addColorStop(0, cor[0]);
        grad.addColorStop(1, cor[1]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barraLarguraDupla, Math.max(h, 0), 6);
        ctx.fill();
        barrasGraficoTempo.push({ x, y, width: barraLarguraDupla, height: Math.max(h, 4), detalhe: `${rotulo} — ${rotuloPeriodo}: ${moeda(valor)}` });
      });
    }

    if (index % rotuloPlano.pular === 0) {
      ctx.fillStyle = escuro ? "#dbeafe" : "#475569";
      ctx.textAlign = "center";
      ctx.font = `700 ${rotuloPlano.fonte}px Arial`;
      ctx.fillText(ponto.label, centroGrupo, baseY + 24);
    }
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
    // As barras em barrasGraficoTempo são posicionadas em pixels lógicos de
    // CSS (prepararCanvasRelatorioCartao já compensa o devicePixelRatio via
    // ctx.setTransform), então a posição do mouse relativa ao canvas não
    // precisa de nenhum fator de escala extra.
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

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

// Agrupa itens excedentes em "Outros" preservando a soma real (em vez de
// simplesmente cortar no 6º item), tanto para o modo simples (campo `total`)
// quanto para o comparativo (campos `atual`/`anterior`) — os campos que não
// existem no item somam 0 e não afetam o resultado.
function agruparPrincipaisEOutros(itens, limitePrincipais = 5, limiteTotal = 6) {
  if (itens.length <= limiteTotal) return itens;
  const principais = itens.slice(0, limitePrincipais);
  const restante = itens.slice(limitePrincipais);
  const agregado = restante.reduce((acc, item) => ({
    total: acc.total + (item.total || 0),
    atual: acc.atual + (item.atual || 0),
    anterior: acc.anterior + (item.anterior || 0)
  }), { total: 0, atual: 0, anterior: 0 });
  return [...principais, { nome: "Outros", subtitulo: `${restante.length} categorias`, ...agregado }];
}

// Monta os dados da "Distribuição dos gastos" (função pura). Sem comparação,
// devolve a mesma lista de sempre para o donut. Comparando, casa cada
// categoria (cartão ou departamento) do período atual com a mesma categoria
// do período anterior pelos IDs do cartão e do departamento — incluindo categorias que só existem em um
// dos dois períodos (ficam com o outro lado em 0) — e ordena pelo maior valor
// entre os dois períodos.
function construirDadosDistribuicao(relatorio) {
  const porDepartamentoAtivo = abaRelatorioCartaoAtiva === "departamento";
  const chaveLista = porDepartamentoAtivo ? "porDepartamento" : "porCartao";
  const campoNome = porDepartamentoAtivo ? "departamento" : "cartao";
  const titulo = porDepartamentoAtivo ? "Por departamento" : "Por cartão";
  const listaAtual = relatorio[chaveLista] || [];
  const comparando = Boolean(relatorio.anterior);

  if (!comparando) {
    const itens = listaAtual
      .map((item) => ({ nome: item[campoNome], subtitulo: porDepartamentoAtivo ? null : item.departamento, total: Number(item.total_gasto || 0) }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
    return { comparando: false, titulo, itens: agruparPrincipaisEOutros(itens) };
  }

  const listaAnterior = relatorio.anterior[chaveLista] || [];
  const chave = item => porDepartamentoAtivo ? String(item.departamento_id) : item.cartao_id + ":" + item.departamento_id;
  const mapaAnterior = new Map(listaAnterior.map((item) => [chave(item), Number(item.total_gasto || 0)]));
  const nomesVistos = new Set();
  const combinados = [];

  listaAtual.forEach((item) => {
    const nome = item[campoNome];
    nomesVistos.add(chave(item));
    combinados.push({
      nome,
      subtitulo: porDepartamentoAtivo ? null : item.departamento,
      atual: Number(item.total_gasto || 0),
      anterior: mapaAnterior.get(chave(item)) || 0
    });
  });
  listaAnterior.forEach((item) => {
    const nome = item[campoNome];
    if (nomesVistos.has(chave(item))) return;
    combinados.push({ nome, subtitulo: porDepartamentoAtivo ? null : item.departamento, atual: 0, anterior: Number(item.total_gasto || 0) });
  });

  const itens = combinados
    .filter((item) => item.atual > 0 || item.anterior > 0)
    .sort((a, b) => Math.max(b.atual, b.anterior) - Math.max(a.atual, a.anterior));

  return { comparando: true, titulo, itens: agruparPrincipaisEOutros(itens) };
}

function desenharGraficoDistribuicao(relatorio) {
  const dados = construirDadosDistribuicao(relatorio);
  const tituloEl = document.getElementById("graficoCartaoDistribuicaoTitulo");
  if (tituloEl) tituloEl.textContent = dados.titulo;

  const layoutDonut = document.getElementById("distribuicaoDonutLayout");
  const layoutComparativo = document.getElementById("distribuicaoComparativaLista");
  if (layoutDonut) layoutDonut.classList.toggle("hidden", dados.comparando);
  if (layoutComparativo) layoutComparativo.classList.toggle("hidden", !dados.comparando);

  if (dados.comparando) {
    renderizarDistribuicaoComparativa(dados.itens);
  } else {
    renderizarDonutDistribuicao(dados.itens);
  }
}

// Modo sem comparação: donut de sempre, só que agora com centro/raio
// calculados a partir do tamanho real do canvas (responsivo), em vez de
// valores fixos que assumiam um canvas de 260x260.
function renderizarDonutDistribuicao(itens) {
  const canvas = document.getElementById("graficoCartaoDistribuicao");
  if (!canvas) return;
  const { ctx, escuro, largura, altura } = prepararCanvasRelatorioCartao(canvas);
  const total = itens.reduce((soma, item) => soma + item.total, 0);
  const cx = largura / 2;
  const cy = altura / 2;
  const raioExterno = Math.max(40, Math.min(largura, altura) / 2 - 16);
  const raioInterno = raioExterno * 0.587;
  let inicio = -Math.PI / 2;

  if (!itens.length) {
    ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados para exibir.", largura / 2, altura / 2);
    document.getElementById("legendaCartaoDistribuicao").innerHTML = "";
    return;
  }

  itens.forEach((item, index) => {
    const angulo = (item.total / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, raioExterno, inicio, inicio + angulo);
    ctx.arc(cx, cy, raioInterno, inicio + angulo, inicio, true);
    ctx.closePath();
    ctx.fillStyle = coresRelatorioCartao[index % coresRelatorioCartao.length];
    ctx.fill();
    inicio += angulo;
  });

  ctx.fillStyle = escuro ? "#071d33" : "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, raioInterno - 4), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = escuro ? "#f8fbff" : "#0f1b3d";
  ctx.textAlign = "center";
  ctx.font = "700 15px Arial";
  ctx.fillText(moeda(total), cx, cy - 4);
  ctx.font = "12px Arial";
  ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
  ctx.fillText("Total", cx, cy + 18);

  document.getElementById("legendaCartaoDistribuicao").innerHTML = itens.map((item, index) => {
    const percentual = total ? ((item.total / total) * 100).toFixed(1).replace(".", ",") : "0";
    const tituloCompleto = item.subtitulo ? `${item.nome} (${item.subtitulo})` : item.nome;
    const detalhe = item.subtitulo ? `${item.subtitulo} · ${moeda(item.total)}` : moeda(item.total);
    return `
      <div>
        <span title="${tituloCompleto}"><i style="background:${coresRelatorioCartao[index % coresRelatorioCartao.length]}"></i>${item.nome}</span>
        <strong>${percentual}%</strong>
        <small>${detalhe}</small>
      </div>
    `;
  }).join("");
}

// Modo com comparação: barras horizontais Atual/Anterior + variação %, uma
// por categoria. Escolhida em vez de dois donuts lado a lado porque comparar
// duas roscas de cores diferentes fatia a fatia é visualmente difícil — a
// pergunta que importa aqui ("esse cartão gastou mais ou menos que no
// período anterior, e quanto?") fica direta com duas barras emparelhadas e
// um selo de variação, sem depender de decorar cores entre dois círculos
// separados. É HTML puro (sem canvas): mais simples de manter, naturalmente
// responsivo e acessível, sem precisar de outro observer de redimensionamento.
function renderizarDistribuicaoComparativa(itens) {
  const container = document.getElementById("distribuicaoComparativaLista");
  if (!container) return;

  if (!itens.length) {
    container.innerHTML = `<p class="card-report-compare-bars-empty">Sem dados para exibir.</p>`;
    return;
  }

  const maiorValor = Math.max(1, ...itens.flatMap((item) => [item.atual, item.anterior]));

  container.innerHTML = itens.map((item) => {
    const percAtual = Math.max(0, Math.round((item.atual / maiorValor) * 100));
    const percAnterior = Math.max(0, Math.round((item.anterior / maiorValor) * 100));
    const tituloCompleto = item.subtitulo ? `${item.nome} (${item.subtitulo})` : item.nome;

    let variacaoHtml;
    if (item.anterior > 0) {
      const variacao = ((item.atual - item.anterior) / item.anterior) * 100;
      const subiu = variacao > 0.05;
      const desceu = variacao < -0.05;
      const classe = subiu ? "is-up" : desceu ? "is-down" : "is-flat";
      const seta = subiu ? "↑" : desceu ? "↓" : "→";
      variacaoHtml = `<span class="card-report-compare-bar-delta ${classe}">${seta} ${Math.abs(variacao).toFixed(1).replace(".", ",")}%</span>`;
    } else if (item.atual > 0) {
      variacaoHtml = `<span class="card-report-compare-bar-delta is-up">Novo</span>`;
    } else {
      variacaoHtml = `<span class="card-report-compare-bar-delta is-down">Zerado</span>`;
    }

    return `
      <div class="card-report-compare-bar-row">
        <div class="card-report-compare-bar-head">
          <span title="${escaparRelatorio(tituloCompleto)}">${escaparRelatorio(tituloCompleto)}</span>
          ${variacaoHtml}
        </div>
        <div class="card-report-compare-bar-line">
          <span class="card-report-compare-bar-track"><span class="card-report-compare-bar-fill is-atual" style="width:${percAtual}%"></span></span>
          <span class="card-report-compare-bar-value">Atual: ${moeda(item.atual)}</span>
        </div>
        <div class="card-report-compare-bar-line">
          <span class="card-report-compare-bar-track"><span class="card-report-compare-bar-fill is-anterior" style="width:${percAnterior}%"></span></span>
          <span class="card-report-compare-bar-value">Anterior: ${moeda(item.anterior)}</span>
        </div>
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
  if (!dataInicial || !dataFinal || dataInicial > dataFinal) return null;
  const inicio = new Date(dataInicial + "T00:00:00Z");
  const fim = new Date(dataFinal + "T00:00:00Z");
  if (!Number.isFinite(+inicio) || !Number.isFinite(+fim)) return null;
  const ultimoDia = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() + 1, 0));
  const anteriorFim = new Date(+inicio - 86400000);
  let anteriorInicio;
  if (inicio.getUTCDate() === 1 && fim.getUTCDate() === ultimoDia.getUTCDate()) {
    const meses = (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + fim.getUTCMonth() - inicio.getUTCMonth() + 1;
    anteriorInicio = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - meses, 1));
  } else anteriorInicio = new Date(+anteriorFim - (+fim - +inicio));
  return { inicio: anteriorInicio.toISOString().slice(0,10), fim: anteriorFim.toISOString().slice(0,10) };
}

function sincronizarPeriodoComparativoPadrao() {
  const dataInicial = document.getElementById("filtroDataInicial").value;
  const dataFinal = document.getElementById("filtroDataFinal").value;
  if (!dataInicial || !dataFinal) return;

  const padrao = calcularPeriodoAnteriorPadrao(dataInicial, dataFinal);
  if (!padrao) return;
  document.getElementById("comparaDataInicial").value = padrao.inicio;
  document.getElementById("comparaDataFinal").value = padrao.fim;
}

// Reflete o estado do toggle "Comparar" nos campos de período (mostra/some o
// campo "Período anterior" e troca o rótulo "Período" <-> "Atual"). Devolve
// se a comparação está ativa, para quem chama decidir se busca o anterior.
function atualizarCampoPeriodoComparativo() {
  const ativo = Boolean(document.getElementById("compararPeriodoAnterior")?.checked);
  const campoComparativo = document.getElementById("campoPeriodoComparativo");
  const labelAtual = document.getElementById("labelPeriodoAtual");
  if (labelAtual) labelAtual.textContent = ativo ? "Atual" : "Período";
  if (campoComparativo) campoComparativo.classList.toggle("hidden", !ativo);
  return ativo;
}

function somaTotalGasto(lista) {
  return (lista || []).reduce((sum, item) => sum + Number(item.total_gasto || 0), 0);
}

// Busca as três coisas do período anterior necessárias para os gráficos:
// total por cartão e por departamento (para a distribuição comparativa) e a
// lista de compras (para o gráfico de tempo). Chamada só quando a comparação
// está ativa e as duas datas do período anterior estão preenchidas.
async function buscarListaRelatorio(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não foi possível carregar os dados do relatório. Tente novamente.");
  const dados = await resposta.json();
  if (!Array.isArray(dados)) throw new Error("O servidor retornou dados inválidos para o relatório.");
  return dados;
}
async function buscarDadosPeriodoAnterior(prevInicio, prevFim, query = qsRelatorio()) {
  const qs = new URLSearchParams(query);
  qs.set("dataInicial", prevInicio);
  qs.set("dataFinal", prevFim);
  const [porCartao, porDepartamento, comprasPeriodo] = await Promise.all(
    ["gastos-por-cartao", "gastos-por-departamento", "compras"].map(tipo =>
      buscarListaRelatorio("/api/relatorios-cartao/" + tipo + "?" + qs))
  );
  return { porCartao, porDepartamento, comprasPeriodo };
}

// Atualiza só o texto de variação (↑/↓ X% vs período anterior) abaixo do KPI
// "Total gasto". Não desenha nada — os gráficos já são desenhados por
// renderVisualRelatorioCartao a partir do mesmo `relatorio.anterior`.
function atualizarDeltaTotal(relatorio) {
  const elemento = document.getElementById("resumoTotalComparativo");
  if (!elemento) return;

  if (!relatorio.anterior) {
    elemento.textContent = "";
    elemento.className = "card-report-kpi-delta hidden";
    return;
  }

  const totalAtual = somaTotalGasto(relatorio.porCartao);
  const totalAnterior = somaTotalGasto(relatorio.anterior.porCartao);
  const prevInicio = relatorio.periodo.anteriorInicio;
  const prevFim = relatorio.periodo.anteriorFim;
  const periodoTexto = `${formatarData(prevInicio)} – ${formatarData(prevFim)}`;

  if (!totalAnterior) {
    elemento.textContent = `Sem gastos no período comparado (${periodoTexto})`;
    elemento.className = "card-report-kpi-delta";
    return;
  }

  const variacao = ((totalAtual - totalAnterior) / totalAnterior) * 100;
  const subiu = variacao > 0;
  const seta = variacao === 0 ? "→" : subiu ? "↑" : "↓";
  elemento.className = `card-report-kpi-delta ${subiu ? "is-up" : "is-down"}`;
  elemento.textContent = `${seta} ${Math.abs(variacao).toFixed(1).replace(".", ",")}% vs ${periodoTexto}`;
}

function textoPeriodoSelecionado() {
  const dataInicial = ultimoRelatorioCartao?.periodo.inicio;
  const dataFinal = ultimoRelatorioCartao?.periodo.fim;
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
        `<strong>${escaparRelatorio(r.cartao)}</strong>`,
        escaparRelatorio(r.departamento),
        `<span class="report-money-pill">${moeda(r.total_gasto)}</span>`,
        `<span class="report-number-pill">${r.quantidade_compras}</span>`,
        `<span class="report-money-pill">${moeda(r.media_compra)}</span>`
      ])).join("")
    : vazio(5);

  document.getElementById("gastosDepartamentoTabela").innerHTML = porDepartamento.length
    ? porDepartamento.map((r) => linha([
        `<strong>${escaparRelatorio(r.departamento)}</strong>`,
        `<span class="report-money-pill">${moeda(r.total_gasto)}</span>`,
        `<span class="report-number-pill">${r.quantidade_compras}</span>`,
        `<span class="report-number-pill">${Number(r.percentual || 0).toFixed(1)}%</span>`
      ])).join("")
    : vazio(4);

  document.getElementById("comprasPeriodoTabela").innerHTML = comprasPeriodo.length
    ? comprasPeriodo.map((r) => linha([
        formatarData(r.data_compra),
        `<strong>${escaparRelatorio(r.cartao)}</strong>`,
        escaparRelatorio(r.departamento),
        escaparRelatorio(r.responsavel || "-"),
        escaparRelatorio(r.fornecedor),
        `<span class="report-money-pill">${moeda(r.valor)}</span>`,
        `<span class="${classeStatus(r.status)}">${String(r.status || "-").replaceAll("_", " ")}</span>`,
        `<a class="btn btn-secondary" href="compra-cartao.html?verCompraId=${r.id}">Ver compra</a>`
      ])).join("")
    : vazio(8, "Nenhuma compra encontrada para o período selecionado.");
}

// Contador monotônico: cada chamada pega o próximo número e, quando sua
// resposta chega, só aplica os dados na tela se ainda for a chamada mais
// recente. Sem isso, trocar de filtro rapidamente (ex.: cartão, depois
// departamento) pode fazer uma resposta mais VELHA chegar depois de uma mais
// NOVA e sobrescrever a tela com dados desatualizados.
let solicitacaoRelatorioCartaoAtual = 0;

async function carregarRelatoriosCartao() {
  const idSolicitacao = ++solicitacaoRelatorioCartaoAtual;
  const comparando = atualizarCampoPeriodoComparativo();
  const query = qsRelatorio();
  const qs = new URLSearchParams(query);
  const periodo = {
    inicio: qs.get("dataInicial") || "", fim: qs.get("dataFinal") || "",
    anteriorInicio: document.getElementById("comparaDataInicial").value,
    anteriorFim: document.getElementById("comparaDataFinal").value
  };
  const mensagem = document.getElementById("relatorioMensagem");
  const workspace = document.querySelector(".card-report-workspace");
  const resumo = document.querySelector(".card-report-summary-grid");
  const pdf = document.getElementById("baixarPdfCartao");
  ultimoRelatorioCartao = null;
  workspace.hidden = true;
  resumo.hidden = true;
  pdf.disabled = true;
  mensagem.textContent = "Carregando relatório…";
  mensagem.setAttribute("role", "status");
  try {
    if (periodo.inicio && periodo.fim && periodo.inicio > periodo.fim)
      throw new Error("A data inicial deve ser anterior ou igual à data final.");
    if (comparando && (!periodo.inicio || !periodo.fim || !periodo.anteriorInicio || !periodo.anteriorFim))
      throw new Error("Preencha as quatro datas para comparar os períodos.");
    if (comparando && periodo.anteriorInicio > periodo.anteriorFim)
      throw new Error("Confira a ordem das datas do período anterior.");
    if (comparando && periodo.anteriorFim >= periodo.inicio)
      throw new Error("O período anterior deve terminar antes do início do período atual.");
    const [porCartao, porDepartamento, pendencias, comprasPeriodo, anterior] = await Promise.all([
      ...["gastos-por-cartao", "gastos-por-departamento", "pendencias", "compras"].map(tipo =>
        buscarListaRelatorio("/api/relatorios-cartao/" + tipo + "?" + query)),
      comparando ? buscarDadosPeriodoAnterior(periodo.anteriorInicio, periodo.anteriorFim, query) : null
    ]);
    if (idSolicitacao !== solicitacaoRelatorioCartaoAtual) return;
    ultimoRelatorioCartao = { porCartao, porDepartamento, pendencias, comprasPeriodo, anterior, periodo, comprasBloqueadas: "" };
    workspace.hidden = false;
    resumo.hidden = false;
    pdf.disabled = false;
    const descrever = (inicio, fim) => (inicio ? formatarData(inicio) : "Início") + " a " + (fim ? formatarData(fim) : "sem limite final") + (inicio && fim ? " (" + (Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1) + " dias)" : "");
    mensagem.textContent = "Atual: " + descrever(periodo.inicio, periodo.fim) +
      (anterior ? " • Anterior: " + descrever(periodo.anteriorInicio, periodo.anteriorFim) : "");
    if (anterior && mesesEntre(periodo.inicio, periodo.fim).length !== mesesEntre(periodo.anteriorInicio, periodo.anteriorFim).length)
      mensagem.textContent += " • Os períodos têm durações diferentes. O gráfico compara os totais, sem ajuste por duração.";
    const seletor = document.getElementById("periodoTabelas");
    seletor.hidden = !anterior;
    if (!anterior) seletor.value = "atual";
    renderResumo(ultimoRelatorioCartao);
    renderTabelasSelecionadas();
    renderVisualRelatorioCartao();
    atualizarDeltaTotal(ultimoRelatorioCartao);
  } catch (erro) {
    if (idSolicitacao !== solicitacaoRelatorioCartaoAtual) return;
    mensagem.setAttribute("role", "alert");
    mensagem.textContent = erro.message || "Não foi possível carregar o relatório.";
  }
}

function renderTabelasSelecionadas() {
  if (!ultimoRelatorioCartao) return;
  const anterior = document.getElementById("periodoTabelas").value === "anterior" && ultimoRelatorioCartao.anterior;
  const dados = anterior || ultimoRelatorioCartao;
  const p = ultimoRelatorioCartao.periodo;
  document.getElementById("contextoTabelas").textContent =
    (anterior ? "Período anterior: " : "Período atual: ") +
    (formatarData(anterior ? p.anteriorInicio : p.inicio) || "Início") + " a " +
    (formatarData(anterior ? p.anteriorFim : p.fim) || "hoje") +
    " • " + dados.comprasPeriodo.length + " compras • " + moeda(somaTotalGasto(dados.porCartao));
  renderTabelas(dados);
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
    { label: "Listagem de compras", value: "Período atual" }
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
        r.responsavel || "-",
        r.fornecedor,
        moeda(r.valor),
        String(r.status || "-").replaceAll("_", " ")
      ]),
      [70, 130, 110, 105, 145, 80, 90]
    );
  }

  if (ultimoRelatorioCartao.anterior) {
    const anterior = ultimoRelatorioCartao.anterior;
    pdf.section("Período anterior");
    pdf.keyValues([{label: "De", value: formatarData(ultimoRelatorioCartao.periodo.anteriorInicio)}, {label: "Até", value: formatarData(ultimoRelatorioCartao.periodo.anteriorFim)}, {label: "Total gasto", value: moeda(somaTotalGasto(anterior.porCartao))}, {label: "Compras", value: anterior.comprasPeriodo.length}]);
    pdf.table(
      ["Data", "Cartao", "Departamento", "Responsavel", "Fornecedor", "Valor", "Status"],
      anterior.comprasPeriodo.map(r => [formatarData(r.data_compra), r.cartao, r.departamento, r.responsavel || "-", r.fornecedor, moeda(r.valor), r.status || "-"]),
      [70, 130, 110, 105, 145, 80, 90]
    );
  }
  pdf.output(`relatorio-cartoes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function configurarEventos() {
  document.getElementById("periodoTabelas").addEventListener("change", renderTabelasSelecionadas);
  document.getElementById("recarregarRelatorio").addEventListener("click", carregarRelatoriosCartao);
  ["filtroDepartamento", "filtroCartao", "filtroStatus"].forEach((id) => {
    document.getElementById(id).addEventListener("change", carregarRelatoriosCartao);
  });

  ["filtroDataInicial", "filtroDataFinal"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      // Resincroniza o período de comparação padrão ANTES de recarregar, senão
      // o recálculo do "vs período anterior" roda com a data de comparação
      // antiga (a sincronização só reflete no gráfico na alteração seguinte).
      if (document.getElementById("compararPeriodoAnterior").checked) {
        sincronizarPeriodoComparativoPadrao();
      }
      carregarRelatoriosCartao();
    });
  });

  document.getElementById("limparFiltros").addEventListener("click", () => {
    ["filtroDepartamento", "filtroCartao", "filtroStatus", "filtroDataInicial", "filtroDataFinal"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("compararPeriodoAnterior").checked = false;
    document.getElementById("comparaDataInicial").value = "";
    document.getElementById("comparaDataFinal").value = "";
    carregarRelatoriosCartao();
  });

  document.getElementById("baixarPdfCartao").addEventListener("click", baixarPdfRelatorioCartao);

  document.getElementById("compararPeriodoAnterior").addEventListener("change", (event) => {
    if (event.target.checked && !document.getElementById("comparaDataInicial").value) {
      sincronizarPeriodoComparativoPadrao();
    }
    carregarRelatoriosCartao();
  });

  ["comparaDataInicial", "comparaDataFinal"].forEach((id) => {
    document.getElementById(id).addEventListener("change", carregarRelatoriosCartao);
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

  document.addEventListener("temaAlterado", renderVisualRelatorioCartao);
}

// Registra (uma única vez) o redesenho responsivo dos dois gráficos: quando
// o contêiner muda de largura (janela redimensionada, sidebar recolhida,
// orientação do celular mudando), redesenha com os últimos dados já
// carregados — sem refazer nenhuma requisição.
function configurarResponsividadeGraficos() {
  garantirRedesenhoResponsivo(document.getElementById("graficoCartaoTempo"), () => {
    if (ultimoRelatorioCartao) desenharGraficoTempo(ultimoRelatorioCartao);
  });
  garantirRedesenhoResponsivo(document.getElementById("graficoCartaoDistribuicao"), () => {
    if (ultimoRelatorioCartao) desenharGraficoDistribuicao(ultimoRelatorioCartao);
  });
}

async function initRelatoriosCartao() {
  await carregarFiltros();
  definirPeriodoPadraoMesAtual();
  configurarEventos();
  configurarTooltipGraficoTempo();
  configurarResponsividadeGraficos();
  await carregarRelatoriosCartao();
}

initRelatoriosCartao().catch(() => {
  document.getElementById("relatorioMensagem").textContent = "Não foi possível iniciar o relatório. Atualize a página para tentar novamente.";
});
