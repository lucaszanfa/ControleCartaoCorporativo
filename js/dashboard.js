const mesAtual = "2026-06";
const saidasDoMes = saidas.filter((saida) => saida.data.startsWith(mesAtual));
const dashboardSearch = document.getElementById("dashboardSearch");

function somarPorCampo(lista, campo) {
  return lista.reduce((acumulador, item) => {
    const chave = item[campo];
    acumulador[chave] = (acumulador[chave] || 0) + item.quantidade;
    return acumulador;
  }, {});
}

function obterMaiorChave(objeto) {
  return Object.entries(objeto).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function preencherDashboard() {
  const totalItens = saidasDoMes.reduce((total, saida) => total + saida.quantidade, 0);
  const materialIdMaisRetirado = obterMaiorChave(somarPorCampo(saidasDoMes, "materialId"));
  const materialMaisRetirado = buscarMaterial(materialIdMaisRetirado)?.nome || "-";
  const setorMaisConsumiu = obterMaiorChave(somarPorCampo(saidasDoMes, "setor"));

  document.getElementById("totalSaidasMes").textContent = saidasDoMes.length;
  document.getElementById("materialMaisRetirado").textContent = materialMaisRetirado;
  document.getElementById("setorMaisConsumiu").textContent = setorMaisConsumiu;
  document.getElementById("totalItensRetirados").textContent = totalItens;
}

function renderizarUltimasSaidas() {
  const tbody = document.getElementById("ultimasSaidasTabela");
  const termo = (dashboardSearch?.value || "").toLowerCase();
  const ultimasSaidas = [...saidas]
    .filter((saida) => {
      const material = buscarMaterial(saida.materialId);
      const texto = [
        material?.nome,
        saida.setor,
        saida.responsavel,
        saida.localUso,
        saida.motivo
      ].join(" ").toLowerCase();
      return !termo || texto.includes(termo);
    })
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 6);

  if (!ultimasSaidas.length) {
    tbody.innerHTML = `<tr><td class="empty-state" colspan="5">Nenhuma saída encontrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = ultimasSaidas.map((saida) => {
    const material = buscarMaterial(saida.materialId);

    return `
      <tr class="report-data-row">
        <td><strong>${formatarData(saida.data)}</strong></td>
        <td><strong>${material.nome}</strong></td>
        <td><span class="report-number-pill">${saida.quantidade} ${material.unidade}</span></td>
        <td>${saida.setor}</td>
        <td>${saida.responsavel}</td>
      </tr>
    `;
  }).join("");
}

function renderizarConsumoPorSetor() {
  const legenda = document.getElementById("dashboardSetoresLegenda");
  const total = saidasDoMes.reduce((soma, saida) => soma + Number(saida.quantidade || 0), 0);
  const porSetor = Object.entries(somarPorCampo(saidasDoMes, "setor"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const cores = ["var(--brand)", "var(--blue-accent)", "var(--orange-accent)", "var(--purple-accent)"];

  document.getElementById("dashboardDonutTotal").textContent = total;
  legenda.innerHTML = porSetor.map(([setor, quantidade], index) => {
    const percentual = total ? ((quantidade / total) * 100).toFixed(1).replace(".", ",") : "0,0";
    return `
      <div>
        <span class="legend-dot" style="background: ${cores[index]}"></span>
        <span>${setor}</span>
        <strong>${quantidade} (${percentual}%)</strong>
      </div>
    `;
  }).join("");
}

preencherDashboard();
renderizarUltimasSaidas();
renderizarConsumoPorSetor();
dashboardSearch?.addEventListener("input", renderizarUltimasSaidas);
