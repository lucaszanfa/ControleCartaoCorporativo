async function initConciliacao() {
  const cartoes = await (await fetch("/api/cartoes")).json();
  preencherSelect(document.getElementById("filtroCartao"), cartoes, "id", "nomeCartao", "Todos");
  await carregarConciliacoes();
}

async function carregarConciliacoes() {
  const qs = new URLSearchParams();
  if (document.getElementById("filtroStatus").value) qs.set("status", document.getElementById("filtroStatus").value);
  if (document.getElementById("filtroCartao").value) qs.set("cartaoId", document.getElementById("filtroCartao").value);
  const rows = await (await fetch(`/api/conciliacoes-cartao?${qs}`)).json();
  document.getElementById("conciliacoesTabela").innerHTML = rows.map((row) => `
    <tr class="${row.status === "sem_registro" || row.status.includes("divergente") ? "row-inactive" : ""}">
      <td>${formatarData(row.data_transacao)}</td><td>${row.estabelecimento}</td><td>${moeda(row.valor_fatura)}</td><td>${row.cartao}</td>
      <td>${row.compra_fornecedor || "-"}</td><td>${row.responsavel || "-"}</td><td><span class="status">${row.status}</span></td>
      <td><button class="btn btn-secondary" onclick="resolverConciliacao(${row.id})">Resolver</button></td>
    </tr>
  `).join("");
}

async function resolverConciliacao(id) {
  const observacao = prompt("Observação de resolução:");
  if (!observacao) return;
  await fetch(`/api/conciliacoes-cartao/${id}/resolver`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observacao, usuarioId: usuarioIdAtual() }) });
  await carregarConciliacoes();
}

document.getElementById("filtroStatus").addEventListener("change", carregarConciliacoes);
document.getElementById("filtroCartao").addEventListener("change", carregarConciliacoes);
initConciliacao();
