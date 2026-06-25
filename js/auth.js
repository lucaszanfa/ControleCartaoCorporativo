let usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado") || "null");

function sincronizarUsuarioLogado() {
  if (!usuarioLogado?.email) return;

  try {
    const requisicao = new XMLHttpRequest();
    requisicao.open("GET", "/api/usuarios", false);
    requisicao.send();

    if (requisicao.status >= 200 && requisicao.status < 300) {
      const usuarios = JSON.parse(requisicao.responseText);
      const usuarioAtualizado = usuarios.find((usuario) => usuario.email.toLowerCase() === usuarioLogado.email.toLowerCase());

      if (usuarioAtualizado) {
        usuarioLogado = usuarioAtualizado;
        localStorage.setItem("usuarioLogado", JSON.stringify(usuarioAtualizado));
      }
    }
  } catch (error) {
    console.warn("Nao foi possivel sincronizar permissoes do usuario.", error);
  }
}

function sairSemAcesso() {
  window.location.href = "login.html";
}

function temPermissao(nome) {
  return Boolean(usuarioLogado?.permissoes?.[nome]);
}

function ehAdminOuGerente() {
  return usuarioLogado?.perfil === "admin" || usuarioLogado?.perfil === "gerente" || temPermissao("administrarUsuarios");
}

function criarLinkMenu(item, paginaAtual) {
  const ativo = item.href === paginaAtual ? " active" : "";
  const extraClass = item.adminOnly ? " admin-only" : "";
  return `<a class="${ativo}${extraClass}" href="${item.href}"><span>${item.label}</span></a>`;
}

function aplicarMenuPrincipal() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const paginaAtual = window.location.pathname.split("/").pop() || "dashboard.html";
  const podeVerCartoesGerenciais = ehAdminOuGerente();
  const materiais = [
    { href: "dashboard.html", label: "Visao geral" },
    { href: "materiais.html", label: "Cadastro de materiais" },
    { href: "estoque.html", label: "Estoque" },
    { href: "registrar-saida.html", label: "Registrar saida", permissao: "registrarSaida" },
    { href: "registrar-entrada.html", label: "Registrar entrada", permissao: "registrarEntrada" },
    { href: "historico.html", label: "Historico" },
    { href: "relatorios.html", label: "Relatorios", permissao: "verRelatorios" }
  ].filter((item) => !item.permissao || temPermissao(item.permissao));

  const cartoes = [
    { href: "compra-cartao.html", label: "Registrar compra" },
    { href: "compra-automatica.html", label: "Compra automatica" },
    { href: "compras-pendentes.html", label: "Compras pendentes" },
    ...(podeVerCartoesGerenciais ? [
      { href: "dashboard-cartoes.html", label: "Resumo dos cartoes" },
      { href: "cartoes.html", label: "Cartoes cadastrados" },
      { href: "faturas-cartao.html", label: "Faturas" },
      { href: "conciliacao-cartao.html", label: "Conciliacao" },
      { href: "relatorios-cartao.html", label: "Relatorios de cartao" }
    ] : [])
  ];

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <img class="sidebar-logo" src="img/sma_sistemas_eletricos_automacao_logo.png" alt="SM&A">
      <div>
        <strong>Controle Administrativo</strong>
        <small>Materiais e cartoes</small>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-group">
        <span class="nav-group-title">Materiais</span>
        ${materiais.map((item) => criarLinkMenu(item, paginaAtual)).join("")}
      </div>
      <div class="nav-group">
        <span class="nav-group-title">Cartoes corporativos</span>
        ${cartoes.map((item) => criarLinkMenu(item, paginaAtual)).join("")}
      </div>
      <div class="nav-group nav-group-system">
        <span class="nav-group-title">Sistema</span>
        ${criarLinkMenu({ href: "usuarios.html", label: "Usuarios", adminOnly: true }, paginaAtual)}
        <a class="logout-link" href="login.html"><span>Sair</span></a>
      </div>
    </nav>
  `;
}

function aplicarContextoVisual() {
  const paginaAtual = window.location.pathname.split("/").pop() || "dashboard.html";
  const paginasCartoes = [
    "dashboard-cartoes.html",
    "cartoes.html",
    "compra-cartao.html",
    "compra-automatica.html",
    "compras-pendentes.html",
    "faturas-cartao.html",
    "conciliacao-cartao.html",
    "alertas-cartao.html",
    "relatorios-cartao.html"
  ];
  const topbar = document.querySelector(".topbar");
  if (!topbar || topbar.querySelector(".module-switch")) return;

  const moduloCartao = paginasCartoes.includes(paginaAtual);
  const switcher = document.createElement("div");
  switcher.className = "module-switch";
  switcher.innerHTML = `
    <a class="${!moduloCartao ? "active" : ""}" href="dashboard.html">Materiais</a>
    <a class="${moduloCartao ? "active" : ""}" href="compra-cartao.html">Cartoes</a>
  `;
  topbar.appendChild(switcher);
}

function aplicarPermissoes() {
  sincronizarUsuarioLogado();

  if (!usuarioLogado) {
    sairSemAcesso();
    return;
  }

  if (usuarioLogado.status !== "ativo") {
    localStorage.removeItem("usuarioLogado");
    alert("Seu usuario nao esta ativo. Fale com o administrador.");
    sairSemAcesso();
    return;
  }

  aplicarMenuPrincipal();
  aplicarContextoVisual();

  document.querySelectorAll(".user-chip").forEach((chip) => {
    chip.textContent = usuarioLogado.nome;
  });

  document.querySelectorAll(".admin-only").forEach((elemento) => {
    elemento.classList.toggle("hidden", !temPermissao("administrarUsuarios"));
  });

  const pagina = window.location.pathname.split("/").pop();
  const regras = {
    "registrar-saida.html": "registrarSaida",
    "registrar-entrada.html": "registrarEntrada",
    "relatorios.html": "verRelatorios",
    "usuarios.html": "administrarUsuarios"
  };
  const permissaoNecessaria = regras[pagina];

  if (permissaoNecessaria && !temPermissao(permissaoNecessaria)) {
    alert("Seu usuario nao tem permissao para acessar esta pagina.");
    window.location.href = "dashboard.html";
    return;
  }

  const paginasCartaoGerenciais = [
    "dashboard-cartoes.html",
    "cartoes.html",
    "faturas-cartao.html",
    "conciliacao-cartao.html",
    "alertas-cartao.html",
    "relatorios-cartao.html"
  ];

  if (paginasCartaoGerenciais.includes(pagina) && !ehAdminOuGerente()) {
    alert("Seu usuario nao tem permissao para acessar esta pagina do modulo de cartoes.");
    window.location.href = "compra-cartao.html";
  }
}

aplicarPermissoes();
