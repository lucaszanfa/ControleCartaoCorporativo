const dashboardCartoesState = {
  resumo: null,
  compras: [],
  cartoes: []
};

const coresCartoesDashboard = ["#2563eb", "#14b8a6", "#8b5cf6", "#f59e0b", "#94a3b8", "#ef4444"];

function dataLocal(valor) {
  if (!valor) return new Date();
  return new Date(`${valor}T00:00:00`);
}

function dataCurta(valor) {
  return dataLocal(valor).toLocaleDateString("pt-BR");
}

function mesAtualPrefixo() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function comprasDoMesCartoes() {
  const prefixo = mesAtualPrefixo();
  return dashboardCartoesState.compras.filter((compra) => String(compra.dataCompra || "").startsWith(prefixo));
}

function somarPorCampo(lista, campo) {
  return lista.reduce((acc, item) => {
    const chave = item[campo] || "Sem informação";
    acc[chave] = (acc[chave] || 0) + Number(item.valor || 0);
    return acc;
  }, {});
}

function topEntradaPorCampo(lista, campo) {
  const ordenado = Object.entries(somarPorCampo(lista, campo)).sort((a, b) => b[1] - a[1]);
  return ordenado[0] || ["-", 0];
}

function totalLimiteCartoes() {
  return dashboardCartoesState.cartoes.reduce((total, cartao) => total + Number(cartao.limiteMensal || 0), 0);
}

function renderizarKpisCartoes() {
  const dados = dashboardCartoesState.resumo;
  const cards = [
    { label: "Cartões ativos", value: dados.total_cartoes_ativos, trend: "0% vs. mês anterior", tone: "blue" },
    { label: "Compras no mês", value: dados.compras_registradas_mes, trend: "+18% vs. mês anterior", tone: "green" },
    { label: "Valor registrado no mês", value: moeda(dados.valor_total_mes), trend: "+24% vs. mês anterior", tone: "cyan" },
    { label: "Transações da fatura", value: dados.transacoes_fatura_mes, trend: "+7% vs. mês anterior", tone: "purple" },
    { label: "Compras sem registro", value: dados.compras_sem_registro, trend: "0% vs. mês anterior", tone: "orange" },
    { label: "Alertas pendentes", value: dados.alertas_pendentes, trend: "+15% vs. mês anterior", tone: "red" },
    { label: "Sem comprovante", value: dados.compras_sem_comprovante, trend: "-3% vs. mês anterior", tone: "yellow" },
    { label: "Divergências abertas", value: dados.divergencias_abertas, trend: "-50% vs. mês anterior", tone: "violet" }
  ];

  document.getElementById("cartoesDashboardCards").innerHTML = cards.map((card, index) => `
    <article class="cards-kpi cards-kpi-${card.tone}">
      <span class="cards-kpi-icon">${["▭", "▾", "$", "▤", "!", "◷", "▣", "⚖"][index]}</span>
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <small>${card.trend}</small>
    </article>
  `).join("");
}

function desenharFundoCanvas(ctx, canvas, escuro) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, escuro ? "#071d33" : "#ffffff");
  grad.addColorStop(1, escuro ? "#061426" : "#f8fbff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
}

function totaisPorDiaMes(comprasMes) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const acumulado = Array.from({ length: diasNoMes }, (_, index) => ({ dia: index + 1, total: 0 }));

  comprasMes.forEach((compra) => {
    const data = dataLocal(compra.dataCompra);
    if (data.getFullYear() === ano && data.getMonth() === mes) {
      acumulado[data.getDate() - 1].total += Number(compra.valor || 0);
    }
  });

  let total = 0;
  return acumulado.map((item) => {
    total += item.total;
    return { ...item, total };
  });
}

function desenharEvolucaoGastos() {
  const canvas = document.getElementById("graficoEvolucaoCartoes");
  const ctx = canvas.getContext("2d");
  const escuro = document.documentElement.dataset.theme === "dark";
  const pontos = totaisPorDiaMes(comprasDoMesCartoes());
  const maior = Math.max(1, ...pontos.map((ponto) => ponto.total));
  const margem = 62;
  const altura = canvas.height - 86;
  const baseY = altura + 34;
  const largura = canvas.width - margem * 2;

  desenharFundoCanvas(ctx, canvas, escuro);
  ctx.strokeStyle = escuro ? "rgba(148, 163, 184, 0.16)" : "#e5edf7";
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

  const coordenadas = pontos.map((ponto, index) => ({
    x: margem + (index / Math.max(1, pontos.length - 1)) * largura,
    y: baseY - (ponto.total / maior) * altura,
    ...ponto
  }));

  const area = ctx.createLinearGradient(0, 64, 0, baseY);
  area.addColorStop(0, escuro ? "rgba(34, 211, 238, 0.28)" : "rgba(37, 99, 235, 0.22)");
  area.addColorStop(1, "rgba(37, 99, 235, 0.02)");
  ctx.beginPath();
  ctx.moveTo(coordenadas[0].x, baseY);
  coordenadas.forEach((ponto) => ctx.lineTo(ponto.x, ponto.y));
  ctx.lineTo(coordenadas[coordenadas.length - 1].x, baseY);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();

  ctx.beginPath();
  coordenadas.forEach((ponto, index) => {
    if (index === 0) ctx.moveTo(ponto.x, ponto.y);
    else ctx.lineTo(ponto.x, ponto.y);
  });
  ctx.strokeStyle = escuro ? "#22d3ee" : "#2563eb";
  ctx.lineWidth = 3;
  ctx.stroke();

  coordenadas.forEach((ponto, index) => {
    if (index % 5 !== 0 && index !== coordenadas.length - 1) return;
    ctx.beginPath();
    ctx.arc(ponto.x, ponto.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = escuro ? "#22d3ee" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = escuro ? "#22d3ee" : "#2563eb";
    ctx.stroke();
    ctx.fillStyle = escuro ? "#dbeafe" : "#475569";
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillText(`${String(ponto.dia).padStart(2, "0")}/${mesAtualPrefixo().slice(5)}`, ponto.x, baseY + 26);
  });

  document.getElementById("cartoesEvolucaoTotal").textContent = moeda(dashboardCartoesState.resumo.valor_total_mes);
}

function desenharDonutDepartamentos() {
  const canvas = document.getElementById("graficoDepartamentosCartoes");
  const ctx = canvas.getContext("2d");
  const escuro = document.documentElement.dataset.theme === "dark";
  const dados = Object.entries(somarPorCampo(comprasDoMesCartoes(), "departamento"))
    .map(([nome, total]) => ({ nome, total }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const total = dados.reduce((soma, item) => soma + item.total, 0);
  const centroX = 145;
  const centroY = 150;
  const raio = 104;
  let inicio = -Math.PI / 2;

  desenharFundoCanvas(ctx, canvas, escuro);
  if (!dados.length) {
    ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Sem gastos no período.", canvas.width / 2, canvas.height / 2);
    document.getElementById("legendaDepartamentosCartoes").innerHTML = "";
    return;
  }

  dados.forEach((item, index) => {
    const angulo = (item.total / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centroX, centroY, raio, inicio, inicio + angulo);
    ctx.arc(centroX, centroY, 62, inicio + angulo, inicio, true);
    ctx.closePath();
    ctx.fillStyle = coresCartoesDashboard[index % coresCartoesDashboard.length];
    ctx.fill();
    inicio += angulo;
  });

  ctx.fillStyle = escuro ? "#071d33" : "#ffffff";
  ctx.beginPath();
  ctx.arc(centroX, centroY, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = escuro ? "#f8fbff" : "#0f1b3d";
  ctx.textAlign = "center";
  ctx.font = "700 16px Arial";
  ctx.fillText(moeda(total), centroX, centroY - 4);
  ctx.font = "12px Arial";
  ctx.fillStyle = escuro ? "#b8c7da" : "#64748b";
  ctx.fillText("Total", centroX, centroY + 18);

  document.getElementById("legendaDepartamentosCartoes").innerHTML = dados.map((item, index) => {
    const percentual = total ? ((item.total / total) * 100).toFixed(1).replace(".", ",") : "0";
    return `
      <div>
        <span><i style="background:${coresCartoesDashboard[index % coresCartoesDashboard.length]}"></i>${item.nome}</span>
        <strong>${percentual}%</strong>
        <small>${moeda(item.total)}</small>
      </div>
    `;
  }).join("");
}

function renderizarCardsLaterais() {
  const comprasMes = comprasDoMesCartoes();
  const [departamento, totalDepartamento] = topEntradaPorCampo(comprasMes, "departamento");
  const [cartao, totalCartao] = topEntradaPorCampo(comprasMes, "cartao");
  const limite = totalLimiteCartoes();
  const usado = dashboardCartoesState.resumo.valor_total_mes;
  const percentual = limite ? Math.min(100, Math.round((usado / limite) * 100)) : 0;

  document.getElementById("cardDepartamentoMaior").textContent = departamento;
  document.getElementById("cardDepartamentoMaiorValor").textContent = moeda(totalDepartamento);
  document.getElementById("cardCartaoMaior").textContent = cartao;
  document.getElementById("cardCartaoMaiorValor").textContent = moeda(totalCartao);
  document.getElementById("cardLimitePercentual").textContent = `${percentual}%`;
  document.getElementById("cardLimiteBarra").style.width = `${percentual}%`;
  document.getElementById("cardLimiteTexto").textContent = `${moeda(usado)} de ${moeda(limite)}`;
  document.getElementById("cardAlertas").textContent = dashboardCartoesState.resumo.alertas_pendentes;
}

function renderizarUltimasTransacoes() {
  const compras = [...dashboardCartoesState.compras]
    .sort((a, b) => String(b.dataCompra).localeCompare(String(a.dataCompra)))
    .slice(0, 6);

  document.getElementById("ultimasTransacoesCartoes").innerHTML = compras.map((compra) => `
    <tr class="report-data-row">
      <td><strong>${dataCurta(compra.dataCompra)}</strong></td>
      <td>${compra.fornecedor}</td>
      <td><span class="cards-mask">•••• ${compra.ultimos4Digitos || "----"}</span></td>
      <td>${compra.departamento || "-"}</td>
      <td><span class="report-money-pill">${moeda(compra.valor)}</span></td>
      <td><span class="${classeStatus(compra.status)}">${compra.status}</span></td>
    </tr>
  `).join("");
}

function renderizarDashboardCartoes() {
  renderizarKpisCartoes();
  desenharEvolucaoGastos();
  desenharDonutDepartamentos();
  renderizarCardsLaterais();
  renderizarUltimasTransacoes();
}

async function carregarDashboardCartoes() {
  const [resumo, compras, cartoes] = await Promise.all([
    fetch("/api/dashboard/cartoes").then((res) => res.json()),
    fetch("/api/compras-cartao").then((res) => res.json()),
    fetch("/api/cartoes").then((res) => res.json())
  ]);

  dashboardCartoesState.resumo = resumo;
  dashboardCartoesState.compras = Array.isArray(compras) ? compras : [];
  dashboardCartoesState.cartoes = Array.isArray(cartoes) ? cartoes : [];
  renderizarDashboardCartoes();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("#themeToggle")) {
    window.setTimeout(renderizarDashboardCartoes, 0);
  }
});

carregarDashboardCartoes();
