const usuariosTabela = document.getElementById("usuariosTabela");
const usuariosMensagem = document.getElementById("usuariosMensagem");
const usuariosBusca = document.getElementById("usuariosBusca");
const usuariosSetorFiltro = document.getElementById("usuariosSetorFiltro");
const usuariosStatusFiltro = document.getElementById("usuariosStatusFiltro");
const usuariosLimparFiltros = document.getElementById("usuariosLimparFiltros");
const usuariosContagem = document.getElementById("usuariosContagem");

let usuariosCache = [];

function textoSeguro(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obterIniciais(nome) {
  return String(nome || "Usuário")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

function permissaoPersonalizada(usuario) {
  const permissoes = usuario.permissoes || {};
  return Object.values(permissoes).some(Boolean);
}

function atualizarResumo(usuarios) {
  const setores = new Set(usuarios.map((usuario) => usuario.setor).filter(Boolean));
  const ativos = usuarios.filter((usuario) => usuario.status === "ativo").length;
  const admins = usuarios.filter((usuario) => usuario.permissoes?.administrarUsuarios || usuario.perfil === "admin").length;
  const personalizados = usuarios.filter(permissaoPersonalizada).length;

  document.getElementById("usuariosAtivosResumo").textContent = ativos;
  document.getElementById("usuariosTotalResumo").textContent = `de ${usuarios.length} usuários`;
  document.getElementById("usuariosAdminsResumo").textContent = admins;
  document.getElementById("usuariosSetoresResumo").textContent = setores.size;
  document.getElementById("usuariosPermissoesResumo").textContent = personalizados;
}

function preencherFiltroSetores(usuarios) {
  const valorAtual = usuariosSetorFiltro.value;
  const setores = [...new Set(usuarios.map((usuario) => usuario.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  usuariosSetorFiltro.innerHTML = `
    <option value="">Todos os setores</option>
    ${setores.map((setor) => `<option value="${textoSeguro(setor)}">${textoSeguro(setor)}</option>`).join("")}
  `;
  usuariosSetorFiltro.value = setores.includes(valorAtual) ? valorAtual : "";
}

function usuariosFiltrados() {
  const termo = usuariosBusca.value.trim().toLowerCase();
  const setor = usuariosSetorFiltro.value;
  const status = usuariosStatusFiltro.value;

  return usuariosCache.filter((usuario) => {
    const textoBusca = `${usuario.nome || ""} ${usuario.email || ""}`.toLowerCase();
    const passaBusca = !termo || textoBusca.includes(termo);
    const passaSetor = !setor || usuario.setor === setor;
    const passaStatus = !status || usuario.status === status;
    return passaBusca && passaSetor && passaStatus;
  });
}

function classeAvatar(index) {
  return `users-avatar tone-${(index % 6) + 1}`;
}

function renderizarUsuarios() {
  const usuarios = usuariosFiltrados();

  usuariosTabela.innerHTML = usuarios.map((usuario, index) => {
    const permissoes = usuario.permissoes || {};
    const status = usuario.status || "pendente";

    return `
      <tr class="users-row" data-id="${usuario.id}">
        <td>
          <div class="users-person">
            <span class="${classeAvatar(index)}">${textoSeguro(obterIniciais(usuario.nome))}</span>
            <strong>${textoSeguro(usuario.nome)}</strong>
          </div>
        </td>
        <td>${textoSeguro(usuario.email)}</td>
        <td>${textoSeguro(usuario.setor || "-")}</td>
        <td>
          <select class="status-usuario status-select status-${textoSeguro(status)}">
            <option value="pendente" ${status === "pendente" ? "selected" : ""}>Pendente</option>
            <option value="ativo" ${status === "ativo" ? "selected" : ""}>Ativo</option>
            <option value="bloqueado" ${status === "bloqueado" ? "selected" : ""}>Bloqueado</option>
          </select>
        </td>
        <td>${criarToggle("perm-cadastrar", permissoes.cadastrarMaterial)}</td>
        <td>${criarToggle("perm-saida", permissoes.registrarSaida)}</td>
        <td>${criarToggle("perm-entrada", permissoes.registrarEntrada)}</td>
        <td>${criarToggle("perm-relatorios", permissoes.verRelatorios)}</td>
        <td>${criarToggle("perm-admin", permissoes.administrarUsuarios)}</td>
        <td>
          <div class="users-actions">
            <button class="btn btn-primary salvar-permissoes" type="button">Salvar</button>
            <button class="btn btn-secondary users-more" type="button" aria-label="Mais opções">...</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  usuariosContagem.textContent = `Mostrando ${usuarios.length} de ${usuariosCache.length} usuários`;

  document.querySelectorAll(".salvar-permissoes").forEach((botao) => {
    botao.addEventListener("click", salvarPermissoes);
  });
}

function criarToggle(classe, ativo) {
  return `
    <label class="permission-toggle">
      <input class="${classe}" type="checkbox" ${ativo ? "checked" : ""}>
      <span></span>
    </label>
  `;
}

async function carregarUsuarios() {
  const resposta = await fetch("/api/usuarios");
  usuariosCache = await resposta.json();

  atualizarResumo(usuariosCache);
  preencherFiltroSetores(usuariosCache);
  renderizarUsuarios();
}

async function salvarPermissoes(event) {
  const linha = event.target.closest("tr");
  const id = linha.dataset.id;
  const payload = {
    status: linha.querySelector(".status-usuario").value,
    permissoes: {
      cadastrarMaterial: linha.querySelector(".perm-cadastrar").checked,
      registrarSaida: linha.querySelector(".perm-saida").checked,
      registrarEntrada: linha.querySelector(".perm-entrada").checked,
      verRelatorios: linha.querySelector(".perm-relatorios").checked,
      administrarUsuarios: linha.querySelector(".perm-admin").checked
    }
  };

  const resposta = await fetch(`/api/usuarios/${id}/permissoes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const dados = await resposta.json();

  usuariosMensagem.textContent = dados.mensagem || dados.erro || "Permissões atualizadas.";
  usuariosMensagem.classList.remove("hidden");
  await carregarUsuarios();
}

[usuariosBusca, usuariosSetorFiltro, usuariosStatusFiltro].forEach((controle) => {
  controle.addEventListener("input", renderizarUsuarios);
  controle.addEventListener("change", renderizarUsuarios);
});

usuariosLimparFiltros.addEventListener("click", () => {
  usuariosBusca.value = "";
  usuariosSetorFiltro.value = "";
  usuariosStatusFiltro.value = "";
  renderizarUsuarios();
});

carregarUsuarios();
