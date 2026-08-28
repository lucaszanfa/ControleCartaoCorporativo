let csvFaturaSelecionada = "";
let transacoesFaturaSelecionadas = [];
let cartoesFaturaCache = [];
let faturasCache = [];

async function initFaturas() {
  cartoesFaturaCache = await (await fetch(`/api/cartoes?status=ativo&usuarioId=${usuarioIdAtual()}&permissao=ver`)).json();
  document.getElementById("cartaoIdLista").innerHTML = `
    <option value="">Selecione o cartão</option>
    ${cartoesFaturaCache.map((cartao) => `<option value="${cartao.id}">${escapeHtml(cartao.nomeCartao)} (final ${escapeHtml(cartao.ultimos4Digitos)})</option>`).join("")}
  `;
  document.getElementById("cartaoIdLista").addEventListener("change", renderPreviaFatura);
  document.getElementById("mesReferencia").innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  document.getElementById("mesReferencia").value = new Date().getMonth() + 1;
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

async function carregarFaturas() {
  const faturas = await (await fetch(`/api/faturas-cartao?usuarioId=${usuarioIdAtual()}`)).json();
  faturasCache = faturas;
  document.getElementById("faturasTabela").innerHTML = faturas.map((fatura) => `
    <tr class="report-data-row">
      <td><strong>${fatura.cartao}</strong></td>
      <td><span class="report-number-pill">${fatura.mes_referencia}/${fatura.ano_referencia}</span></td>
      <td>${fatura.arquivo_nome || "-"}</td>
      <td><span class="${classeStatus(fatura.status)}">${fatura.status}</span></td>
      <td class="actions">
        <button class="btn btn-secondary btn-compact" type="button" onclick="verTransacoesFatura(${fatura.id})">Ver</button>
        ${fatura.status !== "conciliada"
          ? `<button class="btn btn-primary btn-compact" type="button" onclick="rodarConciliacao(${fatura.id})">Rodar novamente</button>`
          : ""}
      </td>
    </tr>
  `).join("");
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
