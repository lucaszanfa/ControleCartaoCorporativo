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
const coresGrafico = ["#0787d8", "#32b96f", "#0b3f55", "#f51b87", "#7dd3fc", "#14b8a6", "#155e75", "#84cc16", "#0284c7", "#22c55e"];

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

  tbody.innerHTML = dados.map((material) => {
    return `
      <tr>
        <td>${material.nome}</td>
        <td>${material.categoria}</td>
        <td>${material.unidade}</td>
        <td>${material.total}</td>
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
  contexto.font = "14px Arial";
  contexto.textBaseline = "middle";
  return contexto;
}

function desenharMensagemVazia(contexto, canvas) {
  contexto.fillStyle = "#4b5563";
  contexto.textAlign = "center";
  contexto.fillText("Nenhum consumo encontrado para os filtros selecionados.", canvas.width / 2, canvas.height / 2);
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

  const margem = 54;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 100;
  const maiorValor = Math.max(...dadosComConsumo.map((item) => item.total));
  const larguraBarra = larguraGrafico / dadosComConsumo.length - 14;

  contexto.strokeStyle = "#d9dee7";
  contexto.beginPath();
  contexto.moveTo(margem, 28);
  contexto.lineTo(margem, alturaGrafico + 30);
  contexto.lineTo(canvas.width - margem, alturaGrafico + 30);
  contexto.stroke();

  dadosComConsumo.forEach((item, index) => {
    const alturaBarra = (item.total / maiorValor) * alturaGrafico;
    const x = margem + index * (larguraBarra + 14) + 8;
    const y = alturaGrafico + 30 - alturaBarra;

    contexto.fillStyle = coresGrafico[index % coresGrafico.length];
    contexto.fillRect(x, y, larguraBarra, alturaBarra);

    contexto.fillStyle = "#0b3f55";
    contexto.textAlign = "center";
    contexto.fillText(item.total, x + larguraBarra / 2, y - 12);
    contexto.save();
    contexto.translate(x + larguraBarra / 2, alturaGrafico + 54);
    contexto.rotate(-0.45);
    contexto.fillText(item.nome, 0, 0);
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
  const margem = 54;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 100;
  const maiorValor = Math.max(...dadosComConsumo.map((item) => item.total));
  const larguraBarra = larguraGrafico / dadosComConsumo.length - 14;

  contexto.strokeStyle = "#d9dee7";
  contexto.beginPath();
  contexto.moveTo(margem, 28);
  contexto.lineTo(margem, alturaGrafico + 30);
  contexto.lineTo(canvas.width - margem, alturaGrafico + 30);
  contexto.stroke();

  dadosComConsumo.forEach((item, index) => {
    const x = margem + index * (larguraBarra + 14) + 8;
    let yAtual = alturaGrafico + 30;

    departamentos.forEach((departamento, deptIndex) => {
      const quantidade = item.departamentos[departamento] || 0;
      const alturaSegmento = maiorValor ? (quantidade / maiorValor) * alturaGrafico : 0;

      if (alturaSegmento > 0) {
        yAtual -= alturaSegmento;
        contexto.fillStyle = coresGrafico[deptIndex % coresGrafico.length];
        contexto.fillRect(x, yAtual, larguraBarra, alturaSegmento);
      }
    });

    contexto.fillStyle = "#0b3f55";
    contexto.textAlign = "center";
    contexto.fillText(item.total, x + larguraBarra / 2, yAtual - 12);
    contexto.save();
    contexto.translate(x + larguraBarra / 2, alturaGrafico + 54);
    contexto.rotate(-0.45);
    contexto.fillText(item.nome, 0, 0);
    contexto.restore();
  });

  legenda.innerHTML = departamentos.map((departamento, index) => {
    const cor = coresGrafico[index % coresGrafico.length];
    return `
      <span>
        <i style="background:${cor}"></i>
        ${departamento}
      </span>
    `;
  }).join("");
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
  const raio = 120;

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

  contexto.fillStyle = "#ffffff";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 54, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = "#0b3f55";
  contexto.textAlign = "center";
  contexto.font = "700 18px Arial";
  contexto.fillText(totalGeral, centroX, centroY - 8);
  contexto.font = "13px Arial";
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
  const raio = 120;

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

  contexto.fillStyle = "#ffffff";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 54, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = "#0b3f55";
  contexto.textAlign = "center";
  contexto.font = "700 18px Arial";
  contexto.fillText(totalGeral, centroX, centroY - 8);
  contexto.font = "13px Arial";
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

    return `
      <tr>
        <td>${material.nome}</td>
        <td>${material.mes1}</td>
        <td>${material.mes2}</td>
        <td>${sinal}${material.variacao}</td>
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

  const margem = 54;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 110;
  const maiorValor = Math.max(...dadosComMovimento.map((item) => Math.max(item.mes1, item.mes2)));
  const larguraGrupo = larguraGrafico / dadosComMovimento.length;
  const larguraBarra = Math.max(12, larguraGrupo / 3);

  contexto.strokeStyle = "#d9dee7";
  contexto.beginPath();
  contexto.moveTo(margem, 28);
  contexto.lineTo(margem, alturaGrafico + 30);
  contexto.lineTo(canvas.width - margem, alturaGrafico + 30);
  contexto.stroke();

  dadosComMovimento.forEach((item, index) => {
    const baseX = margem + index * larguraGrupo + larguraGrupo / 2;
    const alturaMes1 = maiorValor ? (item.mes1 / maiorValor) * alturaGrafico : 0;
    const alturaMes2 = maiorValor ? (item.mes2 / maiorValor) * alturaGrafico : 0;
    const yMes1 = alturaGrafico + 30 - alturaMes1;
    const yMes2 = alturaGrafico + 30 - alturaMes2;

    contexto.fillStyle = "#0787d8";
    contexto.fillRect(baseX - larguraBarra - 2, yMes1, larguraBarra, alturaMes1);
    contexto.fillStyle = "#32b96f";
    contexto.fillRect(baseX + 2, yMes2, larguraBarra, alturaMes2);

    contexto.fillStyle = "#0b3f55";
    contexto.textAlign = "center";
    contexto.font = "12px Arial";
    contexto.fillText(item.mes1, baseX - larguraBarra / 2 - 2, yMes1 - 10);
    contexto.fillText(item.mes2, baseX + larguraBarra / 2 + 2, yMes2 - 10);
    contexto.save();
    contexto.translate(baseX, alturaGrafico + 58);
    contexto.rotate(-0.45);
    contexto.fillText(item.nome, 0, 0);
    contexto.restore();
  });

  contexto.textAlign = "left";
  contexto.fillStyle = "#0787d8";
  contexto.fillRect(margem, canvas.height - 24, 12, 12);
  contexto.fillStyle = "#0b3f55";
  contexto.fillText("Mês 1", margem + 18, canvas.height - 18);
  contexto.fillStyle = "#32b96f";
  contexto.fillRect(margem + 82, canvas.height - 24, 12, 12);
  contexto.fillStyle = "#0b3f55";
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
  const raio = 120;

  dadosComVariacao.forEach((item, index) => {
    const angulo = (item.variacaoAbs / totalVariacao) * Math.PI * 2;
    const cor = item.variacao >= 0 ? coresGrafico[index % coresGrafico.length] : "#f43f5e";

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

  contexto.fillStyle = "#ffffff";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 54, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = "#0b3f55";
  contexto.textAlign = "center";
  contexto.font = "700 16px Arial";
  contexto.fillText(totalVariacao, centroX, centroY - 8);
  contexto.font = "13px Arial";
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
      <tr>
        <td>${material.nome}</td>
        <td>${material.categoria}</td>
        <td>${material.unidade}</td>
        <td>${material.quantidadeComprada}</td>
        <td>${formatarMoeda(material.valorTotal)}</td>
      </tr>
    `;
  }).join("");

  renderizarVisualizacaoGastos();
}

function textoSelecionado(select) {
  return select.options[select.selectedIndex]?.textContent || "-";
}

function baixarPdfConsumoMensal() {
  const dados = dadosRelatorioMensal().filter((material) => material.total > 0);
  const mes = textoSelecionado(controles.mesRelatorio);
  const ano = controles.anoRelatorio.value;
  const setor = textoSelecionado(controles.setorRelatorio);
  const totalItens = dados.reduce((sum, material) => sum + Number(material.total || 0), 0);
  const totalMateriais = dados.length;

  const pdf = new PdfReport({
    title: "Relatorio mensal de consumo",
    subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")} - Controle de materiais`
  });

  pdf.section("Filtros selecionados");
  pdf.keyValues([
    { label: "Mes", value: mes },
    { label: "Ano", value: ano },
    { label: "Departamento", value: setor || "Geral" },
    { label: "Materiais consumidos", value: totalMateriais },
    { label: "Total de itens consumidos", value: totalItens },
    { label: "Visualizacao da tela", value: textoSelecionado(controles.tipoVisualizacao) }
  ]);

  pdf.section("Consumo por material");
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

  const margem = 54;
  const larguraGrafico = canvas.width - margem * 2;
  const alturaGrafico = canvas.height - 100;
  const maiorValor = Math.max(...dadosComGasto.map((item) => item.valorTotal));
  const larguraBarra = larguraGrafico / dadosComGasto.length - 14;

  contexto.strokeStyle = "#d9dee7";
  contexto.beginPath();
  contexto.moveTo(margem, 28);
  contexto.lineTo(margem, alturaGrafico + 30);
  contexto.lineTo(canvas.width - margem, alturaGrafico + 30);
  contexto.stroke();

  dadosComGasto.forEach((item, index) => {
    const alturaBarra = (item.valorTotal / maiorValor) * alturaGrafico;
    const x = margem + index * (larguraBarra + 14) + 8;
    const y = alturaGrafico + 30 - alturaBarra;

    contexto.fillStyle = coresGrafico[index % coresGrafico.length];
    contexto.fillRect(x, y, larguraBarra, alturaBarra);

    contexto.fillStyle = "#0b3f55";
    contexto.textAlign = "center";
    contexto.fillText(formatarMoeda(item.valorTotal), x + larguraBarra / 2, y - 12);
    contexto.save();
    contexto.translate(x + larguraBarra / 2, alturaGrafico + 54);
    contexto.rotate(-0.45);
    contexto.fillText(item.nome, 0, 0);
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
  const raio = 120;

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

  contexto.fillStyle = "#ffffff";
  contexto.beginPath();
  contexto.arc(centroX, centroY, 54, 0, Math.PI * 2);
  contexto.fill();
  contexto.fillStyle = "#0b3f55";
  contexto.textAlign = "center";
  contexto.font = "700 16px Arial";
  contexto.fillText(formatarMoeda(totalGeral), centroX, centroY - 8);
  contexto.font = "13px Arial";
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
