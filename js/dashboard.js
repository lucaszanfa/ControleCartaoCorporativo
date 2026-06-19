const mesAtual = "2026-06";
const saidasDoMes = saidas.filter((saida) => saida.data.startsWith(mesAtual));

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
  const ultimasSaidas = [...saidas].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);

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

preencherDashboard();
renderizarUltimasSaidas();
