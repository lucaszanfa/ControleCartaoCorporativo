const filtroNome = document.getElementById("filtroNome");
const filtroCategoria = document.getElementById("filtroCategoria");
const materiaisTabela = document.getElementById("materiaisTabela");
const novoMaterialBtn = document.getElementById("novoMaterialBtn");
const materialFormCard = document.getElementById("materialFormCard");
const materialFormTitulo = document.getElementById("materialFormTitulo");
const materialForm = document.getElementById("materialForm");
const materialMensagem = document.getElementById("materialMensagem");
const cancelarMaterialBtn = document.getElementById("cancelarMaterialBtn");
const podeGerenciarMateriais = temPermissao("cadastrarMaterial");

function preencherCategorias() {
  const categorias = [...new Set(materiais.map((material) => material.categoria))].sort();

  filtroCategoria.innerHTML = `<option value="">Todas</option>`;
  filtroCategoria.innerHTML += categorias.map((categoria) => {
    return `<option value="${categoria}">${categoria}</option>`;
  }).join("");
}

function abrirFormulario(material = null) {
  materialForm.reset();
  document.getElementById("materialId").value = material?.id || "";
  document.getElementById("materialNome").value = material?.nome || "";
  document.getElementById("materialCategoria").value = material?.categoria || "";
  document.getElementById("materialUnidade").value = material?.unidade || "";
  document.getElementById("materialUnidadesPorCaixa").value = material?.unidadesPorCaixa || 1;
  document.getElementById("materialEstoqueMinimo").value = material?.estoqueMinimo || 0;
  materialFormTitulo.textContent = material ? "Editar material" : "Novo material";
  materialFormCard.classList.remove("hidden");
  materialMensagem.classList.add("hidden");
}

function fecharFormulario() {
  materialForm.reset();
  materialFormCard.classList.add("hidden");
}

function renderizarMateriais() {
  const nome = filtroNome.value.toLowerCase();
  const categoria = filtroCategoria.value;

  const materiaisFiltrados = materiais.filter((material) => {
    const correspondeNome = material.nome.toLowerCase().includes(nome);
    const correspondeCategoria = !categoria || material.categoria === categoria;
    return correspondeNome && correspondeCategoria;
  });

  materiaisTabela.innerHTML = materiaisFiltrados.map((material) => {
    const textoStatus = material.ativo ? "Ativo" : "Inativo";
    const textoBotaoStatus = material.ativo ? "Desativar" : "Ativar";

    return `
      <tr class="report-data-row ${material.ativo ? "" : "row-inactive"}">
        <td><strong>${material.nome}</strong></td>
        <td>${material.categoria}</td>
        <td><span class="report-number-pill">${material.unidade}</span></td>
        <td>${Number(material.unidadesPorCaixa || 1) > 1 ? `${material.unidadesPorCaixa} ${material.unidade}` : "Não configurado"}</td>
        <td><span class="report-number-pill">${Number(material.estoqueMinimo || 0)} ${material.unidade}</span></td>
        <td><span class="status ${material.ativo ? "status-ok" : "status-pending"}">${textoStatus}</span></td>
        <td>
          ${podeGerenciarMateriais ? `
            <div class="actions">
              <button class="btn btn-secondary editar-material" data-id="${material.id}" type="button">Editar</button>
              <button class="btn btn-danger alternar-material" data-id="${material.id}" type="button">${textoBotaoStatus}</button>
            </div>
          ` : `<span class="empty-state">Somente consulta</span>`}
        </td>
      </tr>
    `;
  }).join("");

  if (!materiaisFiltrados.length) {
    materiaisTabela.innerHTML = `<tr><td class="empty-state" colspan="7">Nenhum material encontrado.</td></tr>`;
  }

  document.querySelectorAll(".editar-material").forEach((botao) => {
    botao.addEventListener("click", () => {
      const material = materiais.find((item) => item.id === Number(botao.dataset.id));
      abrirFormulario(material);
    });
  });

  document.querySelectorAll(".alternar-material").forEach((botao) => {
    botao.addEventListener("click", () => alternarStatusMaterial(Number(botao.dataset.id)));
  });
}

async function salvarMaterial(event) {
  event.preventDefault();

  const id = document.getElementById("materialId").value;
  const material = {
    nome: document.getElementById("materialNome").value,
    categoria: document.getElementById("materialCategoria").value,
    unidade: document.getElementById("materialUnidade").value,
    unidadesPorCaixa: Number(document.getElementById("materialUnidadesPorCaixa").value) || 1,
    estoqueMinimo: Number(document.getElementById("materialEstoqueMinimo").value) || 0
  };
  const url = id ? `/api/materiais/${id}` : "/api/materiais";
  const method = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(material)
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    materialMensagem.textContent = dados.erro || "Erro ao salvar material.";
    materialMensagem.classList.remove("hidden");
    return;
  }

  if (id) {
    const index = materiais.findIndex((item) => item.id === Number(id));
    materiais[index] = { ...materiais[index], ...material };
  } else {
    materiais.push({ id: dados.id, ...material, ativo: true });
  }

  materialMensagem.textContent = id ? "Material atualizado com sucesso." : "Material cadastrado com sucesso.";
  materialMensagem.classList.remove("hidden");
  preencherCategorias();
  renderizarMateriais();
  setTimeout(fecharFormulario, 700);
}

async function alternarStatusMaterial(id) {
  const material = materiais.find((item) => item.id === id);
  const novoStatus = !material.ativo;
  const resposta = await fetch(`/api/materiais/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo: novoStatus })
  });

  if (resposta.ok) {
    material.ativo = novoStatus;
    renderizarMateriais();
  }
}

if (!podeGerenciarMateriais) {
  novoMaterialBtn.classList.add("hidden");
}

novoMaterialBtn.addEventListener("click", () => abrirFormulario());
cancelarMaterialBtn.addEventListener("click", fecharFormulario);
materialForm.addEventListener("submit", salvarMaterial);
preencherCategorias();
renderizarMateriais();
filtroNome.addEventListener("input", renderizarMateriais);
filtroCategoria.addEventListener("change", renderizarMateriais);
