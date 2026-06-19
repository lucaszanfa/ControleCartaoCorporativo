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

async function carregarArquivoFatura(event) {
  const file = event.target.files?.[0];
  const mensagem = document.getElementById("faturaMensagem");
  const arquivoAtual = document.getElementById("arquivoFaturaAtual");
  const arquivoNome = document.getElementById("arquivoNome");
  const csvTransacoes = document.getElementById("csvTransacoes");

  if (!file) {
    arquivoNome.value = "";
    arquivoAtual.textContent = "Nenhum arquivo selecionado.";
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    event.target.value = "";
    arquivoNome.value = "";
    arquivoAtual.textContent = "Nenhum arquivo selecionado.";
    mensagem.textContent = "Anexe um arquivo CSV.";
    mensagem.classList.remove("hidden");
    return;
  }

  const texto = await file.text();
  arquivoNome.value = file.name;
  arquivoAtual.textContent = `Arquivo selecionado: ${file.name}`;
  csvTransacoes.value = texto.trim();
  mensagem.textContent = "Arquivo CSV carregado. Confira a prévia antes de importar.";
  mensagem.classList.remove("hidden");
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
          <p>${data.processadas || 0} transações processadas. Nenhuma pendência encontrada.</p>
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
            <p>${formatarData(pendencia.dataTransacao)} - ${escapeHtml(pendencia.cartao || "-")} final ${escapeHtml(pendencia.ultimos4Digitos || "-")} - ${escapeHtml(pendencia.departamento || "-")}</p>
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
      <td><button class="btn btn-primary" onclick="rodarConciliacao(${fatura.id})">Rodar conciliação</button></td>
    </tr>
  `).join("");
}

async function rodarConciliacao(id) {
  const res = await fetch(`/api/conciliacoes-cartao/rodar/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conciliadoPorId: usuarioIdAtual() }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mensagem = document.getElementById("faturaMensagem");
    mensagem.textContent = data.erro || "Nao foi possivel rodar a conciliacao.";
    mensagem.classList.remove("hidden");
    return;
  }
  await carregarFaturas();
  renderResultadoConciliacao(data);
}

document.getElementById("faturaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const transacoes = parseCsv(document.getElementById("csvTransacoes").value);
  if (!transacoes.length) {
    document.getElementById("faturaMensagem").textContent = "Anexe ou preencha um CSV com pelo menos uma transação.";
    document.getElementById("faturaMensagem").classList.remove("hidden");
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
  document.getElementById("faturaMensagem").textContent = data.erro || "Fatura importada.";
  document.getElementById("faturaMensagem").classList.remove("hidden");
  if (res.ok) {
    event.target.reset();
    document.getElementById("arquivoNome").value = "";
    document.getElementById("arquivoFaturaAtual").textContent = "Nenhum arquivo selecionado.";
    await initFaturas();
  }
});

document.getElementById("arquivoFatura").addEventListener("change", carregarArquivoFatura);
initFaturas();
