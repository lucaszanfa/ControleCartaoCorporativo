let csvFaturaSelecionada = "";
let transacoesFaturaSelecionadas = [];

async function initFaturas() {
  const cartoes = await (await fetch("/api/cartoes?status=ativo")).json();
  preencherSelect(document.getElementById("cartaoId"), cartoes, "id", "nomeCartao");
  document.getElementById("mesReferencia").innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  document.getElementById("mesReferencia").value = new Date().getMonth() + 1;
  await carregarFaturas();
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
  previa.classList.remove("hidden");
  previa.innerHTML = `
    <div class="section-header">
      <div><h2>Prévia das transações</h2><p>Confira os dados reconhecidos antes de importar.</p></div>
      <strong>${transacoesFaturaSelecionadas.length} transação(ões)</strong>
    </div>
    <div class="table-wrapper"><table>
      <thead><tr><th>Data</th><th>Estabelecimento</th><th>Valor</th><th>Final</th><th>Categoria</th></tr></thead>
      <tbody>${transacoesFaturaSelecionadas.map((item) => `<tr><td>${escapeHtml(item.dataTransacao)}</td><td>${escapeHtml(item.estabelecimento)}</td><td>${moeda(item.valor)}</td><td>${escapeHtml(item.ultimos4Digitos)}</td><td>${escapeHtml(item.categoriaDetectada || "outros")}</td></tr>`).join("")}</tbody>
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

  arquivoAtual.textContent = `Processando PDF: ${file.name}...`;
  mensagem.textContent = "Extraindo as transações do PDF...";
  const resposta = await fetch("/api/faturas-cartao/extrair-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      base64: await arquivoComoDataUrl(file),
      cartaoId: document.getElementById("cartaoId").value,
      anoReferencia: document.getElementById("anoReferencia").value
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
      <a class="btn btn-secondary" href="conciliacao-cartao.html">Ver conciliação</a>
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

async function carregarFaturas() {
  const faturas = await (await fetch("/api/faturas-cartao")).json();
  document.getElementById("faturasTabela").innerHTML = faturas.map((fatura) => `
    <tr class="report-data-row">
      <td><strong>${fatura.cartao}</strong></td>
      <td><span class="report-number-pill">${fatura.mes_referencia}/${fatura.ano_referencia}</span></td>
      <td>${fatura.arquivo_nome || "-"}</td>
      <td><span class="${classeStatus(fatura.status)}">${fatura.status}</span></td>
      <td><button class="btn btn-primary" onclick="rodarConciliacao(${fatura.id})">Rodar novamente</button></td>
    </tr>
  `).join("");
}

async function rodarConciliacao(id) {
  const res = await fetch(`/api/conciliacoes-cartao/rodar/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conciliadoPorId: usuarioIdAtual() }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mensagem = document.getElementById("faturaMensagem");
    mensagem.textContent = data.erro || "Não foi possível rodar a conciliação.";
    mensagem.classList.remove("hidden");
    return null;
  }
  await carregarFaturas();
  renderResultadoConciliacao(data);
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

  const payload = {
    cartaoId: document.getElementById("cartaoId").value,
    mesReferencia: document.getElementById("mesReferencia").value,
    anoReferencia: document.getElementById("anoReferencia").value,
    arquivoNome: document.getElementById("arquivoNome").value,
    importadoPorId: usuarioIdAtual(),
    observacao: document.getElementById("observacao").value,
    transacoes
  };

  const res = await fetch("/api/faturas-cartao/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  mensagem.textContent = data.erro || "Fatura importada. Rodando conciliação automática...";
  mensagem.classList.remove("hidden");

  if (res.ok) {
    const resultado = await rodarConciliacao(data.id);
    if (resultado) {
      mensagem.textContent = resultado.pendencias?.length
        ? `Fatura importada e conciliada. ${resultado.pendencias.length} pendência(s) encontrada(s).`
        : `Fatura importada e conciliada. ${resultado.processadas || 0} transação(ões) processada(s), sem pendências.`;
    }
    event.target.reset();
    csvFaturaSelecionada = "";
    transacoesFaturaSelecionadas = [];
    renderPreviaFatura();
    document.getElementById("arquivoNome").value = "";
    document.getElementById("arquivoFaturaAtual").textContent = "Nenhum arquivo selecionado.";
    document.getElementById("mesReferencia").value = new Date().getMonth() + 1;
    await carregarFaturas();
  }
});

document.getElementById("arquivoFatura").addEventListener("change", carregarArquivoFatura);
initFaturas();
