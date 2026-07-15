const loginForm = document.getElementById("loginForm");
const loginMensagem = document.getElementById("loginMensagem");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  try {
    const resposta = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const dados = await resposta.json();

    if (resposta.status === 404 && dados.precisaCadastro) {
      loginMensagem.textContent = "Usuário não encontrado. Faça o cadastro para solicitar acesso.";
      loginMensagem.classList.remove("hidden");
      setTimeout(() => {
        window.location.href = `cadastro-usuario.html?email=${encodeURIComponent(email)}`;
      }, 1200);
      return;
    }

    if (!resposta.ok) {
      loginMensagem.textContent = dados.erro || "Não foi possível entrar.";
      loginMensagem.classList.remove("hidden");
      return;
    }

    localStorage.setItem("usuarioLogado", JSON.stringify(dados));
    window.location.href = "dashboard-cartoes.html";
  } catch (error) {
    loginMensagem.textContent = "Servidor indisponível. Verifique se o sistema está rodando na porta 3010.";
    loginMensagem.classList.remove("hidden");
    console.error(error);
  }
});
