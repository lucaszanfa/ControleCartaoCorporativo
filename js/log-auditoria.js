let auditoriaCache = [];

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarDataHoraAuditoria(valor) {
  if (!valor) return "-";
  const texto = String(valor).trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "-";
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}

function rotuloAcaoAuditoria(acao) {
  return acao === "criacao" ? "Criação" : acao === "edicao" ? "Edição" : acao;
}

function valorAlteracaoAuditoria(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  if (campo === "Valor") return moeda(Number(valor));
  if (campo === "Data da compra") return formatarData(valor);
  return escapeHtml(valor);
}

function renderAlteracoesAuditoria(registro) {
  if (!registro.alteracoes || !registro.alteracoes.length) return "-";
  return `<ul class="auditoria-alteracoes">${registro.alteracoes.map((alteracao) => {
    if (alteracao.de === null) {
      return `<li><strong>${escapeHtml(alteracao.campo)}:</strong> ${valorAlteracaoAuditoria(alteracao.campo, alteracao.para)}</li>`;
    }
    return `<li><strong>${escapeHtml(alteracao.campo)}:</strong> ${valorAlteracaoAuditoria(alteracao.campo, alteracao.de)} → ${valorAlteracaoAuditoria(alteracao.campo, alteracao.para)}</li>`;
  }).join("")}</ul>`;
}

async function popularFiltroUsuarioAuditoria() {
  const usuarios = await (await fetch("/api/usuarios")).json();
  document.getElementById("filtroAuditoriaUsuario").innerHTML = `
    <option value="">Todos os usuários</option>
    ${usuarios.map((usuario) => `<option value="${usuario.id}">${escapeHtml(usuario.nome)}</option>`).join("")}
  `;
}

function montarQueryStringAuditoria() {
  const params = new URLSearchParams({ usuarioId: usuarioIdAtual() });
  const acao = document.getElementById("filtroAuditoriaAcao").value;
  const usuarioFiltroId = document.getElementById("filtroAuditoriaUsuario").value;
  const dataInicial = document.getElementById("filtroAuditoriaDataInicial").value;
  const dataFinal = document.getElementById("filtroAuditoriaDataFinal").value;
  if (acao) params.set("acao", acao);
  if (usuarioFiltroId) params.set("usuarioFiltroId", usuarioFiltroId);
  if (dataInicial) params.set("dataInicial", dataInicial);
  if (dataFinal) params.set("dataFinal", dataFinal);
  return params.toString();
}

async function carregarLogAuditoria() {
  const mensagem = document.getElementById("auditoriaContagem");
  const resposta = await fetch(`/api/log-auditoria?${montarQueryStringAuditoria()}`);
  const dados = await resposta.json();

  if (!resposta.ok) {
    auditoriaCache = [];
    mensagem.textContent = dados.erro || "Não foi possível carregar o log de auditoria.";
    document.getElementById("auditoriaTabela").innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(dados.erro || "Não foi possível carregar o log de auditoria.")}</td></tr>`;
    return;
  }

  auditoriaCache = dados;
  mensagem.textContent = `${dados.length} registro${dados.length === 1 ? "" : "s"} encontrado${dados.length === 1 ? "" : "s"}`;

  document.getElementById("auditoriaTabela").innerHTML = dados.length ? dados.map((registro) => {
    const compraTexto = registro.compraFornecedor
      ? `${escapeHtml(registro.compraFornecedor)} · ${moeda(registro.compraValor)}<br><small>${escapeHtml(registro.compraCartao || "-")}</small>`
      : `<span class="field-hint">Compra #${registro.entidadeId} (removida ou indisponível)</span>`;

    return `
      <tr class="report-data-row">
        <td>${formatarDataHoraAuditoria(registro.criadoEm)}</td>
        <td>${escapeHtml(registro.usuarioNome)}</td>
        <td><span class="report-number-pill">${rotuloAcaoAuditoria(registro.acao)}</span></td>
        <td>${compraTexto}</td>
        <td>${renderAlteracoesAuditoria(registro)}</td>
        <td><a class="btn btn-secondary btn-compact" href="compra-cartao.html?compraId=${registro.entidadeId}">Ver compra</a></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6" class="empty-state">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
}

document.getElementById("btnFiltrarAuditoria").addEventListener("click", carregarLogAuditoria);
document.getElementById("btnLimparFiltrosAuditoria").addEventListener("click", () => {
  document.getElementById("filtroAuditoriaAcao").value = "";
  document.getElementById("filtroAuditoriaUsuario").value = "";
  document.getElementById("filtroAuditoriaDataInicial").value = "";
  document.getElementById("filtroAuditoriaDataFinal").value = "";
  carregarLogAuditoria();
});

(async () => {
  await popularFiltroUsuarioAuditoria();
  await carregarLogAuditoria();
})();
