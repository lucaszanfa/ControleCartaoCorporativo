async function carregarDashboardCartoes() {
  const dados = await (await fetch("/api/dashboard/cartoes")).json();
  const cards = [
    ["Cartões ativos", dados.total_cartoes_ativos],
    ["Compras no mês", dados.compras_registradas_mes],
    ["Valor registrado no mês", moeda(dados.valor_total_mes)],
    ["Transações da fatura", dados.transacoes_fatura_mes],
    ["Compras sem registro", dados.compras_sem_registro],
    ["Alertas pendentes", dados.alertas_pendentes],
    ["Departamento maior gasto", dados.departamento_maior_gasto],
    ["Cartão maior gasto", dados.cartao_maior_gasto],
    ["Sem comprovante", dados.compras_sem_comprovante],
    ["Divergências abertas", dados.divergencias_abertas]
  ];
  document.getElementById("cartoesDashboardCards").innerHTML = cards.map(([label, value], index) => `
    <article class="card metric-card dashboard-card-${index + 1}"><span>${label}</span><strong>${value}</strong></article>
  `).join("");
}

carregarDashboardCartoes();
