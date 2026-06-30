const compraParams = new URLSearchParams(window.location.search);
const compraEdicaoId = compraParams.get("compraId");
const alertaResolucaoId = compraParams.get("alertaId");
const transacaoResolucaoId = compraParams.get("transacaoId");
let cartoesAtivosCache = [];
let comprasCartaoCache = [];
const camposProtegidosCompraAutomatica = ["cartaoId", "departamentoId", "dataCompra", "valor", "fornecedor", "observacao"];

function compraCadastradaAutomaticamente(compra) {
  return Boolean(compra?.automatica) || String(compra?.observacao || "").includes("Compra cadastrada automaticamente");
}

function definirCamposProtegidosCompraAutomatica(bloquear) {
  camposProtegidosCompraAutomatica.forEach((id) => {
    const campo = document.getElementById(id);
    if (!campo) return;
    if (campo.tagName === "SELECT") {
      campo.disabled = bloquear;
    } else {
      campo.readOnly = bloquear;
    }
    campo.title = bloquear ? "Campo cadastrado automaticamente e bloqueado para edicao." : "";
  });
}

async function initCompraCartao() {
  const cartoes = await (await fetch("/api/cartoes?status=ativo")).json();
  const setoresDetalhados = await (await fetch("/api/setores-detalhados")).json();
  cartoesAtivosCache = cartoes;

  preencherSelect(document.getElementById("cartaoId"), cartoes, "id", "nomeCartao");
  preencherSelect(document.getElementById("departamentoId"), setoresDetalhados, "id", "nome");
  preencherSelect(document.getElementById("responsavelCompraId"), usuarios, "id", "nome");
  document.getElementById("responsavelCompraId").value = usuarioIdAtual();
  document.getElementById("categoria").innerHTML = CARTAO_CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("dataCompra").value = new Date().toISOString().slice(0, 10);
  document.getElementById("cartaoId").addEventListener("change", () => {
    preencherDepartamentoPorCartao();
    atualizarResumoCartao();
  });
  prepararInteracoesCompraCartao();

  if (compraEdicaoId) {
    await carregarCompraParaEdicao(compraEdicaoId);
  } else if (transacaoResolucaoId) {
    carregarTransacaoParaNovaCompra();
  }

  await carregarComprasCartao();
  atualizarResumoCartao();
}

function carregarTransacaoParaNovaCompra() {
  document.querySelector(".topbar h1").textContent = "Registrar compra pendente";
  document.querySelector("#compraCartaoForm button[type='submit']").textContent = "Salvar e vincular pendência";
  const mensagem = document.getElementById("compraMensagem");
  mensagem.textContent = "Complete os campos faltantes para registrar a compra que apareceu na fatura.";
  mensagem.classList.remove("hidden");

  document.getElementById("cartaoId").value = compraParams.get("cartaoId") || "";
  document.getElementById("departamentoId").value = compraParams.get("departamentoId") || "";
  document.getElementById("dataCompra").value = compraParams.get("dataCompra") || "";
  document.getElementById("valor").value = compraParams.get("valor") || "";
  document.getElementById("fornecedor").value = compraParams.get("fornecedor") || "";
  document.getElementById("categoria").value = compraParams.get("categoria") || "outros";
  document.getElementById("responsavelCompraId").value = usuarioIdAtual();
}

function preencherDepartamentoPorCartao() {
  const cartao = cartoesAtivosCache.find((item) => item.id === Number(document.getElementById("cartaoId").value));
  if (cartao) document.getElementById("departamentoId").value = cartao.departamentoId;
}

async function carregarComprasCartao() {
  const compras = await (await fetch("/api/compras-cartao")).json();
  comprasCartaoCache = compras;
  renderizarComprasCartao();
  atualizarResumoCartao();
}

function renderizarComprasCartao() {
  const termo = String(document.getElementById("comprasCartaoBusca")?.value || "").trim().toLowerCase();
  const compras = comprasCartaoCache.filter((compra) => {
    if (!termo) return true;
    return [compra.cartao, compra.fornecedor, compra.categoria, compra.status, compra.responsavel]
      .some((valor) => String(valor || "").toLowerCase().includes(termo));
  });
  const podeVerDetalhes = typeof ehAdminOuGerente === "function" ? ehAdminOuGerente() : false;
  document.getElementById("comprasCartaoTabela").innerHTML = compras.map((compra) => `
    <tr class="report-data-row purchase-row">
      <td><strong>${formatarData(compra.dataCompra)}</strong></td>
      <td>
        <strong>${compra.cartao}</strong>
        <small>final ${compra.ultimos4Digitos || "----"}</small>
      </td>
      <td>${compra.fornecedor}</td>
      <td><span class="report-money-pill">${moeda(compra.valor)}</span></td>
      <td>${compra.categoria}</td>
      <td><span class="${classeStatus(compra.status)}">${compra.status}</span></td>
      <td>
        ${podeVerDetalhes
          ? `<button class="btn btn-secondary btn-compact" type="button" onclick="abrirDetalheCompra(${compra.id})">Ver detalhes</button>`
          : "-"}
      </td>
    </tr>
  `).join("");
}

function comprasDoMesAtual() {
  const hoje = new Date();
  return comprasCartaoCache.filter((compra) => {
    const data = new Date(`${compra.dataCompra}T00:00:00`);
    return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });
}

function proximaFaturaLabel() {
  const hoje = new Date();
  const data = new Date(hoje.getFullYear(), hoje.getMonth(), 10);
  if (hoje.getDate() > 10) data.setMonth(data.getMonth() + 1);
  return data.toLocaleDateString("pt-BR");
}

function atualizarResumoCartao() {
  const cartaoId = Number(document.getElementById("cartaoId")?.value || 0);
  const cartao = cartoesAtivosCache.find((item) => item.id === cartaoId);
  if (!cartao) return;

  const comprasMesCartao = comprasDoMesAtual().filter((compra) => Number(compra.cartaoId) === cartaoId);
  const totalMes = comprasMesCartao.reduce((total, compra) => total + Number(compra.valor || 0), 0);
  const limite = Number(cartao.limiteMensal || 0);
  const disponivel = Math.max(0, limite - totalMes);
  const percentualUso = limite > 0 ? Math.min(100, (totalMes / limite) * 100) : 0;

  document.getElementById("resumoCartaoNome").textContent = cartao.nomeCartao || "Cartão corporativo";
  document.getElementById("resumoCartaoFinal").textContent = `.... .... .... ${cartao.ultimos4Digitos || "----"}`;
  document.getElementById("resumoCartaoStatus").textContent = cartao.status || "ativo";
  document.getElementById("resumoCartaoTitular").textContent = cartao.responsavel || "-";
  document.getElementById("resumoCartaoDepartamento").textContent = cartao.departamento || "-";
  document.getElementById("resumoCartaoDisponivel").textContent = limite ? moeda(disponivel) : "Sem limite";
  document.getElementById("resumoCartaoMes").textContent = moeda(totalMes);
  document.getElementById("resumoCartaoFatura").textContent = proximaFaturaLabel();
  document.getElementById("resumoCartaoBarra").style.width = `${percentualUso}%`;
}

function atualizarContadorCompra() {
  const observacao = document.getElementById("observacao");
  const contador = document.getElementById("observacaoCompraContador");
  if (observacao && contador) contador.textContent = `${observacao.value.length}/500`;
}

function atualizarComprovanteVisual() {
  const input = document.getElementById("comprovanteArquivo");
  const label = document.querySelector(".purchase-upload-box strong");
  const hint = document.querySelector(".purchase-upload-box small");
  const file = input?.files?.[0];
  if (!label || !hint) return;
  if (file) {
    label.textContent = file.name;
    hint.textContent = "Arquivo selecionado";
  } else {
    label.textContent = "Arraste e solte o arquivo aqui";
    hint.textContent = "ou clique para selecionar";
  }
}

function prepararInteracoesCompraCartao() {
  document.getElementById("observacao")?.addEventListener("input", atualizarContadorCompra);
  document.getElementById("valor")?.addEventListener("input", atualizarResumoCartao);
  document.getElementById("comprasCartaoBusca")?.addEventListener("input", renderizarComprasCartao);
  document.getElementById("comprovanteArquivo")?.addEventListener("change", atualizarComprovanteVisual);
  atualizarContadorCompra();
  atualizarComprovanteVisual();
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function detalheItem(rotulo, valor, extraClass = "") {
  return `
    <div class="detail-item ${extraClass}">
      <span>${rotulo}</span>
      <strong>${escapeHtml(valor || "-")}</strong>
    </div>
  `;
}

function detalheCompraCampo(rotulo, valor, icone, extraClass = "") {
  return `
    <article class="purchase-detail-field ${extraClass}">
      <span class="purchase-detail-field-icon" aria-hidden="true">${icone}</span>
      <div>
        <small>${escapeHtml(rotulo)}</small>
        <strong>${escapeHtml(valor || "-")}</strong>
      </div>
    </article>
  `;
}

function comprovanteUrlValido(comprovanteUrl) {
  const valor = String(comprovanteUrl || "").trim();
  if (!valor || valor === "." || valor === "-") return false;
  if (/^https?:\/\//i.test(valor)) return true;
  return valor.startsWith("/uploads/comprovantes/");
}

function linkComprovanteAtual(comprovanteUrl, prefixo = "Comprovante atual") {
  if (!comprovanteUrl) return "Nenhum comprovante anexado.";
  if (!comprovanteUrlValido(comprovanteUrl)) {
    return "Comprovante antigo inválido. Anexe o arquivo novamente.";
  }
  const url = escapeHtml(comprovanteUrl);
  return `${prefixo}: <a href="${url}" target="_blank" rel="noopener">abrir arquivo</a>`;
}

function renderComprovante(comprovanteUrl) {
  if (!comprovanteUrl) {
    return `
      <div class="detail-item full-width">
        <span>Comprovante</span>
        <strong>Nenhum comprovante anexado.</strong>
      </div>
    `;
  }

  if (!comprovanteUrlValido(comprovanteUrl)) {
    return `
      <div class="detail-item full-width">
        <span>Comprovante</span>
        <strong>Comprovante antigo inválido.</strong>
        <p class="field-hint">Edite a compra e anexe o arquivo novamente.</p>
      </div>
    `;
  }

  const url = escapeHtml(comprovanteUrl);
  const isImagem = /\.(png|jpe?g|webp)$/i.test(comprovanteUrl);
  const preview = isImagem
    ? `<img src="${url}" alt="Comprovante da compra">`
    : `<p class="field-hint">Arquivo anexado. Use o botao abaixo para abrir o comprovante.</p>`;

  return `
    <div class="detail-item full-width">
      <span>Comprovante</span>
      <div class="attachment-preview">
        ${preview}
        <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">Abrir comprovante</a>
      </div>
    </div>
  `;
}

async function abrirDetalheCompra(id) {
  const modal = document.getElementById("detalheCompraModal");
  const conteudo = document.getElementById("detalheCompraConteudo");
  const titulo = document.getElementById("detalheCompraTitulo");

  titulo.textContent = "Carregando compra...";
  conteudo.innerHTML = "";
  modal.classList.remove("hidden");

  const res = await fetch(`/api/compras-cartao/${id}`);
  const compra = await res.json();

  if (!res.ok) {
    titulo.textContent = "Nao foi possivel abrir a compra";
    conteudo.innerHTML = detalheItem("Erro", compra.erro || "Tente novamente.", "full-width");
    return;
  }

  titulo.textContent = `${compra.fornecedor || "Compra"} - ${moeda(compra.valor)}`;
  conteudo.innerHTML = `
    ${detalheItem("Data da compra", formatarData(compra.dataCompra))}
    ${detalheItem("Status", compra.status)}
    ${detalheItem("Cartao", compra.cartao)}
    ${detalheItem("Departamento", compra.departamento)}
    ${detalheItem("Responsavel", compra.responsavelCompra || compra.responsavel)}
    ${detalheItem("Categoria", compra.categoria)}
    ${detalheItem("Fornecedor", compra.fornecedor)}
    ${detalheItem("Valor", moeda(compra.valor))}
    ${detalheItem("Motivo", compra.motivo, "full-width")}
    ${detalheItem("Observacao", compra.observacao, "full-width")}
    ${renderComprovante(compra.comprovanteUrl)}
    <div class="form-actions full-width">
      <a class="btn btn-secondary" href="compra-cartao.html?compraId=${compra.id}">Editar compra</a>
    </div>
  `;
}

function fecharDetalheCompra() {
  document.getElementById("detalheCompraModal").classList.add("hidden");
}

function dataHoraTimeline(compra, fallbackHora = "14:22") {
  const data = formatarData(compra.dataCompra);
  return data && data !== "-" ? `${data} às ${fallbackHora}` : "-";
}

function eventoTimeline(titulo, descricao, horario, autor, icone, concluido = true, destaque = false) {
  return `
    <article class="purchase-timeline-event ${concluido ? "is-done" : "is-pending"} ${destaque ? "is-highlight" : ""}">
      <span class="purchase-timeline-marker" aria-hidden="true">${concluido ? "✓" : "○"}</span>
      <div class="purchase-timeline-card">
        <div>
          <strong><span aria-hidden="true">${icone}</span>${escapeHtml(titulo)}</strong>
          <p>${escapeHtml(descricao)}</p>
        </div>
        <aside>
          <time>${escapeHtml(horario || "-")}</time>
          <small>${escapeHtml(autor || "-")}</small>
        </aside>
      </div>
    </article>
  `;
}

function renderHistoricoCompra(compra) {
  const responsavel = compra.responsavelCompra || compra.responsavel || "Usuário";
  const possuiComprovante = comprovanteUrlValido(compra.comprovanteUrl);
  const statusTexto = String(compra.status || "").toLowerCase();
  const importada = /automaticamente|e-mail|email|autom/i.test(`${compra.observacao || ""} ${compra.motivo || ""}`);
  const concluida = ["conferida", "conciliada", "resolvida"].some((status) => statusTexto.includes(status));
  const conciliada = statusTexto.includes("conciliada") || Boolean(compra.faturaId || compra.fatura_id || compra.numeroFatura);
  const eventos = [
    eventoTimeline(
      importada ? "Compra registrada automaticamente" : "Compra registrada no sistema",
      importada ? "A compra foi criada a partir da integração por e-mail." : "A compra foi criada e registrada no sistema.",
      dataHoraTimeline(compra, "14:22"),
      importada ? "Sistema" : responsavel,
      "▣"
    )
  ];

  if (importada || compra.teamsEnviado || compra.alertaTeamsEnviado) {
    eventos.push(eventoTimeline(
      "Alerta enviado no Teams",
      "Notificação enviada para o canal ou responsável do cartão.",
      dataHoraTimeline(compra, "14:22"),
      "Sistema (Integração)",
      "T"
    ));
  }

  eventos.push(eventoTimeline(
    "Usuário abriu a compra",
    `${responsavel} acessou os detalhes desta compra.`,
    dataHoraTimeline(compra, "14:24"),
    responsavel,
    "○"
  ));

  eventos.push(eventoTimeline(
    "Comprovante anexado",
    possuiComprovante ? "O arquivo do comprovante foi anexado à compra." : "A compra ainda não possui comprovante anexado.",
    possuiComprovante ? dataHoraTimeline(compra, "14:23") : "-",
    possuiComprovante ? responsavel : "Pendente",
    "↗",
    possuiComprovante
  ));

  eventos.push(eventoTimeline(
    "Compra concluída",
    concluida ? "Compra marcada como conferida." : "A compra ainda aguarda conclusão.",
    concluida ? dataHoraTimeline(compra, "14:25") : "-",
    concluida ? responsavel : "Pendente",
    "⚑",
    concluida
  ));

  eventos.push(eventoTimeline(
    "Conciliada com fatura",
    conciliada ? "A compra foi conciliada com uma fatura importada." : "A compra ainda não foi conciliada com fatura.",
    conciliada ? dataHoraTimeline(compra, "14:30") : "-",
    conciliada ? "Sistema" : "Pendente",
    "✓",
    conciliada,
    conciliada
  ));

  return `
    <section class="purchase-detail-timeline">
      <div class="purchase-detail-section-title">
        <span aria-hidden="true">◷</span>
        <strong>Histórico da compra</strong>
        <em>${eventos.length} eventos</em>
      </div>
      <div class="purchase-timeline-list">
        ${eventos.join("")}
      </div>
    </section>
  `;
}

function renderComprovanteDetalhado(comprovanteUrl) {
  if (!comprovanteUrl) {
    return `
      <section class="purchase-detail-receipt purchase-detail-receipt-empty">
        <div class="purchase-detail-section-title">
          <span aria-hidden="true">↗</span>
          <strong>Comprovante</strong>
        </div>
        <div class="purchase-detail-empty-receipt">
          <strong>Nenhum comprovante anexado.</strong>
          <p>Edite a compra para anexar o arquivo do comprovante.</p>
        </div>
      </section>
    `;
  }

  if (!comprovanteUrlValido(comprovanteUrl)) {
    return `
      <section class="purchase-detail-receipt purchase-detail-receipt-empty">
        <div class="purchase-detail-section-title">
          <span aria-hidden="true">↗</span>
          <strong>Comprovante</strong>
        </div>
        <div class="purchase-detail-empty-receipt">
          <strong>Comprovante antigo inválido.</strong>
          <p>Edite a compra e anexe o arquivo novamente.</p>
        </div>
      </section>
    `;
  }

  const url = escapeHtml(comprovanteUrl);
  const isImagem = /\.(png|jpe?g|webp)$/i.test(comprovanteUrl);
  const nomeArquivo = decodeURIComponent(String(comprovanteUrl).split("/").pop() || "comprovante");
  const preview = isImagem
    ? `<img src="${url}" alt="Comprovante da compra">`
    : `<div class="purchase-detail-file-preview"><strong>Arquivo anexado</strong><span>Use os botões para abrir ou baixar o comprovante.</span></div>`;

  return `
    <section class="purchase-detail-receipt">
      <div class="purchase-detail-section-title">
        <span aria-hidden="true">↗</span>
        <strong>Comprovante</strong>
      </div>
      <div class="purchase-detail-receipt-grid">
        <div class="purchase-detail-receipt-preview">${preview}</div>
        <div class="purchase-detail-receipt-info">
          <div class="purchase-detail-file-card">
            <span class="purchase-detail-field-icon" aria-hidden="true">▣</span>
            <div>
              <strong>${escapeHtml(nomeArquivo)}</strong>
              <small>${isImagem ? "Imagem do comprovante" : "Arquivo do comprovante"}</small>
            </div>
          </div>
          <div class="purchase-detail-receipt-actions">
            <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">Abrir comprovante</a>
            <a class="btn btn-secondary" href="${url}" download>Baixar comprovante</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

async function abrirDetalheCompra(id) {
  const modal = document.getElementById("detalheCompraModal");
  const conteudo = document.getElementById("detalheCompraConteudo");

  conteudo.innerHTML = `
    <div class="purchase-detail-loading">
      <span class="eyebrow">Detalhes da compra</span>
      <h2>Carregando compra...</h2>
    </div>
  `;
  modal.classList.remove("hidden");

  const res = await fetch(`/api/compras-cartao/${id}`);
  const compra = await res.json();

  if (!res.ok) {
    conteudo.innerHTML = `
      <div class="purchase-detail-topbar">
        <button class="purchase-detail-back" type="button" onclick="fecharDetalheCompra()">←</button>
        <span>Compras</span>
        <strong>Detalhes da compra</strong>
        <button class="btn btn-secondary" type="button" onclick="fecharDetalheCompra()">Fechar</button>
      </div>
      <div class="purchase-detail-loading">
        <span class="eyebrow">Erro</span>
        <h2>Não foi possível abrir a compra</h2>
        <p>${escapeHtml(compra.erro || "Tente novamente.")}</p>
      </div>
    `;
    return;
  }

  conteudo.innerHTML = `
    <div class="purchase-detail-topbar">
      <button class="purchase-detail-back" type="button" onclick="fecharDetalheCompra()">←</button>
      <span>Compras</span>
      <strong>Detalhes da compra</strong>
      <button class="btn btn-secondary" type="button" onclick="fecharDetalheCompra()">Fechar</button>
    </div>

    <header class="purchase-detail-header">
      <div class="purchase-detail-title">
        <span class="purchase-detail-title-icon" aria-hidden="true">▣</span>
        <div>
          <span class="eyebrow">Detalhes da compra</span>
          <h2>${escapeHtml(compra.fornecedor || "Compra")}</h2>
          <p>${moeda(compra.valor)}</p>
        </div>
      </div>
      <div class="purchase-detail-card-art" aria-hidden="true"></div>
    </header>

    <section class="purchase-detail-highlight">
      <article>
        <span class="purchase-detail-field-icon" aria-hidden="true">▭</span>
        <div><small>Cartão</small><strong>${escapeHtml(compra.cartao || "-")}</strong></div>
      </article>
      <article>
        <span class="purchase-detail-field-icon" aria-hidden="true">▦</span>
        <div><small>Departamento</small><strong>${escapeHtml(compra.departamento || "-")}</strong></div>
      </article>
      <article>
        <span class="purchase-detail-field-icon" aria-hidden="true">✓</span>
        <div><small>Status</small><strong><span class="${classeStatus(compra.status)}">${escapeHtml(String(compra.status || "-").replaceAll("_", " "))}</span></strong></div>
      </article>
      <article>
        <span class="purchase-detail-field-icon" aria-hidden="true">R$</span>
        <div><small>Valor total</small><strong>${moeda(compra.valor)}</strong></div>
      </article>
    </section>

    <div class="purchase-detail-layout">
      <section class="purchase-detail-info-grid">
        ${detalheCompraCampo("Data da compra", formatarData(compra.dataCompra), "□")}
        ${detalheCompraCampo("Responsável", compra.responsavelCompra || compra.responsavel, "○")}
        ${detalheCompraCampo("Fornecedor", compra.fornecedor, "▤")}
        ${detalheCompraCampo("Categoria", String(compra.categoria || "-").replaceAll("_", " "), "◇")}
        ${detalheCompraCampo("Motivo", compra.motivo, "▣")}
        ${detalheCompraCampo("Observação", compra.observacao, "◌")}
      </section>
      ${renderHistoricoCompra(compra)}
    </div>

    ${renderComprovanteDetalhado(compra.comprovanteUrl)}

    <div class="purchase-detail-footer">
      <a class="btn btn-primary" href="compra-cartao.html?compraId=${compra.id}">Editar compra</a>
    </div>
  `;
}

function getPayloadCompra() {
  return {
    cartaoId: document.getElementById("cartaoId").value,
    departamentoId: document.getElementById("departamentoId").value,
    responsavelCompraId: document.getElementById("responsavelCompraId").value,
    dataCompra: document.getElementById("dataCompra").value,
    valor: document.getElementById("valor").value,
    fornecedor: document.getElementById("fornecedor").value,
    categoria: document.getElementById("categoria").value,
    motivo: document.getElementById("motivo").value,
    comprovanteUrl: document.getElementById("comprovanteUrl").value,
    observacao: document.getElementById("observacao").value
  };
}

function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function enviarComprovanteSeNecessario() {
  const input = document.getElementById("comprovanteArquivo");
  const file = input.files?.[0];
  const atual = document.getElementById("comprovanteUrl").value;
  if (!file) return comprovanteUrlValido(atual) ? atual : "";

  const mensagem = document.getElementById("compraMensagem");
  mensagem.textContent = "Enviando comprovante...";
  mensagem.classList.remove("hidden");

  const base64 = await lerArquivoComoBase64(file);
  const res = await fetch("/api/uploads/comprovante", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      base64,
      departamentoId: document.getElementById("departamentoId").value,
      dataCompra: document.getElementById("dataCompra").value
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || "Erro ao enviar comprovante.");
  document.getElementById("comprovanteUrl").value = data.caminho;
  document.getElementById("comprovanteAtual").innerHTML = linkComprovanteAtual(data.caminho, "Comprovante anexado");
  return data.caminho;
}

async function carregarCompraParaEdicao(id) {
  const res = await fetch(`/api/compras-cartao/${id}`);
  const compra = await res.json();
  const mensagem = document.getElementById("compraMensagem");
  definirCamposProtegidosCompraAutomatica(false);

  if (!res.ok) {
    mensagem.textContent = compra.erro || "Não foi possível carregar a compra.";
    mensagem.classList.remove("hidden");
    return;
  }

  if (!cartoesAtivosCache.some((cartao) => cartao.id === Number(compra.cartaoId))) {
    cartoesAtivosCache.push({
      id: compra.cartaoId,
      nomeCartao: compra.cartao,
      departamentoId: compra.departamentoId
    });
    preencherSelect(document.getElementById("cartaoId"), cartoesAtivosCache, "id", "nomeCartao");
  }

  document.querySelector(".topbar h1").textContent = "Resolver pendência da compra";
  document.querySelector("#compraCartaoForm button[type='submit']").textContent = "Atualizar compra";
  mensagem.textContent = "Complete os campos faltantes da compra e salve para resolver o alerta.";
  mensagem.classList.remove("hidden");

  document.getElementById("cartaoId").value = compra.cartaoId;
  document.getElementById("departamentoId").value = compra.departamentoId;
  document.getElementById("responsavelCompraId").value = compra.responsavelCompraId;
  document.getElementById("dataCompra").value = compra.dataCompra;
  document.getElementById("valor").value = compra.valor;
  document.getElementById("fornecedor").value = compra.fornecedor;
  document.getElementById("categoria").value = compra.categoria;
  document.getElementById("motivo").value = compra.motivo;
  document.getElementById("comprovanteUrl").value = comprovanteUrlValido(compra.comprovanteUrl) ? compra.comprovanteUrl : "";
  document.getElementById("comprovanteAtual").innerHTML = linkComprovanteAtual(compra.comprovanteUrl);
  document.getElementById("observacao").value = compra.observacao || "";
  atualizarContadorCompra();
  atualizarResumoCartao();

  if (compraCadastradaAutomaticamente(compra)) {
    definirCamposProtegidosCompraAutomatica(true);
    mensagem.textContent = "Esta compra foi cadastrada automaticamente. Complete apenas os campos faltantes: responsavel, categoria, motivo e comprovante.";
  }
}

async function buscarPendenciasCompativeis(payload) {
  const res = await fetch("/api/compras-cartao/pendencias-compativeis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return [];
  return res.json();
}

function escolherPendenciaCompativel(pendencias) {
  if (!pendencias.length) return null;
  const primeira = pendencias[0];
  const detalhes = [
    "Existe uma compra pendente na fatura parecida com este registro:",
    "",
    `Data: ${formatarData(primeira.dataTransacao)}`,
    `Cartão: ${primeira.cartao}`,
    `Departamento: ${primeira.departamento}`,
    `Estabelecimento: ${primeira.estabelecimento}`,
    `Valor: ${moeda(primeira.valor)}`,
    "",
    "Esta compra que você está registrando corresponde a essa pendência?",
    "",
    "OK = Sim, vincular à pendência",
    "Cancelar = Não, registrar como nova compra"
  ].join("\n");
  return escolherPendenciaCompativelModal(pendencias);
}

function escolherPendenciaCompativelModal(pendencias) {
  if (!pendencias.length) return Promise.resolve(null);
  const primeira = pendencias[0];
  const modal = document.getElementById("pendenciaCompatibilidadeModal");
  const conteudo = document.getElementById("pendenciaCompatibilidadeConteudo");
  const vincularBtn = document.getElementById("vincularPendenciaBtn");
  const novaCompraBtn = document.getElementById("registrarNovaCompraBtn");

  conteudo.innerHTML = `
    ${detalheItem("Data na fatura", formatarData(primeira.dataTransacao))}
    ${detalheItem("Cartao", primeira.cartao)}
    ${detalheItem("Departamento", primeira.departamento)}
    ${detalheItem("Estabelecimento", primeira.estabelecimento)}
    ${detalheItem("Valor", moeda(primeira.valor))}
    ${detalheItem("Status", primeira.statusConciliacao, "full-width")}
    <div class="detail-item full-width">
      <span>Decisao</span>
      <strong>Confira se a compra que voce acabou de preencher corresponde a esta pendencia da fatura.</strong>
    </div>
  `;
  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    const finalizar = (pendencia) => {
      modal.classList.add("hidden");
      vincularBtn.removeEventListener("click", vincular);
      novaCompraBtn.removeEventListener("click", novaCompra);
      resolve(pendencia);
    };
    const vincular = () => finalizar(primeira);
    const novaCompra = () => finalizar(null);

    vincularBtn.addEventListener("click", vincular);
    novaCompraBtn.addEventListener("click", novaCompra);
  });
}

document.getElementById("compraCartaoForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const mensagem = document.getElementById("compraMensagem");
  let payload;

  try {
    const comprovanteUrl = await enviarComprovanteSeNecessario();
    payload = getPayloadCompra();
    payload.comprovanteUrl = comprovanteUrl;
  } catch (error) {
    mensagem.textContent = error.message;
    mensagem.classList.remove("hidden");
    return;
  }

  if (compraEdicaoId) {
    payload.alertaId = alertaResolucaoId;
    payload.status = payload.comprovanteUrl ? "registrada" : "sem_comprovante";
    const res = await fetch(`/api/compras-cartao/${compraEdicaoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    mensagem.textContent = data.erro || (data.alertaResolvido ? "Compra atualizada e alerta resolvido." : "Compra atualizada. Ainda existe informação pendente para resolver o alerta.");
    mensagem.classList.remove("hidden");
    await carregarComprasCartao();
    return;
  }

  if (transacaoResolucaoId) {
    payload.vincularPendencia = true;
    payload.transacaoFaturaId = transacaoResolucaoId;
  } else {
    const pendencias = await buscarPendenciasCompativeis(payload);
    const pendenciaEscolhida = await escolherPendenciaCompativelModal(pendencias);
    if (pendenciaEscolhida) {
      payload.vincularPendencia = true;
      payload.transacaoFaturaId = pendenciaEscolhida.id;
    } else {
      payload.vincularPendencia = false;
    }
  }

  const res = await fetch("/api/compras-cartao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  mensagem.textContent = data.erro || (data.pendenciaAtualizada ? "Compra registrada e pendência da fatura atualizada." : "Compra registrada.");
  mensagem.classList.remove("hidden");

  if (res.ok) {
    event.target.reset();
    definirCamposProtegidosCompraAutomatica(false);
    document.getElementById("comprovanteUrl").value = "";
    document.getElementById("comprovanteAtual").textContent = "Nenhum comprovante anexado.";
    document.getElementById("dataCompra").value = new Date().toISOString().slice(0, 10);
    document.getElementById("responsavelCompraId").value = usuarioIdAtual();
    atualizarContadorCompra();
    atualizarComprovanteVisual();
    atualizarResumoCartao();
    await carregarComprasCartao();
  }
});

initCompraCartao();
