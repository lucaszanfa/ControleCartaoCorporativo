const meses = [
  { valor: "01", nome: "Janeiro" },
  { valor: "02", nome: "Fevereiro" },
  { valor: "03", nome: "Março" },
  { valor: "04", nome: "Abril" },
  { valor: "05", nome: "Maio" },
  { valor: "06", nome: "Junho" },
  { valor: "07", nome: "Julho" },
  { valor: "08", nome: "Agosto" },
  { valor: "09", nome: "Setembro" },
  { valor: "10", nome: "Outubro" },
  { valor: "11", nome: "Novembro" },
  { valor: "12", nome: "Dezembro" }
];

const anos = ["2026", "2025"];
const coresGrafico = ["#2563eb", "#059669", "#0f766e", "#475569", "#0891b2", "#7c3aed", "#ca8a04", "#dc2626", "#4f46e5", "#16a34a"];
const chartTextColor = "#334155";
const chartMutedColor = "#64748b";
const chartGridColor = "#e5eef5";

const controles = {
  mesRelatorio: document.getElementById("mesRelatorio"),
  anoRelatorio: document.getElementById("anoRelatorio"),
  setorRelatorio: document.getElementById("setorRelatorio"),
  tipoVisualizacao: document.getElementById("tipoVisualizacao"),
  mesComparativo1: document.getElementById("mesComparativo1"),
  anoComparativo1: document.getElementById("anoComparativo1"),
  mesComparativo2: document.getElementById("mesComparativo2"),
  anoComparativo2: document.getElementById("anoComparativo2"),
  setorComparativo: document.getElementById("setorComparativo"),
  tipoVisualizacaoComparativo: document.getElementById("tipoVisualizacaoComparativo"),
  mesGastos: document.getElementById("mesGastos"),
  anoGastos: document.getElementById("anoGastos"),
  tipoVisualizacaoGastos: document.getElementById("tipoVisualizacaoGastos"),
  totalGastoMes: document.getElementById("totalGastoMes")
};

function preencherSelectMesAno(select) {
  if (!select || select.tagName !== "SELECT") {
    return;
  }

  if (select.id.toLowerCase().includes("mes")) {
    select.innerHTML = meses.map((mes) => `<option value="${mes.valor}">${mes.nome}</option>`).join("");
    return;
  }

  if (select.id.toLowerCase().includes("ano")) {
    select.innerHTML = anos.map((ano) => `<option value="${ano}">${ano}</option>`).join("");
  }
}

function preencherSelectSetor(select) {
  select.innerHTML = `<option value="">Geral</option>`;
  select.innerHTML += setores.map((setor) => `<option value="${setor}">${setor}</option>`).join("");
}

function preencherSelects() {
  Object.values(controles).forEach((select) => preencherSelectMesAno(select));
  preencherSelectSetor(controles.setorRelatorio);
  preencherSelectSetor(controles.setorComparativo);

  controles.mesRelatorio.value = "06";
  controles.anoRelatorio.value = "2026";
  controles.mesComparativo1.value = "05";
  controles.anoComparativo1.value = "2026";
  controles.mesComparativo2.value = "06";
  controles.anoComparativo2.value = "2026";
  controles.tipoVisualizacaoComparativo.value = "lista";
  controles.tipoVisualizacao.value = "lista";
  controles.mesGastos.value = "06";
  controles.anoGastos.value = "2026";
  controles.tipoVisualizacaoGastos.value = "lista";
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function filtrarSaidas(mes, ano, setor) {
  const prefixo = `${ano}-${mes}`;
  return saidas.filter((saida) => {
    const correspondePeriodo = saida.data.startsWith(prefixo);
    const correspondeSetor = !setor || saida.setor === setor;
    return correspondePeriodo && correspondeSetor;
  });
}

function totalPorMaterial(mes, ano, setor) {
  return filtrarSaidas(mes, ano, setor).reduce((acumulador, saida) => {
    acumulador[saida.materialId] = (acumulador[saida.materialId] || 0) + saida.quantidade;
    return acumulador;
  }, {});
}

function dadosRelatorioMensal() {
  const filtroSetor = controles.setorRelatorio.value;
  const saidasDoPeriodo = filtrarSaidas(
    controles.mesRelatorio.value,
    controles.anoRelatorio.value,
    filtroSetor
  );
  const totais = totalPorMaterial(
    controles.mesRelatorio.value,
    controles.anoRelatorio.value,
    filtroSetor
  );
  const porDepartamento = saidasDoPeriodo.reduce((acumulador, saida) => {
    if (!acumulador[saida.materialId]) {
      acumulador[saida.materialId] = {};
    }

    acumulador[saida.materialId][saida.setor] = (acumulador[saida.materialId][saida.setor] || 0) + saida.quantidade;
    return acumulador;
  }, {});

  return materiais.map((material) => ({
    ...material,
    total: totais[material.id] || 0,
    departamentos: porDepartamento[material.id] || {}
  }));
}

function detalharDepartamentos(departamentos) {
  const detalhes = Object.entries(departamentos)
    .sort((a, b) => b[1] - a[1])
    .map(([setor, quantidade]) => `${setor}: ${quantidade}`);

  return detalhes.length ? detalhes.join("<br>") : "-";
}

function renderizarRelatorioMensal() {
  const dados = dadosRelatorioMensal();
  const tbody = document.getElementById("relatorioMensalTabela");
  const consumidos = dados.filter((material) => material.total > 0);
  const totalItens = consumidos.reduce((total, material) => total + Number(material.total || 0), 0);
  const maiorConsumo = consumidos.reduce((maior, material) => {
    if (!maior || material.total > maior.total) return material;
    return maior;
  }, null);

  document.getElementById("resumoMateriaisConsumidos").textContent = consumidos.length;
  document.getElementById("resumoItensConsumidos").textContent = totalItens;
  document.getElementById("resumoMaiorConsumo").textContent = maiorConsumo?.nome || "-";

  tbody.innerHTML = dados.map((material) => {
    return `
      <tr class="report-data-row">
        <td><strong>${material.nome}</strong></td>
        <td>${material.categoria}</td>
        <td>${material.unidade}</td>
        <td><span class="report-number-pill">${material.total}</span></td>
        <td>${controles.setorRelatorio.value ? "-" : detalharDepartamentos(material.departamentos)}</td>
      </tr>
    `;
  }).join("");

  renderizarVisualizacao();
}

function renderizarVisualizacao() {
  const tipo = controles.tipoVisualizacao.value;
  document.getElementById("visualizacaoLista").classList.toggle("hidden", tipo !== "lista");
  document.getElementById("visualizacaoBarras").classList.toggle("hidden", tipo !== "barras");
  document.getElementById("visualizacaoPizza").classList.toggle("hidden", tipo !== "pizza");

  if (tipo === "barras") {
    desenharGraficoBarras(dadosRelatorioMensal());
  }

  if (tipo === "pizza") {
    desenharGraficoPizza(dadosRelatorioMensal());
  }
}

function prepararCanvas(canvas) {
  const contexto = canvas.getContext("2d");
  contexto.clearRect(0, 0, canvas.width, canvas.height);
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.imageSmoothingEnabled = true;
  contexto.font = "13px Arial";
  contexto.textBaseline = "middle";
  return contexto;
}

function desenharMensagemVazia(contexto, canvas) {
  contexto.fillStyle = chartMutedColor;
  contexto.textAlign = "center";
  contexto.fillText("Nenhum consumo encontrado para os filtros selecionados.", canvas.width / 2, canvas.height / 2);
}

function textoCurto(texto, limite = 18) {
  const valor = String(texto || "");
  return valor.length > limite ? `${valor.slice(0, limite - 1)}…` : valor;
}

function caminhoRetanguloArredondado(contexto, x, y, largura, altura, raio = 6) {
  const r = Math.min(raio, largura / 2, Math.abs(altura) / 2);
  contexto.beginPath();
  contexto.moveTo(x + r, y);
  contexto.lineTo(x + largura - r, y);
  contexto.quadraticCurveTo(x + largura, y, x + largura, y + r);
  contexto.lineTo(x + largura, y + altura);
  contexto.lineTo(x, y + altura);
  contexto.lineTo(x, y + r);
  contexto.quadraticCurveTo(x, y, x + r, y);
  contexto.closePath();
}

function preencherBarra(contexto, x, y, largura, altura, cor) {
  contexto.fillStyle = cor;
  caminhoRetanguloArredondado(contexto, x, y, largura, altura, 7);
  contexto.fill();
}

function desenharFrameGrafico(contexto, canvas, margem, alturaGrafico, maiorValor, formatador = (v) => v) {
  const baseY = alturaGrafico + 34;
  const passos = 4;
  contexto.strokeStyle = chartGridColor;
  contexto.lineWidth = 1;
  contexto.fillStyle = chartMutedColor;
  contexto.font = "12px Arial";
  contexto.textAlign = "right";

  for (let i = 0; i <= passos; i += 1) {
    const valor = maiorValor * (i / passos);
    const y = baseY - (alturaGrafico * i / passos);
    contexto.beginPath();
    contexto.moveTo(margem, y);
    contexto.lineTo(canvas.width - margem, y);
    contexto.stroke();
    if (i > 0) contexto.fillText(formatador(valor), margem - 10, y);
  }

  contexto.strokeStyle = "#cbd5e1";
  contexto.beginPath();
  contexto.moveTo(margem, 34);
  contexto.lineTo(margem, baseY);
  contexto.lineTo(canvas.width - margem, baseY);
  contexto.stroke();
}

function renderizarLegenda(legenda, itens) {
  legenda.innerHTML = itens.map((item) => `
    <span>
      <i style="background:${item.cor}"></i>
      ${item.nome}
    </span>
  `).join("");
}

function desenharGraficoBarras(dados) {
  const canvas = document.getElementById("graficoBarras");
  const contexto = prepararCanvas(canvas);
  const legenda = document.getElementById("legendaBarras");
  legenda.innerHTML = "";

  if (!controles.setorRelatorio.value) {
    desenharGraficoBarrasDepartamentos(dados, canvas, contexto, legenda);
    return;
  }

  const dadosComConsumo = dados.filter((item) => item.total > 0);

  if (!dadosComConsumo.length) {
    desenharMensagemVazia(contexto, canvas);
    return;
  }

  const margem = 86;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 112;
  const maiorValor = Math.max(...dadosComConsumo.map((item) => item.total));
  const larguraGrupo = larguraGrafico / dadosComConsumo.length;
  const larguraBarra = Math.min(74, Math.max(28, larguraGrupo * 0.58));
  desenharFrameGrafico(contexto, canvas, margem, alturaGrafico, maiorValor);

  dadosComConsumo.forEach((item, index) => {
    const alturaBarra = (item.total / maiorValor) * alturaGrafico;
    const x = margem + index * larguraGrupo + (larguraGrupo - larguraBarra) / 2;
    const y = alturaGrafico + 34 - alturaBarra;

    preencherBarra(contexto, x, y, larguraBarra, alturaBarra, coresGrafico[index % coresGrafico.length]);

    contexto.fillStyle = chartTextColor;
    contexto.textAlign = "center";
    contexto.font = "700 13px Arial";
    contexto.fillText(item.total, x + larguraBarra / 2, y - 12);
    contexto.font = "12px Arial";
    contexto.fillStyle = chartMutedColor;
    contexto.save();
    contexto.translate(x + larguraBarra / 2, alturaGrafico + 64);
    contexto.rotate(-0.38);
    contexto.fillText(textoCurto(item.nome, 16), 0, 0);
    contexto.restore();
  });
}

function desenharGraficoBarrasDepartamentos(dados, canvas, contexto, legenda) {
  const dadosComConsumo = dados.filter((item) => item.total > 0);

  if (!dadosComConsumo.length) {
    desenharMensagemVazia(contexto, canvas);
    return;
  }

  const departamentos = [...new Set(dadosComConsumo.flatMap((item) => Object.keys(item.departamentos)))];
  const margem = 86;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 112;
  const maiorValor = Math.max(...dadosComConsumo.map((item) => item.total));
  const larguraGrupo = larguraGrafico / dadosComConsumo.length;
  const larguraBarra = Math.min(74, Math.max(28, larguraGrupo * 0.58));
  desenharFrameGrafico(contexto, canvas, margem, alturaGrafico, maiorValor);

  dadosComConsumo.forEach((item, index) => {
    const x = margem + index * larguraGrupo + (larguraGrupo - larguraBarra) / 2;
    let yAtual = alturaGrafico + 34;

    departamentos.forEach((departamento, deptIndex) => {
      const quantidade = item.departamentos[departamento] || 0;
      const alturaSegmento = maiorValor ? (quantidade / maiorValor) * alturaGrafico : 0;

      if (alturaSegmento > 0) {
        yAtual -= alturaSegmento;
        contexto.fillStyle = coresGrafico[deptIndex % coresGrafico.length];
        contexto.fillRect(x, yAtual, larguraBarra, alturaSegmento);
      }
    });

    contexto.fillStyle = chartTextColor;
    contexto.textAlign = "center";
    contexto.font = "700 13px Arial";
    contexto.fillText(item.total, x + larguraBarra / 2, yAtual - 12);
    contexto.font = "12px Arial";
    contexto.fillStyle = chartMutedColor;
    contexto.save();
    contexto.translate(x + larguraBarra / 2, alturaGrafico + 64);
    contexto.rotate(-0.38);
    contexto.fillText(textoCurto(item.nome, 16), 0, 0);
    contexto.restore();
  });

  renderizarLegenda(legenda, departamentos.map((departamento, index) => ({
    nome: departamento,
    cor: coresGrafico[index % coresGrafico.length]
  })));
}

function desenharGraficoPizza(dados) {
  const canvas = document.getElementById("graficoPizza");
  const contexto = prepararCanvas(canvas);
  const legenda = document.getElementById("legendaPizza");
  if (!controles.setorRelatorio.value) {
    desenharGraficoPizzaDepartamentos(dados, canvas, contexto, legenda);
    return;
  }

  const dadosComConsumo = dados.filter((item) => item.total > 0);
  const totalGeral = dadosComConsumo.reduce((total, item) => total + item.total, 0);

  legenda.innerHTML = "";

  if (!dadosComConsumo.length) {
    desenharMensagemVazia(contexto, canvas);
    return;
  }

  let anguloInicial = -Math.PI / 2;
  const centroX = canvas.width / 2;
  const centroY = 172;
  const raio = 118;

  dadosComConsumo.forEach((item, index) => {
    const angulo = (item.total / totalGeral) * Math.PI * 2;
    const cor = coresGrafico[index % coresGrafico.length];

    contexto.beginPath();
    contexto.moveTo(centroX, centroY);
    contexto.arc(centroX, centroY, raio, anguloInicial, anguloInicial + angulo);
    contexto.closePath();
    contexto.fillStyle = cor;
    contexto.fill();

    anguloInicial += angulo;
    const percentual = Math.round((item.total / totalGeral) * 100);
    legenda.innerHTML += `
      <span>
        <i style="background:${cor}"></i>
        ${item.nome}: ${item.total} (${percentual}%)
      </span>
    `;
  });

  contexto.fillStyle = "#f8fafc";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 64, 0, Math.PI * 2);
  contexto.fill();
  contexto.strokeStyle = "#e2e8f0";
  contexto.lineWidth = 1;
  contexto.stroke();
  contexto.fillStyle = chartTextColor;
  contexto.textAlign = "center";
  contexto.font = "700 18px Arial";
  contexto.fillText(totalGeral, centroX, centroY - 8);
  contexto.font = "13px Arial";
  contexto.fillStyle = chartMutedColor;
  contexto.fillText("itens", centroX, centroY + 14);
}

function desenharGraficoPizzaDepartamentos(dados, canvas, contexto, legenda) {
  const totaisDepartamento = dados.reduce((acumulador, material) => {
    Object.entries(material.departamentos).forEach(([departamento, quantidade]) => {
      acumulador[departamento] = (acumulador[departamento] || 0) + quantidade;
    });
    return acumulador;
  }, {});
  const dadosPizza = Object.entries(totaisDepartamento)
    .map(([nome, total]) => ({ nome, total }))
    .filter((item) => item.total > 0);
  const totalGeral = dadosPizza.reduce((total, item) => total + item.total, 0);

  legenda.innerHTML = "";

  if (!dadosPizza.length) {
    desenharMensagemVazia(contexto, canvas);
    return;
  }

  let anguloInicial = -Math.PI / 2;
  const centroX = canvas.width / 2;
  const centroY = 172;
  const raio = 118;

  dadosPizza.forEach((item, index) => {
    const angulo = (item.total / totalGeral) * Math.PI * 2;
    const cor = coresGrafico[index % coresGrafico.length];

    contexto.beginPath();
    contexto.moveTo(centroX, centroY);
    contexto.arc(centroX, centroY, raio, anguloInicial, anguloInicial + angulo);
    contexto.closePath();
    contexto.fillStyle = cor;
    contexto.fill();

    anguloInicial += angulo;
    const percentual = Math.round((item.total / totalGeral) * 100);
    legenda.innerHTML += `
      <span>
        <i style="background:${cor}"></i>
        ${item.nome}: ${item.total} (${percentual}%)
      </span>
    `;
  });

  contexto.fillStyle = "#f8fafc";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 64, 0, Math.PI * 2);
  contexto.fill();
  contexto.strokeStyle = "#e2e8f0";
  contexto.lineWidth = 1;
  contexto.stroke();
  contexto.fillStyle = chartTextColor;
  contexto.textAlign = "center";
  contexto.font = "700 18px Arial";
  contexto.fillText(totalGeral, centroX, centroY - 8);
  contexto.font = "13px Arial";
  contexto.fillStyle = chartMutedColor;
  contexto.fillText("itens", centroX, centroY + 14);
}

function interpretarVariacao(variacao) {
  if (variacao > 0) {
    return "Aumento de consumo";
  }

  if (variacao < 0) {
    return "Redução de consumo";
  }

  return "Consumo estável";
}

function dadosComparativo() {
  const totalMes1 = totalPorMaterial(
    controles.mesComparativo1.value,
    controles.anoComparativo1.value,
    controles.setorComparativo.value
  );
  const totalMes2 = totalPorMaterial(
    controles.mesComparativo2.value,
    controles.anoComparativo2.value,
    controles.setorComparativo.value
  );

  return materiais.map((material) => {
    const mes1 = totalMes1[material.id] || 0;
    const mes2 = totalMes2[material.id] || 0;
    const variacao = mes2 - mes1;

    return {
      ...material,
      mes1,
      mes2,
      variacao
    };
  });
}

function renderizarComparativo() {
  const dados = dadosComparativo();
  const tbody = document.getElementById("comparativoTabela");

  tbody.innerHTML = dados.map((material) => {
    const sinal = material.variacao > 0 ? "+" : "";
    const variacaoClasse = material.variacao > 0
      ? "report-variation-up"
      : material.variacao < 0
        ? "report-variation-down"
        : "report-variation-flat";

    return `
      <tr class="report-data-row">
        <td><strong>${material.nome}</strong></td>
        <td><span class="report-number-pill">${material.mes1}</span></td>
        <td><span class="report-number-pill">${material.mes2}</span></td>
        <td><span class="${variacaoClasse}">${sinal}${material.variacao}</span></td>
        <td>${interpretarVariacao(material.variacao)}</td>
      </tr>
    `;
  }).join("");

  renderizarVisualizacaoComparativo();
}

function renderizarVisualizacaoComparativo() {
  const tipo = controles.tipoVisualizacaoComparativo.value;
  document.getElementById("visualizacaoComparativoLista").classList.toggle("hidden", tipo !== "lista");
  document.getElementById("visualizacaoComparativoBarras").classList.toggle("hidden", tipo !== "barras");
  document.getElementById("visualizacaoComparativoPizza").classList.toggle("hidden", tipo !== "pizza");

  if (tipo === "barras") {
    desenharGraficoComparativoBarras(dadosComparativo());
  }

  if (tipo === "pizza") {
    desenharGraficoComparativoPizza(dadosComparativo());
  }
}

function desenharGraficoComparativoBarras(dados) {
  const canvas = document.getElementById("graficoComparativoBarras");
  const contexto = prepararCanvas(canvas);
  const dadosComMovimento = dados.filter((item) => item.mes1 > 0 || item.mes2 > 0);

  if (!dadosComMovimento.length) {
    desenharMensagemVazia(contexto, canvas);
    return;
  }

  const margem = 86;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 118;
  const maiorValor = Math.max(...dadosComMovimento.map((item) => Math.max(item.mes1, item.mes2)));
  const larguraGrupo = larguraGrafico / dadosComMovimento.length;
  const larguraBarra = Math.min(34, Math.max(12, larguraGrupo / 4));
  desenharFrameGrafico(contexto, canvas, margem, alturaGrafico, maiorValor);

  dadosComMovimento.forEach((item, index) => {
    const baseX = margem + index * larguraGrupo + larguraGrupo / 2;
    const alturaMes1 = maiorValor ? (item.mes1 / maiorValor) * alturaGrafico : 0;
    const alturaMes2 = maiorValor ? (item.mes2 / maiorValor) * alturaGrafico : 0;
    const yMes1 = alturaGrafico + 34 - alturaMes1;
    const yMes2 = alturaGrafico + 34 - alturaMes2;

    preencherBarra(contexto, baseX - larguraBarra - 3, yMes1, larguraBarra, alturaMes1, "#2563eb");
    preencherBarra(contexto, baseX + 3, yMes2, larguraBarra, alturaMes2, "#059669");

    contexto.fillStyle = chartTextColor;
    contexto.textAlign = "center";
    contexto.font = "12px Arial";
    contexto.fillText(item.mes1, baseX - larguraBarra / 2 - 2, yMes1 - 10);
    contexto.fillText(item.mes2, baseX + larguraBarra / 2 + 2, yMes2 - 10);
    contexto.fillStyle = chartMutedColor;
    contexto.save();
    contexto.translate(baseX, alturaGrafico + 66);
    contexto.rotate(-0.38);
    contexto.fillText(textoCurto(item.nome, 16), 0, 0);
    contexto.restore();
  });

  contexto.textAlign = "left";
  contexto.fillStyle = "#2563eb";
  contexto.fillRect(margem, canvas.height - 24, 12, 12);
  contexto.fillStyle = chartTextColor;
  contexto.fillText("Mês 1", margem + 18, canvas.height - 18);
  contexto.fillStyle = "#059669";
  contexto.fillRect(margem + 82, canvas.height - 24, 12, 12);
  contexto.fillStyle = chartTextColor;
  contexto.fillText("Mês 2", margem + 100, canvas.height - 18);
}

function desenharGraficoComparativoPizza(dados) {
  const canvas = document.getElementById("graficoComparativoPizza");
  const contexto = prepararCanvas(canvas);
  const legenda = document.getElementById("legendaComparativoPizza");
  const dadosComVariacao = dados
    .map((item) => ({ ...item, variacaoAbs: Math.abs(item.variacao) }))
    .filter((item) => item.variacaoAbs > 0);
  const totalVariacao = dadosComVariacao.reduce((total, item) => total + item.variacaoAbs, 0);

  legenda.innerHTML = "";

  if (!dadosComVariacao.length) {
    contexto.fillStyle = "#4b5563";
    contexto.textAlign = "center";
    contexto.fillText("Nenhuma variação encontrada entre os meses selecionados.", canvas.width / 2, canvas.height / 2);
    return;
  }

  let anguloInicial = -Math.PI / 2;
  const centroX = canvas.width / 2;
  const centroY = 172;
  const raio = 118;

  dadosComVariacao.forEach((item, index) => {
    const angulo = (item.variacaoAbs / totalVariacao) * Math.PI * 2;
    const cor = item.variacao >= 0 ? coresGrafico[index % coresGrafico.length] : "#dc2626";

    contexto.beginPath();
    contexto.moveTo(centroX, centroY);
    contexto.arc(centroX, centroY, raio, anguloInicial, anguloInicial + angulo);
    contexto.closePath();
    contexto.fillStyle = cor;
    contexto.fill();

    anguloInicial += angulo;
    const percentual = Math.round((item.variacaoAbs / totalVariacao) * 100);
    const sinal = item.variacao > 0 ? "+" : "";
    legenda.innerHTML += `
      <span>
        <i style="background:${cor}"></i>
        ${item.nome}: ${sinal}${item.variacao} (${percentual}% da variação)
      </span>
    `;
  });

  contexto.fillStyle = "#f8fafc";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 64, 0, Math.PI * 2);
  contexto.fill();
  contexto.strokeStyle = "#e2e8f0";
  contexto.lineWidth = 1;
  contexto.stroke();
  contexto.fillStyle = chartTextColor;
  contexto.textAlign = "center";
  contexto.font = "700 16px Arial";
  contexto.fillText(totalVariacao, centroX, centroY - 8);
  contexto.font = "13px Arial";
  contexto.fillStyle = chartMutedColor;
  contexto.fillText("variação", centroX, centroY + 14);
}

function filtrarEntradas(mes, ano) {
  const prefixo = `${ano}-${mes}`;
  return entradas.filter((entrada) => entrada.data.startsWith(prefixo));
}

function dadosGastosMensais() {
  const totais = filtrarEntradas(controles.mesGastos.value, controles.anoGastos.value)
    .reduce((acumulador, entrada) => {
      if (!acumulador[entrada.materialId]) {
        acumulador[entrada.materialId] = { quantidade: 0, valorTotal: 0 };
      }

      acumulador[entrada.materialId].quantidade += entrada.quantidade;
      acumulador[entrada.materialId].valorTotal += entrada.valorTotal;
      return acumulador;
    }, {});

  return materiais.map((material) => ({
    ...material,
    quantidadeComprada: totais[material.id]?.quantidade || 0,
    valorTotal: totais[material.id]?.valorTotal || 0
  }));
}

function renderizarGastosMensais() {
  const dados = dadosGastosMensais();
  const tbody = document.getElementById("gastosTabela");
  const totalGeral = dados.reduce((total, material) => total + material.valorTotal, 0);

  controles.totalGastoMes.value = formatarMoeda(totalGeral);
  tbody.innerHTML = dados.map((material) => {
    return `
      <tr class="report-data-row">
        <td><strong>${material.nome}</strong></td>
        <td>${material.categoria}</td>
        <td>${material.unidade}</td>
        <td><span class="report-number-pill">${material.quantidadeComprada}</span></td>
        <td><span class="report-money-pill">${formatarMoeda(material.valorTotal)}</span></td>
      </tr>
    `;
  }).join("");

  renderizarVisualizacaoGastos();
}

function textoSelecionado(select) {
  return select.options[select.selectedIndex]?.textContent || "-";
}

function topMateriaisConsumo(dados, limite = 5) {
  return [...dados]
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .slice(0, limite);
}

function textoMaiorDepartamento(material) {
  const departamentos = Object.entries(material.departamentos || {}).sort((a, b) => b[1] - a[1]);
  if (!departamentos.length) return "-";
  return `${departamentos[0][0]} (${departamentos[0][1]})`;
}

function canvasRelatorioMensalSelecionado() {
  if (controles.tipoVisualizacao.value === "barras") {
    desenharGraficoBarras(dadosRelatorioMensal());
    return document.getElementById("graficoBarras");
  }

  if (controles.tipoVisualizacao.value === "pizza") {
    desenharGraficoPizza(dadosRelatorioMensal());
    return document.getElementById("graficoPizza");
  }

  return null;
}

function adicionarTabelaConsumoPdf(pdf, dados, setor) {
  pdf.section("Materiais com maior consumo");
  const topMateriais = topMateriaisConsumo(dados);
  if (topMateriais.length) {
    pdf.bullets(topMateriais.map((material, index) => {
      const departamento = controles.setorRelatorio.value ? setor : textoMaiorDepartamento(material);
      return `${index + 1}. ${material.nome}: ${material.total} ${material.unidade} - principal setor: ${departamento}`;
    }));
  } else {
    pdf.text("Nenhum material consumido no periodo selecionado.", pdf.margin, pdf.y, { size: 10 });
    pdf.y += 18;
  }

  pdf.section("Detalhamento por material");
  pdf.table(
    ["Material", "Categoria", "Unidade", "Total", "Por departamento"],
    dados.map((material) => [
      material.nome,
      material.categoria,
      material.unidade,
      material.total,
      controles.setorRelatorio.value
        ? setor
        : Object.entries(material.departamentos)
          .map(([departamento, quantidade]) => `${departamento}: ${quantidade}`)
          .join("; ") || "-"
    ]),
    [190, 120, 80, 55, 320]
  );
}

function adicionarGraficoConsumoPdf(pdf, dados, setor) {
  const canvas = canvasRelatorioMensalSelecionado();

  pdf.section("Leitura rapida do grafico");
  const topMateriais = topMateriaisConsumo(dados, 3);
  if (topMateriais.length) {
    pdf.bullets(topMateriais.map((material) => {
      const departamento = controles.setorRelatorio.value ? setor : textoMaiorDepartamento(material);
      return `${material.nome} concentra ${material.total} itens consumidos. Principal setor: ${departamento}.`;
    }));
  } else {
    pdf.text("Nenhum consumo encontrado para os filtros selecionados.", pdf.margin, pdf.y, { size: 10 });
    pdf.y += 18;
  }

  pdf.section(textoSelecionado(controles.tipoVisualizacao));
  if (canvas) {
    pdf.rect(pdf.margin, pdf.y, pdf.width - pdf.margin * 2, 316, [248, 250, 252]);
    pdf.imageFromCanvas(canvas, pdf.margin, pdf.y, pdf.width - pdf.margin * 2, 300);
  }

  if (controles.tipoVisualizacao.value === "pizza") {
    const descricao = controles.setorRelatorio.value
      ? dados.map((material) => `${material.nome}: ${material.total}`).join("; ")
      : dados.map((material) => {
          const departamentos = Object.entries(material.departamentos)
            .map(([departamento, quantidade]) => `${departamento}: ${quantidade}`)
            .join(", ");
          return `${material.nome}: ${material.total}${departamentos ? ` (${departamentos})` : ""}`;
        }).join("; ");
    pdf.text(`Base do grafico: ${descricao || `Nenhum consumo em ${setor}`}`, pdf.margin, pdf.y, { size: 8, color: [71, 85, 105] });
  }
}

function baixarPdfConsumoMensal() {
  const dados = dadosRelatorioMensal().filter((material) => material.total > 0);
  const mes = textoSelecionado(controles.mesRelatorio);
  const ano = controles.anoRelatorio.value;
  const setor = textoSelecionado(controles.setorRelatorio);
  const totalItens = dados.reduce((sum, material) => sum + Number(material.total || 0), 0);
  const totalMateriais = dados.length;
  const maiorConsumo = topMateriaisConsumo(dados, 1)[0];

  const pdf = new PdfReport({
    title: "Relatorio mensal de consumo",
    subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")} - Controle de materiais`
  });

  pdf.section("Resumo do periodo");
  pdf.keyValues([
    { label: "Periodo", value: `${mes}/${ano}` },
    { label: "Departamento", value: setor || "Geral" },
    { label: "Materiais consumidos", value: totalMateriais },
    { label: "Itens consumidos", value: totalItens },
    { label: "Maior consumo", value: maiorConsumo ? `${maiorConsumo.nome} (${maiorConsumo.total})` : "-" },
    { label: "Formato exportado", value: textoSelecionado(controles.tipoVisualizacao) }
  ]);

  pdf.section("Filtros aplicados");
  pdf.keyValues([
    { label: "Mes", value: mes },
    { label: "Ano", value: ano },
    { label: "Departamento", value: setor || "Geral" }
  ]);

  if (controles.tipoVisualizacao.value === "lista") {
    adicionarTabelaConsumoPdf(pdf, dados, setor);
  } else {
    adicionarGraficoConsumoPdf(pdf, dados, setor);
  }

  if (!dados.length) {
    pdf.text("Nenhum consumo encontrado para os filtros selecionados.", pdf.margin, pdf.y, { size: 10 });
  }

  pdf.output(`relatorio-consumo-${ano}-${controles.mesRelatorio.value}.pdf`);
}

function renderizarVisualizacaoGastos() {
  const tipo = controles.tipoVisualizacaoGastos.value;
  document.getElementById("visualizacaoGastosLista").classList.toggle("hidden", tipo !== "lista");
  document.getElementById("visualizacaoGastosBarras").classList.toggle("hidden", tipo !== "barras");
  document.getElementById("visualizacaoGastosPizza").classList.toggle("hidden", tipo !== "pizza");

  if (tipo === "barras") {
    desenharGraficoGastosBarras(dadosGastosMensais());
  }

  if (tipo === "pizza") {
    desenharGraficoGastosPizza(dadosGastosMensais());
  }
}

function desenharGraficoGastosBarras(dados) {
  const canvas = document.getElementById("graficoGastosBarras");
  const contexto = prepararCanvas(canvas);
  const dadosComGasto = dados.filter((item) => item.valorTotal > 0);

  if (!dadosComGasto.length) {
    contexto.fillStyle = "#4b5563";
    contexto.textAlign = "center";
    contexto.fillText("Nenhum gasto encontrado para os filtros selecionados.", canvas.width / 2, canvas.height / 2);
    return;
  }

  const margem = 92;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 112;
  const maiorValor = Math.max(...dadosComGasto.map((item) => item.valorTotal));
  const larguraGrupo = larguraGrafico / dadosComGasto.length;
  const larguraBarra = Math.min(74, Math.max(28, larguraGrupo * 0.58));
  desenharFrameGrafico(contexto, canvas, margem, alturaGrafico, maiorValor, (valor) => formatarMoeda(valor).replace("R$", "").trim());

  dadosComGasto.forEach((item, index) => {
    const alturaBarra = (item.valorTotal / maiorValor) * alturaGrafico;
    const x = margem + index * larguraGrupo + (larguraGrupo - larguraBarra) / 2;
    const y = alturaGrafico + 34 - alturaBarra;

    preencherBarra(contexto, x, y, larguraBarra, alturaBarra, coresGrafico[index % coresGrafico.length]);

    contexto.fillStyle = chartTextColor;
    contexto.textAlign = "center";
    contexto.font = "700 12px Arial";
    contexto.fillText(formatarMoeda(item.valorTotal), x + larguraBarra / 2, y - 12);
    contexto.font = "12px Arial";
    contexto.fillStyle = chartMutedColor;
    contexto.save();
    contexto.translate(x + larguraBarra / 2, alturaGrafico + 64);
    contexto.rotate(-0.38);
    contexto.fillText(textoCurto(item.nome, 16), 0, 0);
    contexto.restore();
  });
}

function desenharGraficoGastosPizza(dados) {
  const canvas = document.getElementById("graficoGastosPizza");
  const contexto = prepararCanvas(canvas);
  const legenda = document.getElementById("legendaGastosPizza");
  const dadosComGasto = dados.filter((item) => item.valorTotal > 0);
  const totalGeral = dadosComGasto.reduce((total, item) => total + item.valorTotal, 0);

  legenda.innerHTML = "";

  if (!dadosComGasto.length) {
    contexto.fillStyle = "#4b5563";
    contexto.textAlign = "center";
    contexto.fillText("Nenhum gasto encontrado para os filtros selecionados.", canvas.width / 2, canvas.height / 2);
    return;
  }

  let anguloInicial = -Math.PI / 2;
  const centroX = canvas.width / 2;
  const centroY = 172;
  const raio = 118;

  dadosComGasto.forEach((item, index) => {
    const angulo = (item.valorTotal / totalGeral) * Math.PI * 2;
    const cor = coresGrafico[index % coresGrafico.length];

    contexto.beginPath();
    contexto.moveTo(centroX, centroY);
    contexto.arc(centroX, centroY, raio, anguloInicial, anguloInicial + angulo);
    contexto.closePath();
    contexto.fillStyle = cor;
    contexto.fill();

    anguloInicial += angulo;
    const percentual = Math.round((item.valorTotal / totalGeral) * 100);
    legenda.innerHTML += `
      <span>
        <i style="background:${cor}"></i>
        ${item.nome}: ${formatarMoeda(item.valorTotal)} (${percentual}%)
      </span>
    `;
  });

  contexto.fillStyle = "#f8fafc";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 64, 0, Math.PI * 2);
  contexto.fill();
  contexto.strokeStyle = "#e2e8f0";
  contexto.lineWidth = 1;
  contexto.stroke();
  contexto.fillStyle = chartTextColor;
  contexto.textAlign = "center";
  contexto.font = "700 16px Arial";
  contexto.fillText(formatarMoeda(totalGeral), centroX, centroY - 8);
  contexto.font = "13px Arial";
  contexto.fillStyle = chartMutedColor;
  contexto.fillText("gasto", centroX, centroY + 14);
}

function atualizarRelatorios() {
  renderizarRelatorioMensal();
  renderizarComparativo();
  renderizarGastosMensais();
}

preencherSelects();
atualizarRelatorios();
Object.values(controles).forEach((select) => select.addEventListener("change", atualizarRelatorios));
document.getElementById("baixarPdfConsumo").addEventListener("click", baixarPdfConsumoMensal);
