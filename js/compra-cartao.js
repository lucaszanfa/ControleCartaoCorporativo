const compraParams = new URLSearchParams(window.location.search);
const compraEdicaoId = compraParams.get("compraId");
const alertaResolucaoId = compraParams.get("alertaId");
const transacaoResolucaoId = compraParams.get("transacaoId");
let cartoesAtivosCache = [];

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
  document.getElementById("cartaoId").addEventListener("change", preencherDepartamentoPorCartao);

  if (compraEdicaoId) {
    await carregarCompraParaEdicao(compraEdicaoId);
  } else if (transacaoResolucaoId) {
    carregarTransacaoParaNovaCompra();
  }

  await carregarComprasCartao();
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
  const podeVerDetalhes = typeof ehAdminOuGerente === "function" ? ehAdminOuGerente() : false;
  document.getElementById("comprasCartaoTabela").innerHTML = compras.map((compra) => `
    <tr class="report-data-row">
      <td><strong>${formatarData(compra.dataCompra)}</strong></td>
      <td><strong>${compra.cartao}</strong></td>
      <td>${compra.fornecedor}</td>
      <td><span class="report-money-pill">${moeda(compra.valor)}</span></td>
      <td>${compra.categoria}</td>
      <td><span class="${classeStatus(compra.status)}">${compra.status}</span></td>
      <td>
        ${podeVerDetalhes
          ? `<button class="btn btn-secondary" type="button" onclick="abrirDetalheCompra(${compra.id})">Ver detalhes</button>`
          : "-"}
      </td>
    </tr>
  `).join("");
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
    ${detalheItem("Cartao", compra.ultimos4Digitos ? `${compra.cartao} final ${compra.ultimos4Digitos}` : compra.cartao)}
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
    document.getElementById("comprovanteUrl").value = "";
    document.getElementById("comprovanteAtual").textContent = "Nenhum comprovante anexado.";
    document.getElementById("dataCompra").value = new Date().toISOString().slice(0, 10);
    document.getElementById("responsavelCompraId").value = usuarioIdAtual();
    await carregarComprasCartao();
  }
});

initCompraCartao();
