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
  const icon = item.icon || "•";
  return `<a class="${ativo}${extraClass}" href="${item.href}"><span class="nav-icon">${icon}</span><span>${item.label}</span></a>`;
}

function aplicarTemaSalvo() {
  const tema = localStorage.getItem("temaSistema") || "light";
  document.documentElement.dataset.theme = tema === "dark" ? "dark" : "light";
}

function alternarTema() {
  const temaAtual = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const novoTema = temaAtual === "dark" ? "light" : "dark";
  localStorage.setItem("temaSistema", novoTema);
  aplicarTemaSalvo();
  atualizarBotaoTema();
}

function atualizarBotaoTema() {
  const botao = document.getElementById("themeToggle");
  if (!botao) return;
  const temaEscuro = document.documentElement.dataset.theme === "dark";
  const iconeSol = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
    </svg>
  `;
  const iconeLua = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>
    </svg>
  `;
  botao.innerHTML = `
    <span class="theme-icon" aria-hidden="true">${temaEscuro ? iconeSol : iconeLua}</span>
    <span class="theme-label">${temaEscuro ? "Modo claro" : "Modo escuro"}</span>
  `;
  botao.setAttribute("aria-label", temaEscuro ? "Ativar modo claro" : "Ativar modo escuro");
  botao.setAttribute("title", temaEscuro ? "Ativar modo claro" : "Ativar modo escuro");
}

function aplicarMenuPrincipal() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const paginaAtual = window.location.pathname.split("/").pop() || "dashboard.html";
  const podeVerCartoesGerenciais = ehAdminOuGerente();
  const materiais = [
    { href: "dashboard.html", label: "Visao geral", icon: "⌂" },
    { href: "materiais.html", label: "Cadastro de materiais", icon: "□" },
    { href: "estoque.html", label: "Estoque", icon: "▤" },
    { href: "registrar-saida.html", label: "Registrar saida", icon: "↗", permissao: "registrarSaida" },
    { href: "registrar-entrada.html", label: "Registrar entrada", icon: "↓", permissao: "registrarEntrada" },
    { href: "historico.html", label: "Historico", icon: "◷" },
    { href: "relatorios.html", label: "Relatorios", icon: "▥", permissao: "verRelatorios" }
  ].filter((item) => !item.permissao || temPermissao(item.permissao));

  const cartoes = [
    { href: "compra-cartao.html", label: "Registrar compra", icon: "▣" },
    { href: "compra-automatica.html", label: "Compra automatica", icon: "◎" },
    { href: "compras-pendentes.html", label: "Compras pendentes", icon: "!" },
    ...(podeVerCartoesGerenciais ? [
      { href: "dashboard-cartoes.html", label: "Resumo dos cartoes", icon: "▦" },
      { href: "cartoes.html", label: "Cartoes cadastrados", icon: "▭" },
      { href: "faturas-cartao.html", label: "Faturas", icon: "$" },
      { href: "conciliacao-cartao.html", label: "Conciliacao", icon: "✓" },
      { href: "relatorios-cartao.html", label: "Relatorios de cartao", icon: "▥" }
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
        ${criarLinkMenu({ href: "usuarios.html", label: "Usuarios", icon: "⚙", adminOnly: true }, paginaAtual)}
        <a class="logout-link" href="login.html"><span class="nav-icon">←</span><span>Sair</span></a>
      </div>
    </nav>
  `;
}

function iniciaisUsuario() {
  const nome = usuarioLogado?.nome || "Usuario";
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

function navIconModerno(tipo) {
  const icones = {
    dashboard: '<path d="M4 13.5 12 6l8 7.5"></path><path d="M6.5 12.5V20h11v-7.5"></path><path d="M10 20v-5h4v5"></path>',
    cadastro: '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h4"></path>',
    estoque: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"></path><path d="m4 7.5 8 4.5 8-4.5M12 12v9"></path>',
    saida: '<path d="M7 17 17 7"></path><path d="M9 7h8v8"></path>',
    entrada: '<path d="M12 4v14"></path><path d="m6 12 6 6 6-6"></path>',
    historico: '<circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path>',
    relatorios: '<path d="M5 20V10"></path><path d="M12 20V4"></path><path d="M19 20v-7"></path>',
    compra: '<rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h4"></path>',
    automatica: '<path d="M20 12a8 8 0 0 1-13.66 5.66"></path><path d="M4 12A8 8 0 0 1 17.66 6.34"></path><path d="M17 3v4h4"></path><path d="M7 21v-4H3"></path>',
    pendentes: '<rect x="6" y="4" width="12" height="16" rx="2"></rect><path d="M9 8h6M9 12h6M9 16h3"></path>',
    resumo: '<path d="M4 19V5"></path><path d="M4 19h16"></path><path d="M8 15l3-3 3 2 4-6"></path>',
    cartoes: '<rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M7 14h5"></path>',
    faturas: '<path d="M7 3h8l4 4v14H7z"></path><path d="M15 3v5h5"></path><path d="M9 13h6M9 17h4"></path>',
    conciliacao: '<circle cx="12" cy="12" r="8"></circle><path d="m8.5 12.5 2.3 2.3 4.9-5.2"></path>',
    usuarios: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path>',
    suporte: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><path d="M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2v1Z"></path><path d="M20 14a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2v1Z"></path><path d="M14 20h-2a3 3 0 0 1-3-3"></path>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icones[tipo] || icones.dashboard}</svg>`;
}

function criarLinkMenuModerno(item, paginaAtual) {
  const ativo = item.href === paginaAtual ? " active" : "";
  const extraClass = item.adminOnly ? " admin-only" : "";
  return `<a class="${ativo}${extraClass}" href="${item.href}"><span class="nav-icon">${navIconModerno(item.icon)}</span><span class="nav-label">${item.label}</span><span class="nav-arrow">›</span></a>`;
}

function atualizarBotaoMenuLateral() {
  const botao = document.querySelector(".sidebar-menu-button");
  if (!botao) return;
  const recolhido = document.body.classList.contains("sidebar-collapsed");
  botao.setAttribute("aria-expanded", String(!recolhido));
  botao.setAttribute("title", recolhido ? "Abrir menu" : "Recolher menu");
  botao.setAttribute("aria-label", recolhido ? "Abrir menu lateral" : "Recolher menu lateral");
}

function aplicarEstadoMenuLateral() {
  const recolhido = localStorage.getItem("sidebarRecolhida") === "true";
  document.body.classList.toggle("sidebar-collapsed", recolhido);
  atualizarBotaoMenuLateral();
}

function alternarMenuLateral() {
  const recolhido = !document.body.classList.contains("sidebar-collapsed");
  document.body.classList.toggle("sidebar-collapsed", recolhido);
  localStorage.setItem("sidebarRecolhida", String(recolhido));
  atualizarBotaoMenuLateral();
}

function aplicarMenuPrincipal() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const paginaAtual = window.location.pathname.split("/").pop() || "dashboard.html";
  const podeVerCartoesGerenciais = ehAdminOuGerente();
  const materiais = [
    { href: "dashboard.html", label: "Visão geral", icon: "dashboard" },
    { href: "materiais.html", label: "Cadastro de materiais", icon: "cadastro" },
    { href: "estoque.html", label: "Estoque", icon: "estoque" },
    { href: "registrar-saida.html", label: "Registrar saída", icon: "saida", permissao: "registrarSaida" },
    { href: "registrar-entrada.html", label: "Registrar entrada", icon: "entrada", permissao: "registrarEntrada" },
    { href: "historico.html", label: "Histórico", icon: "historico" },
    { href: "relatorios.html", label: "Relatórios", icon: "relatorios", permissao: "verRelatorios" }
  ].filter((item) => !item.permissao || temPermissao(item.permissao));

  const cartoes = [
    { href: "compra-cartao.html", label: "Registrar compra", icon: "compra" },
    { href: "compra-automatica.html", label: "Compra automática", icon: "automatica" },
    { href: "compras-pendentes.html", label: "Compras pendentes", icon: "pendentes" },
    ...(podeVerCartoesGerenciais ? [
      { href: "dashboard-cartoes.html", label: "Resumo dos cartões", icon: "resumo" },
      { href: "cartoes.html", label: "Cartões cadastrados", icon: "cartoes" },
      { href: "faturas-cartao.html", label: "Faturas", icon: "faturas" },
      { href: "conciliacao-cartao.html", label: "Conciliação", icon: "conciliacao" },
      { href: "relatorios-cartao.html", label: "Relatórios de cartão", icon: "relatorios" }
    ] : [])
  ];

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <img class="sidebar-logo" src="img/sma_sistemas_eletricos_automacao_logo.png" alt="SM&A">
      <div>
        <strong>Controle Administrativo</strong>
        <small>Materiais e cartões</small>
      </div>
      <button class="sidebar-menu-button" type="button" aria-label="Menu lateral">☰</button>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-group">
        <span class="nav-group-title">Materiais</span>
        ${materiais.map((item) => criarLinkMenuModerno(item, paginaAtual)).join("")}
      </div>
      <div class="nav-group">
        <span class="nav-group-title">Cartões corporativos</span>
        ${cartoes.map((item) => criarLinkMenuModerno(item, paginaAtual)).join("")}
      </div>
      <div class="nav-group nav-group-system">
        <span class="nav-group-title">Sistema</span>
        ${criarLinkMenuModerno({ href: "usuarios.html", label: "Usuários", icon: "usuarios", adminOnly: true }, paginaAtual)}
        <a class="logout-link" href="login.html"><span class="nav-icon">${navIconModerno("sair")}</span><span class="nav-label">Sair</span><span class="nav-arrow">›</span></a>
      </div>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user-card">
        <span class="sidebar-avatar">${iniciaisUsuario()}</span>
        <span>
          <strong>${usuarioLogado?.nome || "Usuário"}</strong>
          <small>${usuarioLogado?.perfil || "usuário"}</small>
        </span>
      </div>
    </div>
  `;

  const botaoMenu = sidebar.querySelector(".sidebar-menu-button");
  botaoMenu?.addEventListener("click", alternarMenuLateral);
  aplicarEstadoMenuLateral();
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
  if (!topbar) return;

  const moduloCartao = paginasCartoes.includes(paginaAtual);

  if (!topbar.querySelector(".app-search") && !topbar.querySelector(".dashboard-search")) {
    const search = document.createElement("div");
    search.className = "app-search";
    search.innerHTML = `
      <label>
        <span class="hidden">Buscar</span>
        <input type="search" placeholder="Buscar materiais, cartoes, relatorios...">
      </label>
    `;
    const chip = topbar.querySelector(".user-chip");
    topbar.insertBefore(search, chip || topbar.firstElementChild?.nextSibling || null);
  }

  let actions = topbar.querySelector(".topbar-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "topbar-actions";
    topbar.appendChild(actions);
  }

  if (!actions.querySelector(".module-switch")) {
    const switcher = document.createElement("div");
    switcher.className = "module-switch";
    switcher.innerHTML = `
      <a class="${!moduloCartao ? "active" : ""}" href="dashboard.html">Materiais</a>
      <a class="${moduloCartao ? "active" : ""}" href="compra-cartao.html">Cartoes</a>
    `;
    actions.appendChild(switcher);
  }

  if (!actions.querySelector("#themeToggle")) {
    const themeButton = document.createElement("button");
    themeButton.id = "themeToggle";
    themeButton.className = "theme-toggle";
    themeButton.type = "button";
    themeButton.addEventListener("click", alternarTema);
    actions.appendChild(themeButton);
  }

  atualizarBotaoTema();
}

function aplicarPermissoes() {
  aplicarTemaSalvo();
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
    chip.classList.add("topbar-profile");
    chip.innerHTML = `
      <span class="profile-avatar">${iniciaisUsuario()}</span>
      <span class="profile-copy">
        <strong>${usuarioLogado.nome}</strong>
        <small>${usuarioLogado.perfil || "usuario"}</small>
      </span>
    `;
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

aplicarTemaSalvo();
aplicarPermissoes();
