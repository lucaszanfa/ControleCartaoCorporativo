const cadastroForm = document.getElementById("cadastroUsuarioForm");
const cadastroMensagem = document.getElementById("cadastroMensagem");
const setorSelectCadastro = document.getElementById("setor");
const params = new URLSearchParams(window.location.search);

async function carregarDepartamentosCadastro() {
  const botaoEnviar = cadastroForm.querySelector('button[type="submit"]');
  try {
    const departamentos = await (await fetch("/api/setores-detalhados")).json();
    setorSelectCadastro.innerHTML = departamentos.map((departamento) => `<option value="${departamento.nome}">${departamento.nome}</option>`).join("");
  } catch (error) {
    cadastroMensagem.textContent = "Não foi possível carregar a lista de departamentos. Recarregue a página antes de continuar.";
    cadastroMensagem.classList.remove("hidden");
    setorSelectCadastro.disabled = true;
    if (botaoEnviar) botaoEnviar.disabled = true;
  }
}

carregarDepartamentosCadastro();
document.getElementById("email").value = params.get("email") || "";

cadastroForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const usuario = {
    nome: document.getElementById("nome").value,
    email: document.getElementById("email").value,
    senha: document.getElementById("senha").value,
    setor: setorSelectCadastro.value
  };

  try {
    const resposta = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(usuario)
    });
    const dados = await resposta.json();

    cadastroMensagem.textContent = dados.mensagem || dados.erro || "Solicitação enviada.";
    cadastroMensagem.classList.remove("hidden");

    if (resposta.ok) {
      cadastroForm.reset();
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1800);
    }
  } catch (error) {
    cadastroMensagem.textContent = "Não foi possível cadastrar. Verifique se o servidor está rodando.";
    cadastroMensagem.classList.remove("hidden");
    console.error(error);
  }
});
