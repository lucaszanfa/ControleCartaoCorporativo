function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDatePtBr(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function buildTeamsMessageHtml(payload) {
  return `
    <h2>\u26a0\ufe0f Alerta de inconsist\u00eancia em cart\u00e3o corporativo</h2>
    <p>Foi identificada uma inconsist\u00eancia relacionada a uma compra no cart\u00e3o corporativo.</p>
    <ul>
      <li><strong>Tipo:</strong> ${escapeHtml(payload.tipo_alerta)}</li>
      <li><strong>Departamento:</strong> ${escapeHtml(payload.departamento)}</li>
      <li><strong>Cart\u00e3o:</strong> ${escapeHtml(payload.cartao)} final ${escapeHtml(payload.ultimos_4_digitos)}</li>
      <li><strong>Data da compra:</strong> ${escapeHtml(payload.data_compra)}</li>
      <li><strong>Estabelecimento:</strong> ${escapeHtml(payload.estabelecimento)}</li>
      <li><strong>Valor:</strong> ${escapeHtml(money(payload.valor))}</li>
    </ul>
    <p><strong>A\u00e7\u00e3o sugerida:</strong><br>
    Verificar com o respons\u00e1vel pelo cart\u00e3o e solicitar registro, justificativa ou comprovante.</p>
    ${payload.mensagem ? `<p><strong>Detalhe:</strong><br>${escapeHtml(payload.mensagem)}</p>` : ""}
    ${payload.url_resolucao ? `<p><a href="${escapeHtml(payload.url_resolucao)}">Abrir compra no sistema</a></p>` : ""}
  `.trim();
}

function buildTeamsMessageText(payload) {
  return [
    "\u26a0\ufe0f Alerta de inconsist\u00eancia em cart\u00e3o corporativo",
    "",
    "Foi identificada uma inconsist\u00eancia relacionada a uma compra no cart\u00e3o corporativo.",
    "",
    `\u2022 Tipo: ${payload.tipo_alerta}`,
    `\u2022 Departamento: ${payload.departamento}`,
    `\u2022 Cart\u00e3o: ${payload.cartao} final ${payload.ultimos_4_digitos}`,
    `\u2022 Data da compra: ${payload.data_compra}`,
    `\u2022 Estabelecimento: ${payload.estabelecimento}`,
    `\u2022 Valor: ${money(payload.valor)}`,
    "",
    "A\u00e7\u00e3o sugerida:",
    "Verificar com o respons\u00e1vel pelo cart\u00e3o e solicitar registro, justificativa ou comprovante.",
    ...(payload.mensagem ? ["", `Detalhe: ${payload.mensagem}`] : []),
    ...(payload.url_resolucao ? ["", `Abrir compra no sistema: ${payload.url_resolucao}`] : [])
  ].join("\n");
}

async function sendTeamsAlert(alerta) {
  const destinatariosDepartamento = Array.isArray(alerta.destinatarios_departamento)
    ? alerta.destinatarios_departamento
    : [];

  const payload = {
    alerta_id: alerta.id,
    comprador_nome: alerta.comprador_nome || alerta.responsavel_cartao || "",
    comprador_email: alerta.comprador_email || alerta.responsavel_cartao_email || "",
    gerente_nome: alerta.gerente_nome || alerta.gerente || "",
    gerente_email: alerta.gerente_email || "",
    tipo_alerta: alerta.tipo_alerta,
    departamento: alerta.departamento || "",
    cartao: alerta.cartao || "",
    ultimos_4_digitos: alerta.ultimos_4_digitos || "",
    data_compra: formatDatePtBr(alerta.data_transacao || alerta.data_compra || ""),
    estabelecimento: alerta.estabelecimento || alerta.fornecedor || "",
    valor: Number(alerta.valor || 0),
    mensagem: alerta.mensagem,
    url_resolucao: alerta.url_resolucao || "",
    destinatarios_departamento: destinatariosDepartamento,
    destinatarios_departamento_emails: destinatariosDepartamento.map((usuario) => usuario.email).filter(Boolean).join(";"),
    notificar_departamento: alerta.tipo_alerta === "compra_sem_registro"
  };

  payload.mensagem_texto = buildTeamsMessageText(payload);
  payload.mensagem_html = buildTeamsMessageHtml(payload);
  payload.mensagem = payload.mensagem_texto;

  const powerAutomateUrl = alerta.tipo_alerta === "compra_sem_registro"
    ? process.env.POWER_AUTOMATE_COMPRA_SEM_REGISTRO_URL
    : process.env.POWER_AUTOMATE_ALERTA_CARTAO_URL;
  const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;

  if (alerta.tipo_alerta === "compra_sem_registro" && !powerAutomateUrl) {
    throw new Error("Configure POWER_AUTOMATE_COMPRA_SEM_REGISTRO_URL no .env para enviar alertas de compra sem registro.");
  }

  if (!powerAutomateUrl && !teamsWebhookUrl) {
    console.log("[Teams mock] Alerta enviado:", payload);
    return { simulated: true, provider: "mock" };
  }

  const response = await fetch(powerAutomateUrl || teamsWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(powerAutomateUrl ? payload : { text: payload.mensagem_texto })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar alerta para o Teams/Power Automate. Status ${response.status}. ${body}`);
  }

  return {
    simulated: false,
    provider: powerAutomateUrl ? "power_automate" : "teams_webhook",
    automation: alerta.tipo_alerta === "compra_sem_registro" ? "compra_sem_registro" : "alerta_cartao"
  };
}

module.exports = { sendTeamsAlert };
