async function carregarAlertas() {
  const qs = new URLSearchParams();
  if (document.getElementById("filtroStatus").value) qs.set("status", document.getElementById("filtroStatus").value);
  if (document.getElementById("filtroTipo").value) qs.set("tipo", document.getElementById("filtroTipo").value);

  const rows = await (await fetch(`/api/alertas-cartao?${qs}`)).json();
  document.getElementById("alertasTabela").innerHTML = rows.length ? rows.map((row) => `
    <tr class="report-data-row ${row.status !== "resolvido" ? "row-inactive" : ""}">
      <td><strong>${row.criado_em?.slice(0, 10) || "-"}</strong></td>
      <td>${row.departamento}</td>
      <td><strong>${row.cartao || "-"}</strong></td>
      <td>${row.tipo_alerta}</td>
      <td>${row.estabelecimento || "-"}</td>
      <td><span class="report-money-pill">${moeda(row.valor)}</span></td>
      <td><span class="${classeStatus(row.status)}">${row.status}</span></td>
      <td><span class="report-number-pill">${row.enviado_teams ? "Sim" : "Não"}</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary" onclick="enviarTeams(${row.id})">Teams</button>
          <button class="btn btn-secondary" onclick="emAnalise(${row.id})">Análise</button>
          <button class="btn btn-primary" onclick="resolverAlerta(${row.id}, ${row.compra_cartao_id || "null"})">Resolver</button>
        </div>
      </td>
    </tr>
  `).join("") : '<tr><td colspan="9" class="empty-state">Nenhum alerta encontrado para os filtros selecionados.</td></tr>';
}

async function enviarTeams(id) {
  const mensagem = document.getElementById("alertaMensagem");
  try {
    mensagem.textContent = "Enviando alerta para o Power Automate...";
    mensagem.classList.remove("hidden");

    const res = await fetch(`/api/alertas-cartao/${id}/enviar-teams`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    mensagem.textContent = data.mensagem || data.erro || "Não foi possível enviar o alerta.";
    if (data.detalhe) mensagem.textContent += ` Detalhe: ${data.detalhe}`;
    await carregarAlertas();
  } catch (error) {
    mensagem.textContent = `Erro ao chamar a automação: ${error.message}`;
    mensagem.classList.remove("hidden");
  }
}

async function emAnalise(id) {
  await fetch(`/api/alertas-cartao/${id}/em-analise`, { method: "PATCH" });
  await carregarAlertas();
}

async function resolverAlerta(id, compraId) {
  const res = await fetch(`/api/alertas-cartao/${id}`);
  const alerta = await res.json().catch(() => ({}));

  if (alerta.compra_cartao_id || alerta.compra_id || compraId) {
    window.location.href = `compra-cartao.html?compraId=${alerta.compra_cartao_id || alerta.compra_id || compraId}&alertaId=${id}`;
    return;
  }

  if (alerta.transacao_fatura_id || alerta.transacao_id) {
    const params = new URLSearchParams({
      alertaId: id,
      transacaoId: alerta.transacao_fatura_id || alerta.transacao_id,
      cartaoId: alerta.cartao_id,
      departamentoId: alerta.departamento_id,
      dataCompra: alerta.data_transacao || "",
      valor: alerta.valor || "",
      fornecedor: alerta.estabelecimento || "",
      categoria: alerta.categoria_detectada || "outros"
    });
    window.location.href = `compra-cartao.html?${params.toString()}`;
    return;
  }

  const observacaoResolucao = prompt("Observação de resolução:");
  if (!observacaoResolucao) return;
  await fetch(`/api/alertas-cartao/${id}/resolver`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId: usuarioIdAtual(), observacaoResolucao })
  });
  await carregarAlertas();
}

document.getElementById("filtroStatus").addEventListener("change", carregarAlertas);
document.getElementById("filtroTipo").addEventListener("change", carregarAlertas);
carregarAlertas();
