const estoqueTabela = document.getElementById("estoqueTabela");
const filtroEstoqueNome = document.getElementById("filtroEstoqueNome");
const filtroEstoqueCategoria = document.getElementById("filtroEstoqueCategoria");
const filtroEstoqueSituacao = document.getElementById("filtroEstoqueSituacao");
const estoqueAtualizadoEm = document.getElementById("estoqueAtualizadoEm");
const atualizarEstoqueBtn = document.getElementById("atualizarEstoqueBtn");
const estoqueCriticoLista = document.getElementById("estoqueCriticoLista");

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
    const estoqueMinimo = Number(material.estoqueMinimo || 0);

    return {
      ...material,
      totalEntradas,
      totalSaidas,
      disponivel,
      unidadesPorCaixa,
      estoqueMinimo
    };
  });
}

function situacaoEstoque(item) {
  if (item.disponivel <= 0) {
    return { valor: "zerado", texto: "Zerado", classe: "status-pending" };
  }
  if (item.estoqueMinimo > 0 && item.disponivel <= item.estoqueMinimo) {
    return { valor: "baixo", texto: "Baixo estoque", classe: "status-warning" };
  }
  return { valor: "ok", texto: "OK", classe: "status-ok" };
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
  document.getElementById("totalMateriaisBaixoEstoque").textContent = ativos.filter((item) => situacaoEstoque(item).valor === "baixo").length;
}

function renderizarEstoqueCritico(itens) {
  if (!estoqueCriticoLista) return;

  const criticos = itens
    .filter((item) => item.ativo && ["zerado", "baixo"].includes(situacaoEstoque(item).valor))
    .sort((a, b) => a.disponivel - b.disponivel)
    .slice(0, 4);

  if (!criticos.length) {
    estoqueCriticoLista.innerHTML = `
      <div class="stock-alert-empty">
        <strong>Estoque saudável</strong>
        <span>Nenhum material abaixo do mínimo agora.</span>
      </div>
    `;
    return;
  }

  estoqueCriticoLista.innerHTML = criticos.map((item) => {
    const situacao = situacaoEstoque(item);
    const falta = Math.max(item.estoqueMinimo - item.disponivel, 0);
    return `
      <article class="stock-alert-item ${situacao.valor}">
        <span class="status ${situacao.classe}">${situacao.texto}</span>
        <strong>${item.nome}</strong>
        <small>${item.disponivel} ${item.unidade} disponivel | minimo ${item.estoqueMinimo}</small>
        <em>Repor ${falta} ${item.unidade}</em>
      </article>
    `;
  }).join("");
}

function renderizarEstoque() {
  const nome = filtroEstoqueNome.value.toLowerCase();
  const categoria = filtroEstoqueCategoria.value;
  const situacao = filtroEstoqueSituacao.value;
  const itens = estoquePorMaterial();
  const filtrados = itens.filter((item) => {
    const correspondeNome = item.nome.toLowerCase().includes(nome);
    const correspondeCategoria = !categoria || item.categoria === categoria;
    const correspondeSituacao = !situacao || situacaoEstoque(item).valor === situacao;
    return correspondeNome && correspondeCategoria && correspondeSituacao;
  });

  renderizarResumoEstoque(itens);
  renderizarEstoqueCritico(itens);

  estoqueTabela.innerHTML = filtrados.map((item) => {
    const situacao = situacaoEstoque(item);
    return `
      <tr class="report-data-row ${item.ativo ? "" : "row-inactive"}">
        <td><strong>${item.nome}</strong></td>
        <td>${item.categoria}</td>
        <td><span class="report-number-pill">${item.totalEntradas} ${item.unidade}</span></td>
        <td><span class="report-number-pill">${item.totalSaidas} ${item.unidade}</span></td>
        <td><span class="status ${situacao.classe}">${item.disponivel} ${item.unidade}</span></td>
        <td><span class="report-number-pill">${item.estoqueMinimo} ${item.unidade}</span></td>
        <td><span class="status ${situacao.classe}">${situacao.texto}</span></td>
        <td>${caixasEquivalentes(item)}</td>
      </tr>
    `;
  }).join("");

  if (!filtrados.length) {
    estoqueTabela.innerHTML = `<tr><td class="empty-state" colspan="8">Nenhum material encontrado.</td></tr>`;
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
filtroEstoqueSituacao.addEventListener("change", renderizarEstoque);
atualizarEstoqueBtn.addEventListener("click", recarregarEstoque);

preencherCategoriasEstoque();
renderizarEstoque();
recarregarEstoque();
setInterval(recarregarEstoque, 15000);
