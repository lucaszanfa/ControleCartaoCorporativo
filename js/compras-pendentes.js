let comprasPendentes = [];

const tabelaPendentes = document.getElementById("comprasPendentesTabela");
const filtroStatus = document.getElementById("filtroStatus");
const filtroCartao = document.getElementById("filtroCartao");
const filtroFornecedor = document.getElementById("filtroFornecedor");
const pendentesMensagem = document.getElementById("pendentesMensagem");
const teamsConfirmModal = document.getElementById("teamsConfirmModal");
const teamsConfirmCompra = document.getElementById("teamsConfirmCompra");
const teamsConfirmPendencias = document.getElementById("teamsConfirmPendencias");
const teamsConfirmDestino = document.getElementById("teamsConfirmDestino");
const teamsConfirmDescricao = document.getElementById("teamsConfirmDescricao");
const cancelarEnvioTeamsBtn = document.getElementById("cancelarEnvioTeamsBtn");
const confirmarEnvioTeamsBtn = document.getElementById("confirmarEnvioTeamsBtn");

let compraTeamsSelecionada = null;

function textoStatus(valor) {
  return String(valor || "-").replaceAll("_", " ");
}

function pendenciaBadge(pendencia) {
  return `<span class="status status-pending">${pendencia}</span>`;
}

function teamsIconHtml() {
  return `<span class="teams-button-icon" aria-hidden="true">${svgIcone("chat", "icon-sm")}</span>`;
}

function identificarPendencias(compra) {
  const pendencias = [];
  if (!compra.responsavelCompraId && !compra.responsavel) pendencias.push("Responsável");
  if (!String(compra.categoria || "").trim()) pendencias.push("Categoria");
  if (!String(compra.motivo || "").trim()) pendencias.push("Motivo");
  if (!String(compra.comprovanteUrl || "").trim()) pendencias.push("Comprovante");
  if (compra.status === "aguardando_conferencia") pendencias.push("Conferência");
  if (compra.status === "divergente") pendencias.push("Divergência");
  return [...new Set(pendencias)];
}

function compraEstaPendente(compra) {
  return ["aguardando_conferencia", "divergente", "sem_comprovante"].includes(compra.status)
    || identificarPendencias(compra).length > 0;
}

function statusAlertaParaCompra(alerta) {
  const tipo = String(alerta.tipo_alerta || "");
  if (tipo === "compra_sem_registro") return "sem_registro";
  if (tipo === "compra_sem_comprovante") return "sem_comprovante";
  if (tipo === "valor_divergente" || tipo === "data_divergente") return "divergente";
  return tipo || "pendente";
}

function pendenciasDoAlerta(alerta) {
  const status = statusAlertaParaCompra(alerta);
  const labels = {
    sem_registro: "Compra sem registro",
    sem_comprovante: "Comprovante",
    divergente: "Divergência"
  };
  return [labels[status] || "Revisão"];
}

function linkConclusao(compra) {
  if (compra.compraId) {
    const params = new URLSearchParams({ compraId: compra.compraId });
    if (compra.alertaId) params.set("alertaId", compra.alertaId);
    return `compra-cartao.html?${params.toString()}`;
  }

  if (compra.transacaoId) {
    const params = new URLSearchParams({
      transacaoId: compra.transacaoId,
      cartaoId: compra.cartaoId || "",
      departamentoId: compra.departamentoId || "",
      dataCompra: compra.dataCompra || "",
      valor: compra.valor || "",
      fornecedor: compra.fornecedor || "",
      categoria: "outros"
    });
    if (compra.alertaId) params.set("alertaId", compra.alertaId);
    return `compra-cartao.html?${params.toString()}`;
  }

  return `compra-cartao.html?compraId=${compra.id}`;
}

function alertaParaPendente(alerta) {
  return {
    id: `alerta-${alerta.id}`,
    alertaId: alerta.id,
    compraId: alerta.compra_cartao_id,
    transacaoId: alerta.transacao_fatura_id,
    cartaoId: alerta.cartao_id,
    departamentoId: alerta.departamento_id,
    cartao: alerta.cartao,
    departamento: alerta.departamento,
    ultimos4Digitos: alerta.ultimos_4_digitos,
    fornecedor: alerta.estabelecimento,
    valor: alerta.valor,
    dataCompra: alerta.data_transacao,
    status: statusAlertaParaCompra(alerta),
    pendencias: pendenciasDoAlerta(alerta),
    origem: "alerta"
  };
}

function destinoTeams(compra) {
  const temResponsavel = Boolean(compra.responsavel || compra.compradorNome || compra.compradorEmail || compra.responsavelCompraId);
  const semRegistro = compra.status === "sem_registro" || compra.origem === "alerta" && !compra.compraId;

  if (temResponsavel && !semRegistro) {
    return {
      tipo: "individual",
      titulo: compra.responsavel || compra.compradorNome || "responsavel pela compra",
      descricao: "A mensagem sera enviada individualmente para a pessoa responsavel pela compra, com o link para concluir o cadastro."
    };
  }

  return {
    tipo: "grupo",
    titulo: compra.departamento ? `grupo do departamento ${compra.departamento}` : `grupo do cartao ${compra.cartao || "-"}`,
    descricao: "Como a compra nao tem responsavel definido ou veio como sem registro, a mensagem sera enviada para o grupo responsavel pelo cartao/departamento."
  };
}

function atualizarResumo(lista) {
  document.getElementById("resumoPendentes").textContent = lista.length;
  document.getElementById("resumoSemComprovante").textContent = lista.filter((compra) => compra.pendencias.includes("Comprovante")).length;
  document.getElementById("resumoConferencia").textContent = lista.filter((compra) => compra.status === "aguardando_conferencia").length;
  document.getElementById("resumoDivergentes").textContent = lista.filter((compra) => compra.status === "divergente").length;
}

function comprasFiltradas() {
  const status = filtroStatus.value;
  const cartaoId = filtroCartao.value;
  const fornecedor = filtroFornecedor.value.trim().toLowerCase();

  return comprasPendentes.filter((compra) => {
    const correspondeStatus = !status || compra.status === status;
    const correspondeCartao = !cartaoId || String(compra.cartaoId) === cartaoId;
    const correspondeFornecedor = !fornecedor || String(compra.fornecedor || "").toLowerCase().includes(fornecedor);
    return correspondeStatus && correspondeCartao && correspondeFornecedor;
  });
}

function renderizarPendentes() {
  const lista = comprasFiltradas();
  atualizarResumo(lista);

  if (!lista.length) {
    tabelaPendentes.innerHTML = `<tr><td class="empty-state" colspan="7">Nenhuma compra pendente encontrada.</td></tr>`;
    return;
  }

  tabelaPendentes.innerHTML = lista.map((compra) => `
    <tr class="report-data-row ${["divergente", "sem_comprovante", "sem_registro"].includes(compra.status) ? "row-inactive" : ""}">
      <td><strong>${formatarData(compra.dataCompra)}</strong></td>
      <td><strong>${compra.cartao || "-"}</strong></td>
      <td>${compra.fornecedor || "-"}</td>
      <td><span class="report-money-pill">${moeda(compra.valor)}</span></td>
      <td><span class="${classeStatus(compra.status)}">${textoStatus(compra.status)}</span></td>
      <td>
        <div class="pending-tags">
          ${(compra.pendencias || []).map(pendenciaBadge).join("") || pendenciaBadge("Revisão")}
        </div>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary teams-icon-button enviar-teams-pendente" data-pendente-id="${compra.id}" data-alerta-id="${compra.alertaId || ""}" data-compra-id="${compra.compraId || compra.id}" type="button" title="Enviar alerta no Teams" aria-label="Enviar alerta no Teams">
            ${teamsIconHtml()}
          </button>
          <a class="btn btn-primary" href="${linkConclusao(compra)}">Concluir</a>
        </div>
      </td>
    </tr>
  `).join("");
}

function abrirConfirmacaoTeams(compra) {
  compraTeamsSelecionada = compra;
  const destino = destinoTeams(compra);
  const pendencias = (compra.pendencias || []).join(", ") || "Revisao";
  const compraTexto = `${compra.fornecedor || "Compra"} - ${moeda(compra.valor)} | ${compra.cartao || "Cartao nao informado"}`;

  teamsConfirmCompra.textContent = compraTexto;
  teamsConfirmPendencias.textContent = pendencias;
  teamsConfirmDestino.textContent = destino.titulo;
  teamsConfirmDescricao.textContent = `${destino.descricao} A automacao enviara os dados da compra, as pendencias e um atalho para a pagina de conclusao.`;
  teamsConfirmModal.classList.remove("hidden");
}

function fecharConfirmacaoTeams() {
  compraTeamsSelecionada = null;
  teamsConfirmModal.classList.add("hidden");
  confirmarEnvioTeamsBtn.disabled = false;
  confirmarEnvioTeamsBtn.textContent = "Confirmar envio";
}

async function carregarCartoesFiltro() {
  const cartoes = await fetch(`/api/cartoes?usuarioId=${usuarioIdAtual()}&permissao=ver`).then((resposta) => resposta.json());
  filtroCartao.innerHTML = [
    '<option value="">Todos os cartões</option>',
    ...cartoes.map((cartao) => `<option value="${cartao.id}">${cartao.nomeCartao}</option>`)
  ].join("");
}

async function carregarComprasPendentes() {
  let dados = [];
  let alertas = [];

  try {
    const resposta = await fetch(`/api/compras-cartao/pendentes?usuarioId=${usuarioIdAtual()}`);
    dados = await resposta.json();
    if (!resposta.ok || !Array.isArray(dados)) {
      throw new Error(dados.erro || "Rota de pendentes indisponível.");
    }
  } catch (error) {
    const respostaFallback = await fetch(`/api/compras-cartao?usuarioId=${usuarioIdAtual()}`);
    const todasCompras = await respostaFallback.json();
    dados = Array.isArray(todasCompras)
      ? todasCompras.filter(compraEstaPendente).map((compra) => ({
          ...compra,
          pendencias: identificarPendencias(compra)
        }))
      : [];

    if (!dados.length) {
      pendentesMensagem.textContent = "Não foi possível consultar a rota de pendentes. Reinicie o servidor para ativar a API nova.";
      pendentesMensagem.classList.remove("hidden");
    }
  }

  try {
    const respostaAlertas = await fetch(`/api/alertas-cartao?status=abertos&usuarioId=${usuarioIdAtual()}`);
    const dadosAlertas = await respostaAlertas.json();
    alertas = Array.isArray(dadosAlertas)
      ? dadosAlertas
          .filter((alerta) => ["compra_sem_registro", "compra_sem_comprovante", "valor_divergente", "data_divergente"].includes(alerta.tipo_alerta))
          .map(alertaParaPendente)
      : [];
  } catch (error) {
    console.warn("Nao foi possivel carregar alertas de compra pendente.", error);
  }

  const comprasMapeadas = dados.map((compra) => ({
    ...compra,
    compraId: compra.id,
    origem: "compra",
    pendencias: compra.pendencias?.length ? compra.pendencias : identificarPendencias(compra)
  }));
  const idsComAlerta = new Set(alertas.map((alerta) => alerta.compraId).filter(Boolean).map(String));

  comprasPendentes = [
    ...alertas,
    ...comprasMapeadas.filter((compra) => !idsComAlerta.has(String(compra.id)))
  ];
  renderizarPendentes();
}

async function enviarTeamsPendente({ compraId, alertaId }) {
  pendentesMensagem.textContent = "Enviando mensagem para o Power Automate...";
  pendentesMensagem.classList.remove("hidden");

  const url = alertaId
    ? `/api/alertas-cartao/${alertaId}/enviar-teams`
    : `/api/compras-cartao/${compraId}/enviar-pendencia-teams`;
  const resposta = await fetch(url, { method: "POST" });
  const dados = await resposta.json().catch(() => ({}));
  pendentesMensagem.textContent = dados.mensagem || dados.erro || "Não foi possível enviar a mensagem.";
  if (dados.detalhe) pendentesMensagem.textContent += ` Detalhe: ${dados.detalhe}`;
}

async function confirmarEnvioTeams() {
  if (!compraTeamsSelecionada) return;
  confirmarEnvioTeamsBtn.disabled = true;
  confirmarEnvioTeamsBtn.textContent = "Enviando...";

  try {
    await enviarTeamsPendente({
      compraId: compraTeamsSelecionada.compraId || compraTeamsSelecionada.id,
      alertaId: compraTeamsSelecionada.alertaId
    });
    fecharConfirmacaoTeams();
  } catch (error) {
    pendentesMensagem.textContent = "Nao foi possivel enviar a notificacao Teams.";
    pendentesMensagem.classList.remove("hidden");
    confirmarEnvioTeamsBtn.disabled = false;
    confirmarEnvioTeamsBtn.textContent = "Confirmar envio";
    console.error(error);
  }
}

[filtroStatus, filtroCartao, filtroFornecedor].forEach((campo) => {
  campo.addEventListener("input", renderizarPendentes);
  campo.addEventListener("change", renderizarPendentes);
});

tabelaPendentes.addEventListener("click", (event) => {
  const botao = event.target.closest(".enviar-teams-pendente");
  if (!botao) return;
  const compra = comprasPendentes.find((item) => String(item.id) === String(botao.dataset.pendenteId))
    || comprasPendentes.find((item) => String(item.compraId || item.id) === String(botao.dataset.compraId));
  if (!compra) return;
  abrirConfirmacaoTeams(compra);
});

cancelarEnvioTeamsBtn.addEventListener("click", fecharConfirmacaoTeams);
confirmarEnvioTeamsBtn.addEventListener("click", confirmarEnvioTeams);
teamsConfirmModal.addEventListener("click", (event) => {
  if (event.target === teamsConfirmModal) fecharConfirmacaoTeams();
});

// --- Aba "Conciliação com fatura" (antiga conciliacao-cartao.html) ---

async function initConciliacao() {
  const cartoes = await (await fetch(`/api/cartoes?usuarioId=${usuarioIdAtual()}&permissao=ver`)).json();
  preencherSelect(document.getElementById("filtroCartaoConciliacao"), cartoes, "id", "nomeCartao", "Todos os cartões");
  await carregarConciliacoes();
}

async function carregarConciliacoes() {
  const qs = new URLSearchParams();
  const status = document.getElementById("filtroStatusConciliacao").value;
  const cartaoId = document.getElementById("filtroCartaoConciliacao").value;
  if (status) qs.set("status", status);
  if (cartaoId) qs.set("cartaoId", cartaoId);
  qs.set("usuarioId", usuarioIdAtual());
  const rows = await (await fetch(`/api/conciliacoes-cartao?${qs}`)).json();
  document.getElementById("conciliacoesTabela").innerHTML = rows.map((row) => `
    <tr class="report-data-row ${row.status === "sem_registro" || row.status.includes("divergente") ? "row-inactive" : ""}">
      <td><strong>${formatarData(row.data_transacao)}</strong></td><td><strong>${row.estabelecimento}</strong></td><td><span class="report-money-pill">${moeda(row.valor_fatura)}</span></td><td>${row.cartao}</td>
      <td>${row.compra_fornecedor || "-"}</td><td>${row.responsavel || "-"}</td><td><span class="${classeStatus(row.status)}">${row.status}</span></td>
      <td><a class="btn btn-secondary" href="${linkResolverConciliacao(row)}">Resolver</a></td>
    </tr>
  `).join("");
}

function linkResolverConciliacao(row) {
  if (row.compra_cartao_id) {
    return `compra-cartao.html?compraId=${row.compra_cartao_id}`;
  }

  const params = new URLSearchParams({
    transacaoId: row.transacao_fatura_id,
    cartaoId: row.cartao_id,
    departamentoId: row.departamento_id,
    dataCompra: row.data_transacao || "",
    valor: row.valor_fatura || "",
    fornecedor: row.estabelecimento || "",
    categoria: row.categoria_detectada || "outros"
  });
  return `compra-cartao.html?${params.toString()}`;
}

document.getElementById("filtroStatusConciliacao").addEventListener("change", carregarConciliacoes);
document.getElementById("filtroCartaoConciliacao").addEventListener("change", carregarConciliacoes);

// --- Abas ---

const abaPendentesBtn = document.getElementById("abaPendentesBtn");
const abaConciliacaoBtn = document.getElementById("abaConciliacaoBtn");
const painelPendentes = document.getElementById("painelPendentes");
const painelConciliacao = document.getElementById("painelConciliacao");

let conciliacaoCarregada = false;

function mostrarAba(aba) {
  const conciliacaoPermitida = !abaConciliacaoBtn.classList.contains("hidden");
  const abaFinal = aba === "conciliacao" && conciliacaoPermitida ? "conciliacao" : "pendentes";

  abaPendentesBtn.classList.toggle("is-active", abaFinal === "pendentes");
  abaPendentesBtn.setAttribute("aria-selected", String(abaFinal === "pendentes"));
  abaConciliacaoBtn.classList.toggle("is-active", abaFinal === "conciliacao");
  abaConciliacaoBtn.setAttribute("aria-selected", String(abaFinal === "conciliacao"));
  painelPendentes.classList.toggle("hidden", abaFinal !== "pendentes");
  painelConciliacao.classList.toggle("hidden", abaFinal !== "conciliacao");

  if (abaFinal === "conciliacao" && !conciliacaoCarregada) {
    conciliacaoCarregada = true;
    initConciliacao();
  }
}

abaPendentesBtn.addEventListener("click", () => mostrarAba("pendentes"));
abaConciliacaoBtn.addEventListener("click", () => mostrarAba("conciliacao"));

function inicializarAbas() {
  if (ehAdminOuGerente() || usuarioTemCartaoComPermissao("ver")) {
    abaConciliacaoBtn.classList.remove("hidden");
  }
  const abaSolicitada = new URLSearchParams(window.location.search).get("tab");
  mostrarAba(abaSolicitada);
}

inicializarAbas();
carregarCartoesFiltro().then(carregarComprasPendentes);
