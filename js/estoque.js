const estoqueTabela = document.getElementById("estoqueTabela");
const filtroEstoqueNome = document.getElementById("filtroEstoqueNome");
const filtroEstoqueCategoria = document.getElementById("filtroEstoqueCategoria");
const estoqueAtualizadoEm = document.getElementById("estoqueAtualizadoEm");
const atualizarEstoqueBtn = document.getElementById("atualizarEstoqueBtn");

function somaMovimentacoes(lista, materialId) {
  return lista
    .filter((item) => Number(item.materialId) === Number(materialId))
    .reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

function estoquePorMaterial() {
  return materiais.map((material) => {
    const totalEntradas = somaMovimentacoes(entradas, material.id);
    const totalSaidas = somaMovimentacoes(saidas, material.id);
    const disponivel = totalEntradas - totalSaidas;
    const unidadesPorCaixa = Number(material.unidadesPorCaixa || 1);

    return {
      ...material,
      totalEntradas,
      totalSaidas,
      disponivel,
      unidadesPorCaixa
    };
  });
}

function caixasEquivalentes(item) {
  if (!item.unidadesPorCaixa || item.unidadesPorCaixa <= 1) return "-";
  const caixas = Math.floor(item.disponivel / item.unidadesPorCaixa);
  const sobra = item.disponivel % item.unidadesPorCaixa;
  return `${caixas} caixa(s)${sobra ? ` + ${sobra} ${item.unidade}` : ""}`;
}

function preencherCategoriasEstoque() {
  const categoriaAtual = filtroEstoqueCategoria.value;
  const categorias = [...new Set(materiais.map((material) => material.categoria))].sort();
  filtroEstoqueCategoria.innerHTML = `<option value="">Todas</option>`;
  filtroEstoqueCategoria.innerHTML += categorias.map((categoria) => `<option value="${categoria}">${categoria}</option>`).join("");
  filtroEstoqueCategoria.value = categoriaAtual;
}

function renderizarResumoEstoque(itens) {
  const ativos = itens.filter((item) => item.ativo);
  document.getElementById("totalMateriaisAtivos").textContent = ativos.length;
  document.getElementById("totalUnidadesDisponiveis").textContent = ativos.reduce((total, item) => total + item.disponivel, 0);
  document.getElementById("totalMateriaisZerados").textContent = ativos.filter((item) => item.disponivel <= 0).length;
}

function renderizarEstoque() {
  const nome = filtroEstoqueNome.value.toLowerCase();
  const categoria = filtroEstoqueCategoria.value;
  const itens = estoquePorMaterial();
  const filtrados = itens.filter((item) => {
    const correspondeNome = item.nome.toLowerCase().includes(nome);
    const correspondeCategoria = !categoria || item.categoria === categoria;
    return correspondeNome && correspondeCategoria;
  });

  renderizarResumoEstoque(itens);

  estoqueTabela.innerHTML = filtrados.map((item) => `
    <tr class="report-data-row ${item.ativo ? "" : "row-inactive"}">
      <td><strong>${item.nome}</strong></td>
      <td>${item.categoria}</td>
      <td><span class="report-number-pill">${item.totalEntradas} ${item.unidade}</span></td>
      <td><span class="report-number-pill">${item.totalSaidas} ${item.unidade}</span></td>
      <td><span class="${item.disponivel > 0 ? "status status-ok" : "status status-pending"}">${item.disponivel} ${item.unidade}</span></td>
      <td>${caixasEquivalentes(item)}</td>
    </tr>
  `).join("");

  if (!filtrados.length) {
    estoqueTabela.innerHTML = `<tr><td class="empty-state" colspan="6">Nenhum material encontrado.</td></tr>`;
  }
}

async function recarregarEstoque() {
  try {
    const resposta = await fetch("/api/bootstrap");
    if (!resposta.ok) throw new Error("Erro ao carregar estoque.");
    const dados = await resposta.json();
    materiais = dados.materiais || materiais;
    entradas = dados.entradas || entradas;
    saidas = dados.saidas || saidas;
    preencherCategoriasEstoque();
    renderizarEstoque();
    estoqueAtualizadoEm.textContent = `Atualizado em ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch (error) {
    estoqueAtualizadoEm.textContent = "Não foi possível atualizar o estoque agora.";
    console.error(error);
  }
}

filtroEstoqueNome.addEventListener("input", renderizarEstoque);
filtroEstoqueCategoria.addEventListener("change", renderizarEstoque);
atualizarEstoqueBtn.addEventListener("click", recarregarEstoque);

preencherCategoriasEstoque();
renderizarEstoque();
recarregarEstoque();
setInterval(recarregarEstoque, 15000);
