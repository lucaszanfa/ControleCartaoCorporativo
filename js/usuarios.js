const usuariosTabela = document.getElementById("usuariosTabela");
const usuariosMensagem = document.getElementById("usuariosMensagem");

async function carregarUsuarios() {
  const resposta = await fetch("/api/usuarios");
  const usuarios = await resposta.json();

  usuariosTabela.innerHTML = usuarios.map((usuario) => {
    const permissoes = usuario.permissoes;

    return `
      <tr class="report-data-row" data-id="${usuario.id}">
        <td><strong>${usuario.nome}</strong></td>
        <td>${usuario.email}</td>
        <td>${usuario.setor}</td>
        <td>
          <select class="status-usuario">
            <option value="pendente" ${usuario.status === "pendente" ? "selected" : ""}>Pendente</option>
            <option value="ativo" ${usuario.status === "ativo" ? "selected" : ""}>Ativo</option>
            <option value="bloqueado" ${usuario.status === "bloqueado" ? "selected" : ""}>Bloqueado</option>
          </select>
        </td>
        <td><input class="perm-cadastrar" type="checkbox" ${permissoes.cadastrarMaterial ? "checked" : ""}></td>
        <td><input class="perm-saida" type="checkbox" ${permissoes.registrarSaida ? "checked" : ""}></td>
        <td><input class="perm-entrada" type="checkbox" ${permissoes.registrarEntrada ? "checked" : ""}></td>
        <td><input class="perm-relatorios" type="checkbox" ${permissoes.verRelatorios ? "checked" : ""}></td>
        <td><input class="perm-admin" type="checkbox" ${permissoes.administrarUsuarios ? "checked" : ""}></td>
        <td><button class="btn btn-primary salvar-permissoes" type="button">Salvar</button></td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".salvar-permissoes").forEach((botao) => {
    botao.addEventListener("click", salvarPermissoes);
  });
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
}

carregarUsuarios();
