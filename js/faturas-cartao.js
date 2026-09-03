let csvFaturaSelecionada = "";
let transacoesFaturaSelecionadas = [];
let cartoesFaturaCache = [];
let faturasCache = [];
let faturasOrdenacaoAtual = "importacao_desc";
let faturasPaginaAtual = 1;
let faturasPorPaginaAtual = 10;

async function initFaturas() {
  cartoesFaturaCache = await (await fetch(`/api/cartoes?status=ativo&usuarioId=${usuarioIdAtual()}&permissao=ver`)).json();
  document.getElementById("cartaoIdLista").innerHTML = `
    <option value="">Selecione o cartão</option>
    ${cartoesFaturaCache.map((cartao) => `<option value="${cartao.id}">${escapeHtml(cartao.nomeCartao)} (final ${escapeHtml(cartao.ultimos4Digitos)})</option>`).join("")}
  `;
  document.getElementById("cartaoIdLista").addEventListener("change", renderPreviaFatura);
  document.getElementById("mesReferencia").innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  document.getElementById("mesReferencia").value = new Date().getMonth() + 1;
  document.getElementById("filtroFaturaCartao").innerHTML = `
    <option value="">Todos os cartões</option>
    ${cartoesFaturaCache.map((cartao) => `<option value="${cartao.id}">${escapeHtml(cartao.nomeCartao)} (final ${escapeHtml(cartao.ultimos4Digitos)})</option>`).join("")}
  `;
  configurarListaFaturas();
  await carregarFaturas();
}

function cartoesSelecionados() {
  const valor = document.getElementById("cartaoIdLista").value;
  return valor ? [Number(valor)] : [];
}

function parseCsv(texto) {
  return texto.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).filter((linha) => {
    return !/^data[_;]transacao|^data_transacao;/i.test(linha);
  }).map((linha) => {
    const [dataTransacao, estabelecimento, valor, ultimos4Digitos, codigoAutorizacao, categoriaDetectada] = linha.split(";").map((item) => item.trim());
    return { dataTransacao, estabelecimento, valor: Number(String(valor).replace(",", ".")), ultimos4Digitos, codigoAutorizacao, categoriaDetectada };
  });
}

function renderPreviaFatura() {
  const previa = document.getElementById("previaFatura");
  if (!transacoesFaturaSelecionadas.length) {
    previa.innerHTML = "";
    previa.classList.add("hidden");
    return;
  }

  const idsSelecionados = new Set(cartoesSelecionados());
  const nomePorDigitos = new Map(
    cartoesFaturaCache.filter((cartao) => idsSelecionados.has(cartao.id)).map((cartao) => [cartao.ultimos4Digitos, cartao.nomeCartao])
  );

  previa.classList.remove("hidden");
  previa.innerHTML = `
    <div class="section-header">
      <div><h2>Prévia das transações</h2><p>Confira os dados reconhecidos e o cartão de destino antes de importar.</p></div>
      <strong>${transacoesFaturaSelecionadas.length} transação(ões)</strong>
    </div>
    <div class="table-wrapper"><table>
      <thead><tr><th>Data</th><th>Estabelecimento</th><th>Valor</th><th>Final</th><th>Cartão</th><th>Categoria</th></tr></thead>
      <tbody>${transacoesFaturaSelecionadas.map((item) => {
        const nomeCartao = nomePorDigitos.get(String(item.ultimos4Digitos));
        const celulaCartao = nomeCartao
          ? escapeHtml(nomeCartao)
          : `<span class="status status-pending">Não corresponde a um cartão marcado</span>`;
        return `<tr><td>${escapeHtml(item.dataTransacao)}</td><td>${escapeHtml(item.estabelecimento)}</td><td>${moeda(item.valor)}</td><td>${escapeHtml(item.ultimos4Digitos)}</td><td>${celulaCartao}</td><td>${escapeHtml(item.categoriaDetectada || "outros")}</td></tr>`;
      }).join("")}</tbody>
    </table></div>
  `;
}

function arquivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function carregarArquivoFatura(event) {
  const file = event.target.files?.[0];
  const mensagem = document.getElementById("faturaMensagem");
  const arquivoAtual = document.getElementById("arquivoFaturaAtual");
  const arquivoNome = document.getElementById("arquivoNome");

  if (!file) {
    arquivoNome.value = "";
    csvFaturaSelecionada = "";
    transacoesFaturaSelecionadas = [];
    renderPreviaFatura();
    arquivoAtual.textContent = "Nenhum arquivo selecionado.";
    return;
  }

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  if (!isCsv && !isPdf) {
    event.target.value = "";
    arquivoNome.value = "";
    csvFaturaSelecionada = "";
    arquivoAtual.textContent = "Nenhum arquivo selecionado.";
    mensagem.textContent = "Anexe um arquivo CSV ou PDF.";
    mensagem.classList.remove("hidden");
    return;
  }

  arquivoNome.value = file.name;
  mensagem.classList.remove("hidden");

  if (isCsv) {
    const texto = await file.text();
    csvFaturaSelecionada = texto.trim();
    transacoesFaturaSelecionadas = parseCsv(texto);
    arquivoAtual.textContent = `Arquivo selecionado: ${file.name} (${transacoesFaturaSelecionadas.length} transação(ões))`;
    mensagem.textContent = "Arquivo CSV carregado. Confira a prévia antes de importar.";
    renderPreviaFatura();
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    event.target.value = "";
    arquivoNome.value = "";
    mensagem.textContent = "O PDF deve ter no máximo 10 MB.";
    return;
  }

  const cartaoIdsPdf = cartoesSelecionados();
  if (!cartaoIdsPdf.length) {
    event.target.value = "";
    arquivoNome.value = "";
    mensagem.textContent = "Selecione o cartão antes de anexar um PDF.";
    mensagem.classList.remove("hidden");
    return;
  }

  arquivoAtual.textContent = `Processando PDF: ${file.name}...`;
  mensagem.textContent = "Extraindo as transações do PDF...";
  const resposta = await fetch("/api/faturas-cartao/extrair-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      base64: await arquivoComoDataUrl(file),
      cartaoId: cartaoIdsPdf[0],
      anoReferencia: document.getElementById("anoReferencia").value,
      banco: document.getElementById("bancoFatura").value
    })
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    event.target.value = "";
    arquivoNome.value = "";
    transacoesFaturaSelecionadas = [];
    arquivoAtual.textContent = "Nenhum arquivo selecionado.";
    mensagem.textContent = dados.erro || "Não foi possível processar o PDF.";
    renderPreviaFatura();
    return;
  }

  csvFaturaSelecionada = "";
  transacoesFaturaSelecionadas = dados.transacoes || [];
  arquivoAtual.textContent = `PDF processado: ${file.name} (${transacoesFaturaSelecionadas.length} transação(ões))`;
  mensagem.textContent = "PDF convertido. Confira a prévia antes de importar.";
  renderPreviaFatura();
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function rotuloPendencia(status) {
  const labels = {
    sem_registro: "Compra sem registro",
    valor_divergente: "Valor divergente",
    data_divergente: "Data divergente",
    aguardando_comprovante: "Aguardando comprovante"
  };
  return labels[status] || status;
}

function linkResolucaoPendencia(pendencia) {
  if (pendencia.compraId) {
    const params = new URLSearchParams({ compraId: pendencia.compraId });
    if (pendencia.alertaId) params.set("alertaId", pendencia.alertaId);
    return `compra-cartao.html?${params.toString()}`;
  }

  const params = new URLSearchParams({
    transacaoId: pendencia.transacaoId,
    cartaoId: pendencia.cartaoId,
    departamentoId: pendencia.departamentoId,
    dataCompra: pendencia.dataTransacao || "",
    valor: pendencia.valor || "",
    fornecedor: pendencia.estabelecimento || "",
    categoria: "outros"
  });
  if (pendencia.alertaId) params.set("alertaId", pendencia.alertaId);
  return `compra-cartao.html?${params.toString()}`;
}

function detalheCompraEncontrada(pendencia) {
  if (!pendencia.compraId) return "Nenhuma compra encontrada para essa transação.";

  const detalhes = [
    pendencia.compraFornecedor,
    pendencia.compraData ? formatarData(pendencia.compraData) : null,
    pendencia.compraValor ? moeda(pendencia.compraValor) : null
  ].filter(Boolean).join(" - ");

  return `Compra encontrada: ${detalhes || "dados incompletos"}.`;
}

function gerarCsvTransacoes(transacoes) {
  const linhas = transacoes.map((item) => [
    item.data_transacao,
    item.estabelecimento,
    Number(item.valor || 0).toFixed(2).replace(".", ","),
    item.ultimos_4_digitos,
    item.codigo_autorizacao || "",
    item.categoria_detectada || "outros"
  ].join(";"));
  return ["data_transacao;estabelecimento;valor;ultimos_4_digitos;codigo_autorizacao;categoria", ...linhas].join("\n");
}

function baixarArquivoTexto(nomeArquivo, conteudo) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function renderArquivosPorCartao(itensImportados, mesReferencia, anoReferencia) {
  const container = document.getElementById("arquivosPorCartao");
  if (itensImportados.length < 2) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const porCartao = await Promise.all(itensImportados.map(async (item) => ({
    ...item,
    transacoes: await (await fetch(`/api/faturas-cartao/${item.faturaId}/transacoes`)).json()
  })));

  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Arquivos separados por cartão</h2>
        <p>Baixe um CSV só com as transações de cada cartão desta importação.</p>
      </div>
    </div>
    <div class="fatura-cartoes-lista">
      ${porCartao.map((item, index) => `
        <button class="btn btn-secondary" type="button" data-indice="${index}">Baixar CSV - ${escapeHtml(item.cartao)} (${item.transacoes.length})</button>
      `).join("")}
    </div>
  `;

  container.querySelectorAll("button[data-indice]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const item = porCartao[Number(botao.dataset.indice)];
      const nomeArquivo = `fatura-${item.cartao.toLowerCase().replaceAll(" ", "-")}-${anoReferencia}-${String(mesReferencia).padStart(2, "0")}.csv`;
      baixarArquivoTexto(nomeArquivo, gerarCsvTransacoes(item.transacoes));
    });
  });
}

function renderResultadoConciliacao(data) {
  const container = document.getElementById("resultadoConciliacao");
  const pendencias = data.pendencias || [];
  container.classList.remove("hidden");

  if (!pendencias.length) {
    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2>Conciliação concluída</h2>
          <p>${data.processadas || 0} transação(ões) processada(s). Nenhuma pendência encontrada.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Pendências encontradas</h2>
        <p>${pendencias.length} item(ns) precisam de revisão após a conciliação.</p>
      </div>
      <a class="btn btn-secondary" href="compras-pendentes.html?tab=conciliacao">Ver conciliação</a>
    </div>
    <div class="pending-list">
      ${pendencias.map((pendencia) => `
        <div class="pending-item">
          <div>
            <span class="${classeStatus(pendencia.status)}">${escapeHtml(rotuloPendencia(pendencia.status))}</span>
            <strong>${escapeHtml(pendencia.estabelecimento || "-")} - ${moeda(pendencia.valor)}</strong>
            <p>${formatarData(pendencia.dataTransacao)} - ${escapeHtml(pendencia.cartao || "-")} - ${escapeHtml(pendencia.departamento || "-")}</p>
            <p>${escapeHtml(detalheCompraEncontrada(pendencia))}</p>
          </div>
          <a class="btn btn-primary" href="${linkResolucaoPendencia(pendencia)}">Resolver</a>
        </div>
      `).join("")}
    </div>
  `;
}

const CORES_BANCO_FATURA = {
  bradesco: "#cc092f",
  inter: "#ff7a00",
  "itaú": "#ec7000",
  itau: "#ec7000",
  santander: "#ec0000",
  nubank: "#8a05be",
  "banco do brasil": "#e8b400",
  caixa: "#0066b3",
  sicoob: "#00a651",
  sicredi: "#6dbb45"
};
const CORES_BANCO_FATURA_FALLBACK = ["#2563eb", "#0f766e", "#7c3aed", "#0891b2", "#b45309", "#334155"];

function corBadgeCartaoFatura(banco) {
  const chave = String(banco || "").trim().toLowerCase();
  if (CORES_BANCO_FATURA[chave]) return CORES_BANCO_FATURA[chave];
  let hash = 0;
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) >>> 0;
  return CORES_BANCO_FATURA_FALLBACK[hash % CORES_BANCO_FATURA_FALLBACK.length];
}

function iconeArquivoFaturaInfo(nomeArquivo) {
  const extensao = String(nomeArquivo || "").split(".").pop().toLowerCase();
  if (extensao === "csv") return { cor: "#16a34a", fundo: "rgba(22,163,74,.14)", rotulo: "CSV" };
  if (extensao === "pdf") return { cor: "#dc2626", fundo: "rgba(220,38,38,.14)", rotulo: "PDF" };
  return { cor: "#64748b", fundo: "rgba(100,116,139,.14)", rotulo: "ARQ" };
}

function statusFaturaInfo(status) {
  if (status === "conciliada") return { classe: "status-dot status-ok", rotulo: "Conciliada" };
  if (status === "com_pendencias") return { classe: "status-dot status-pending", rotulo: "Com pendências" };
  return { classe: "status-dot status-warning", rotulo: "Processando" };
}

function statusFaturaNormalizado(status) {
  if (status === "conciliada") return "conciliada";
  if (status === "com_pendencias") return "com_pendencias";
  return "processando";
}

function formatarDataImportacaoRelativa(valor) {
  if (!valor) return "-";
  const texto = String(valor).trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "-";
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diaData = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diffDias = Math.round((hoje - diaData) / 86400000);
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  if (diffDias === 0) return `Hoje, ${hora}:${minuto}`;
  if (diffDias === 1) return `Ontem, ${hora}:${minuto}`;
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function faturaCorrespondeMesAno(fatura, filtro) {
  const texto = String(filtro || "").trim();
  if (!texto) return true;
  const partes = texto.split("/").map((parte) => parte.trim()).filter(Boolean);
  if (partes.length === 2) {
    const [mes, ano] = partes;
    return String(fatura.mes_referencia).padStart(2, "0") === mes.padStart(2, "0") && String(fatura.ano_referencia) === ano;
  }
  if (partes.length === 1) {
    const valor = partes[0];
    if (valor.length === 4) return String(fatura.ano_referencia) === valor;
    return String(fatura.mes_referencia).padStart(2, "0") === valor.padStart(2, "0");
  }
  return true;
}

function faturasFiltradas() {
  const cartaoId = document.getElementById("filtroFaturaCartao").value;
  const status = document.getElementById("filtroFaturaStatus").value;
  const mesAno = document.getElementById("filtroFaturaMesAno").value;
  const arquivo = document.getElementById("filtroFaturaArquivo").value.trim().toLowerCase();

  return faturasCache.filter((fatura) => {
    if (cartaoId && String(fatura.cartao_id) !== cartaoId) return false;
    if (status && statusFaturaNormalizado(fatura.status) !== status) return false;
    if (!faturaCorrespondeMesAno(fatura, mesAno)) return false;
    if (arquivo && !String(fatura.arquivo_nome || "").toLowerCase().includes(arquivo)) return false;
    return true;
  });
}

function ordenarFaturasLista(lista) {
  const [campo, direcao] = faturasOrdenacaoAtual.split("_");
  const sinal = direcao === "asc" ? 1 : -1;
  const copia = [...lista];
  copia.sort((a, b) => {
    if (campo === "cartao") return sinal * String(a.cartao || "").localeCompare(String(b.cartao || ""));
    if (campo === "periodo") return sinal * ((a.ano_referencia * 100 + Number(a.mes_referencia)) - (b.ano_referencia * 100 + Number(b.mes_referencia)));
    if (campo === "arquivo") return sinal * String(a.arquivo_nome || "").localeCompare(String(b.arquivo_nome || ""));
    if (campo === "status") return sinal * String(a.status || "").localeCompare(String(b.status || ""));
    return sinal * (new Date(a.data_importacao) - new Date(b.data_importacao));
  });
  return copia;
}

function atualizarIndicadoresOrdenacaoFaturas() {
  const [campoAtivo] = faturasOrdenacaoAtual.split("_");
  document.querySelectorAll(".invoices-sort-th").forEach((botao) => {
    botao.classList.toggle("active", botao.dataset.campo === campoAtivo);
  });
  const dropdown = document.getElementById("ordenacaoFaturas");
  if ([...dropdown.options].some((opcao) => opcao.value === faturasOrdenacaoAtual)) {
    dropdown.value = faturasOrdenacaoAtual;
  }
}

function definirOrdenacaoFaturasPorCampo(campo) {
  const [campoAtual, direcaoAtual] = faturasOrdenacaoAtual.split("_");
  const direcaoPadrao = campo === "cartao" || campo === "arquivo" || campo === "status" ? "asc" : "desc";
  const novaDirecao = campoAtual === campo ? (direcaoAtual === "asc" ? "desc" : "asc") : direcaoPadrao;
  faturasOrdenacaoAtual = `${campo}_${novaDirecao}`;
  faturasPaginaAtual = 1;
  renderFaturasLista();
}

function renderFaturasLista() {
  const filtradas = faturasFiltradas();
  const ordenadas = ordenarFaturasLista(filtradas);
  const total = ordenadas.length;
  const porPagina = faturasPorPaginaAtual;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  if (faturasPaginaAtual > totalPaginas) faturasPaginaAtual = totalPaginas;
  const inicio = (faturasPaginaAtual - 1) * porPagina;
  const pagina = ordenadas.slice(inicio, inicio + porPagina);

  document.getElementById("faturasContagem").textContent = `${total} fatura${total === 1 ? "" : "s"} encontrada${total === 1 ? "" : "s"}`;

  document.getElementById("faturasTabela").innerHTML = pagina.length ? pagina.map((fatura) => {
    const corBanco = corBadgeCartaoFatura(fatura.banco);
    const arquivoInfo = iconeArquivoFaturaInfo(fatura.arquivo_nome);
    const statusInfo = statusFaturaInfo(fatura.status);
    const subtituloCartao = `${fatura.banco || "Corporativo"} •••• ${fatura.ultimos4Digitos || "----"}`;
    return `
      <tr class="report-data-row">
        <td>
          <div class="invoice-card-cell">
            <span class="invoice-badge" style="background:${corBanco}">
              <svg class="icon-sm" viewBox="0 0 24 24" style="width:18px;height:18px"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></svg>
            </span>
            <span>
              <span class="invoice-card-name" title="${escapeHtml(fatura.cartao)}">${escapeHtml(fatura.cartao)}</span>
              <span class="invoice-card-sub">${escapeHtml(subtituloCartao)}</span>
            </span>
          </div>
        </td>
        <td><span class="report-number-pill">${String(fatura.mes_referencia).padStart(2, "0")}/${fatura.ano_referencia}</span></td>
        <td>
          <div class="invoice-file-cell">
            <span class="invoice-file-badge" style="background:${arquivoInfo.fundo};color:${arquivoInfo.cor}">${arquivoInfo.rotulo}</span>
            <span>
              <span class="invoice-file-name" title="${escapeHtml(fatura.arquivo_nome || "-")}">${escapeHtml(fatura.arquivo_nome || "-")}</span>
              <span class="invoice-file-sub">${fatura.total_transacoes} transação(ões)</span>
            </span>
          </div>
        </td>
        <td>${formatarDataImportacaoRelativa(fatura.data_importacao)}</td>
        <td><span class="${statusInfo.classe}">${statusInfo.rotulo}</span></td>
        <td class="actions">
          <button class="invoices-icon-btn" type="button" title="Ver transações" onclick="verTransacoesFatura(${fatura.id})">
            <svg class="icon-sm" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="invoices-icon-btn" type="button" title="Baixar transações (CSV)" onclick="baixarCsvFatura(${fatura.id})">
            <svg class="icon-sm" viewBox="0 0 24 24"><path d="M12 3v12"></path><path d="m7 11 5 5 5-5"></path><path d="M5 21h14"></path></svg>
          </button>
          ${fatura.status !== "conciliada" ? `
          <button class="invoices-icon-btn invoices-icon-btn-primary" type="button" title="Rodar conciliação novamente" onclick="rodarConciliacao(${fatura.id})">
            <svg class="icon-sm" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 3v6h-6"></path></svg>
          </button>` : ""}
        </td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6" class="empty-state">Nenhuma fatura encontrada para os filtros selecionados.</td></tr>`;

  document.getElementById("faturasPaginaAtualLabel").textContent = String(faturasPaginaAtual);
  const fimExibido = total ? Math.min(inicio + porPagina, total) : 0;
  document.getElementById("faturasPaginacaoTexto").textContent = total ? `${inicio + 1}–${fimExibido} de ${total}` : "0–0 de 0";
  document.getElementById("faturasPaginaAnterior").disabled = faturasPaginaAtual <= 1;
  document.getElementById("faturasProximaPagina").disabled = faturasPaginaAtual >= totalPaginas;
  atualizarIndicadoresOrdenacaoFaturas();
}

async function baixarCsvFatura(id) {
  const fatura = faturasCache.find((item) => item.id === id);
  if (!fatura) return;
  const transacoes = await (await fetch(`/api/faturas-cartao/${id}/transacoes`)).json();
  const nomeArquivo = `fatura-${String(fatura.cartao || "cartao").toLowerCase().replaceAll(" ", "-")}-${fatura.ano_referencia}-${String(fatura.mes_referencia).padStart(2, "0")}.csv`;
  baixarArquivoTexto(nomeArquivo, gerarCsvTransacoes(transacoes));
}

function configurarListaFaturas() {
  const aplicarFiltro = () => {
    faturasPaginaAtual = 1;
    renderFaturasLista();
  };
  document.getElementById("filtroFaturaCartao").addEventListener("change", aplicarFiltro);
  document.getElementById("filtroFaturaStatus").addEventListener("change", aplicarFiltro);
  document.getElementById("filtroFaturaMesAno").addEventListener("input", aplicarFiltro);
  document.getElementById("filtroFaturaArquivo").addEventListener("input", aplicarFiltro);
  document.getElementById("btnFiltrarFaturas").addEventListener("click", aplicarFiltro);
  document.getElementById("btnLimparFiltrosFaturas").addEventListener("click", () => {
    document.getElementById("filtroFaturaCartao").value = "";
    document.getElementById("filtroFaturaStatus").value = "";
    document.getElementById("filtroFaturaMesAno").value = "";
    document.getElementById("filtroFaturaArquivo").value = "";
    aplicarFiltro();
  });
  document.getElementById("ordenacaoFaturas").addEventListener("change", (event) => {
    faturasOrdenacaoAtual = event.target.value;
    faturasPaginaAtual = 1;
    renderFaturasLista();
  });
  document.querySelectorAll(".invoices-sort-th").forEach((botao) => {
    botao.addEventListener("click", () => definirOrdenacaoFaturasPorCampo(botao.dataset.campo));
  });
  document.getElementById("faturasPorPagina").addEventListener("change", (event) => {
    faturasPorPaginaAtual = Number(event.target.value);
    faturasPaginaAtual = 1;
    renderFaturasLista();
  });
  document.getElementById("faturasPaginaAnterior").addEventListener("click", () => {
    if (faturasPaginaAtual > 1) {
      faturasPaginaAtual -= 1;
      renderFaturasLista();
    }
  });
  document.getElementById("faturasProximaPagina").addEventListener("click", () => {
    faturasPaginaAtual += 1;
    renderFaturasLista();
  });
  document.getElementById("btnIrParaImportar").addEventListener("click", () => {
    document.getElementById("importarFaturaSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function carregarFaturas() {
  const faturas = await (await fetch(`/api/faturas-cartao?usuarioId=${usuarioIdAtual()}`)).json();
  faturasCache = faturas;
  faturasPaginaAtual = 1;
  renderFaturasLista();
}

async function verTransacoesFatura(id) {
  const fatura = faturasCache.find((item) => item.id === id);
  if (!fatura) return;
  const transacoes = await (await fetch(`/api/faturas-cartao/${id}/transacoes`)).json();

  document.getElementById("faturaTransacoesConteudo").innerHTML = `
    <div class="section-header">
      <div>
        <span class="eyebrow">${escapeHtml(fatura.cartao)} · ${fatura.mes_referencia}/${fatura.ano_referencia}</span>
        <h2 id="faturaTransacoesTitulo">${escapeHtml(fatura.arquivo_nome || "Fatura")}</h2>
        <p>${fatura.transacoes_conciliadas} de ${fatura.total_transacoes} transações já conciliadas com uma compra registrada.</p>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Data</th><th>Estabelecimento</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>
          ${transacoes.length ? transacoes.map((transacao) => `
            <tr class="report-data-row">
              <td>${formatarData(transacao.data_transacao)}</td>
              <td>${escapeHtml(transacao.estabelecimento)}</td>
              <td><span class="report-money-pill">${moeda(transacao.valor)}</span></td>
              <td><span class="${classeStatus(transacao.status_conciliacao)}">${String(transacao.status_conciliacao || "-").replaceAll("_", " ")}</span></td>
            </tr>
          `).join("") : `<tr><td colspan="4" class="empty-state">Nenhuma transação nesta fatura.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById("faturaTransacoesModal").classList.remove("hidden");
}

function fecharFaturaTransacoesModal() {
  document.getElementById("faturaTransacoesModal").classList.add("hidden");
}

async function rodarConciliacao(id, opcoes = {}) {
  const res = await fetch(`/api/conciliacoes-cartao/rodar/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conciliadoPorId: usuarioIdAtual() }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (!opcoes.silencioso) {
      const mensagem = document.getElementById("faturaMensagem");
      mensagem.textContent = data.erro || "Não foi possível rodar a conciliação.";
      mensagem.classList.remove("hidden");
    }
    return null;
  }
  if (!opcoes.silencioso) {
    await carregarFaturas();
    renderResultadoConciliacao(data);
  }
  return data;
}

document.getElementById("faturaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const mensagem = document.getElementById("faturaMensagem");
  const transacoes = transacoesFaturaSelecionadas;

  if (!transacoes.length) {
    mensagem.textContent = "Anexe um arquivo CSV ou PDF com pelo menos uma transação reconhecida.";
    mensagem.classList.remove("hidden");
    return;
  }

  const cartaoIds = cartoesSelecionados();
  if (!cartaoIds.length) {
    mensagem.textContent = "Selecione o cartão.";
    mensagem.classList.remove("hidden");
    return;
  }

  const payload = {
    cartaoIds,
    mesReferencia: document.getElementById("mesReferencia").value,
    anoReferencia: document.getElementById("anoReferencia").value,
    arquivoNome: document.getElementById("arquivoNome").value,
    importadoPorId: usuarioIdAtual(),
    observacao: document.getElementById("observacao").value,
    transacoes
  };

  const res = await fetch("/api/faturas-cartao/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || "Não foi possível importar a fatura.";
    mensagem.classList.remove("hidden");
    return;
  }

  const faturas = data.faturas || [];
  const importadas = faturas.filter((item) => item.importado);
  const ignoradas = faturas.filter((item) => !item.importado);

  if (!importadas.length) {
    mensagem.textContent = ignoradas.length
      ? ignoradas.map((item) => `${item.cartao}: ${item.motivo}`).join(" ")
      : "Nenhuma fatura foi importada.";
    mensagem.classList.remove("hidden");
    return;
  }

  const pendenciasTotais = [];
  const resumoPorCartao = [];
  for (const item of importadas) {
    const resultado = await rodarConciliacao(item.faturaId, { silencioso: true });
    if (resultado) {
      pendenciasTotais.push(...(resultado.pendencias || []));
      resumoPorCartao.push(`${item.cartao}: ${resultado.pendencias?.length ? `${resultado.pendencias.length} pendência(s)` : "sem pendências"}`);
    }
  }

  let textoMensagem = `Fatura(s) importada(s) e conciliada(s). ${resumoPorCartao.join(" · ")}.`;
  if (ignoradas.length) {
    textoMensagem += ` Não importado(s): ${ignoradas.map((item) => `${item.cartao} (${item.motivo})`).join(", ")}.`;
  }
  if (data.transacoesNaoReconhecidas) {
    textoMensagem += ` ⚠️ ${data.transacoesNaoReconhecidas} transação(ões) do arquivo não correspondem ao cartão selecionado.`;
  }
  const avisosPeriodo = [...new Set(importadas.map((item) => item.avisoPeriodo).filter(Boolean))];
  if (avisosPeriodo.length) {
    textoMensagem += ` ⚠️ ${avisosPeriodo.join(" ")}`;
  }
  mensagem.textContent = textoMensagem;
  mensagem.classList.remove("hidden");
  await renderArquivosPorCartao(importadas, payload.mesReferencia, payload.anoReferencia);
  renderResultadoConciliacao({ pendencias: pendenciasTotais });

  event.target.reset();
  csvFaturaSelecionada = "";
  transacoesFaturaSelecionadas = [];
  renderPreviaFatura();
  document.getElementById("arquivoNome").value = "";
  document.getElementById("arquivoFaturaAtual").textContent = "Nenhum arquivo selecionado.";
  document.getElementById("mesReferencia").value = new Date().getMonth() + 1;
  await carregarFaturas();
});

document.getElementById("arquivoFatura").addEventListener("change", carregarArquivoFatura);
initFaturas();
