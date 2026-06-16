async function initFaturas() {
  const cartoes = await (await fetch("/api/cartoes?status=ativo")).json();
  preencherSelect(document.getElementById("cartaoId"), cartoes, "id", "nomeCartao");
  document.getElementById("mesReferencia").innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  document.getElementById("mesReferencia").value = new Date().getMonth() + 1;
  await carregarFaturas();
}

function parseCsv(texto) {
  return texto.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).map((linha) => {
    const [dataTransacao, estabelecimento, valor, ultimos4Digitos, codigoAutorizacao, categoriaDetectada] = linha.split(";").map((item) => item.trim());
    return { dataTransacao, estabelecimento, valor: Number(String(valor).replace(",", ".")), ultimos4Digitos, codigoAutorizacao, categoriaDetectada };
  });
}

async function carregarFaturas() {
  const faturas = await (await fetch("/api/faturas-cartao")).json();
  document.getElementById("faturasTabela").innerHTML = faturas.map((fatura) => `
    <tr><td>${fatura.cartao}</td><td>${fatura.mes_referencia}/${fatura.ano_referencia}</td><td>${fatura.arquivo_nome || "-"}</td><td><span class="status">${fatura.status}</span></td><td><button class="btn btn-primary" onclick="rodarConciliacao(${fatura.id})">Rodar conciliação</button></td></tr>
  `).join("");
}

async function rodarConciliacao(id) {
  await fetch(`/api/conciliacoes-cartao/rodar/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conciliadoPorId: usuarioIdAtual() }) });
  await carregarFaturas();
  alert("Conciliação executada.");
}

document.getElementById("faturaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    cartaoId: document.getElementById("cartaoId").value,
    mesReferencia: document.getElementById("mesReferencia").value,
    anoReferencia: document.getElementById("anoReferencia").value,
    arquivoNome: document.getElementById("arquivoNome").value,
    importadoPorId: usuarioIdAtual(),
    observacao: document.getElementById("observacao").value,
    transacoes: parseCsv(document.getElementById("csvTransacoes").value)
  };
  const res = await fetch("/api/faturas-cartao/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  document.getElementById("faturaMensagem").textContent = data.erro || "Fatura importada.";
  document.getElementById("faturaMensagem").classList.remove("hidden");
  if (res.ok) {
    event.target.reset();
    await initFaturas();
  }
});

initFaturas();
