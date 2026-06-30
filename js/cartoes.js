let cartoes = [];
let setoresCartoes = [];
const formCard = document.getElementById("cartaoFormCard");
const form = document.getElementById("cartaoForm");
const msg = document.getElementById("cartaoMensagem");

async function initCartoes() {
  setoresCartoes = await (await fetch("/api/setores-detalhados")).json();
  preencherSelect(document.getElementById("departamentoId"), setoresCartoes, "id", "nome");
  preencherSelect(document.getElementById("filtroDepartamento"), setoresCartoes, "id", "nome", "Todos");
  preencherSelect(document.getElementById("responsavelId"), usuarios, "id", "nome");
  preencherSelect(document.getElementById("gerenteId"), usuarios, "id", "nome");
  await carregarCartoes();
}

function atualizarResumoCartoes() {
  const total = cartoes.length;
  const ativos = cartoes.filter((cartao) => cartao.status === "ativo").length;
  const limiteTotal = cartoes.reduce((soma, cartao) => soma + Number(cartao.limiteMensal || 0), 0);
  const departamentos = new Set(cartoes.map((cartao) => cartao.departamento).filter(Boolean)).size;
  const percentualAtivos = total ? Math.round((ativos / total) * 100) : 0;

  document.getElementById("cartoesResumoTotal").textContent = total;
  document.getElementById("cartoesResumoAtivos").textContent = ativos;
  document.getElementById("cartoesResumoAtivosPercentual").textContent = `${percentualAtivos}% do total`;
  document.getElementById("cartoesResumoLimite").textContent = moeda(limiteTotal);
  document.getElementById("cartoesResumoDepartamentos").textContent = departamentos;
  document.getElementById("cartoesTabelaResumo").textContent = `Exibindo ${total} de ${total} cartões`;
}

async function carregarCartoes() {
  const qs = new URLSearchParams();
  if (document.getElementById("filtroDepartamento").value) qs.set("departamentoId", document.getElementById("filtroDepartamento").value);
  if (document.getElementById("filtroStatus").value) qs.set("status", document.getElementById("filtroStatus").value);
  cartoes = await (await fetch(`/api/cartoes?${qs}`)).json();
  document.getElementById("cartoesTabela").innerHTML = cartoes.map((cartao, index) => {
    const cor = ["blue", "green", "purple", "orange"][index % 4];
    return `
      <tr class="report-data-row corporate-card-row ${cartao.status === "inativo" ? "row-inactive" : ""}">
        <td>
          <div class="corporate-card-name">
            <span class="corporate-card-icon corporate-card-icon-${cor}">▭</span>
            <strong>${cartao.nomeCartao}</strong>
          </div>
        </td>
        <td>${cartao.departamento}</td>
        <td>${cartao.responsavel}</td>
        <td>${cartao.gerente}</td>
        <td><span class="corporate-card-final">•••• ${cartao.ultimos4Digitos}</span></td>
        <td>${moeda(cartao.limiteMensal)}</td>
        <td><span class="${classeStatus(cartao.status)}">${cartao.status}</span></td>
        <td>
          <div class="actions corporate-card-actions">
            <button class="btn btn-secondary btn-compact" type="button" onclick="editarCartao(${cartao.id})">Editar</button>
            <button class="btn btn-secondary btn-compact" type="button" onclick="alternarCartao(${cartao.id}, '${cartao.status}')">
              ${cartao.status === "ativo" ? "Inativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
  atualizarResumoCartoes();
}

function editarCartao(id) {
  const cartao = cartoes.find((item) => item.id === id);
  if (!cartao) return;
  document.getElementById("cartaoId").value = cartao.id;
  document.getElementById("nomeCartao").value = cartao.nomeCartao;
  document.getElementById("departamentoId").value = cartao.departamentoId;
  document.getElementById("responsavelId").value = cartao.responsavelId;
  document.getElementById("gerenteId").value = cartao.gerenteId;
  document.getElementById("ultimos4Digitos").value = cartao.ultimos4Digitos;
  document.getElementById("limiteMensal").value = cartao.limiteMensal || "";
  document.getElementById("status").value = cartao.status;
  document.getElementById("observacao").value = cartao.observacao;
  formCard.querySelector(".section-header h2").textContent = "Editar cartão";
  formCard.classList.remove("hidden");
  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function alternarCartao(id, status) {
  if (!confirm("Confirma alterar o status deste cartão?")) return;
  await fetch(`/api/cartoes/${id}/${status === "ativo" ? "inativar" : "ativar"}`, { method: "PATCH" });
  await carregarCartoes();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("cartaoId").value;
  const payload = {
    nomeCartao: document.getElementById("nomeCartao").value,
    departamentoId: document.getElementById("departamentoId").value,
    responsavelId: document.getElementById("responsavelId").value,
    gerenteId: document.getElementById("gerenteId").value,
    ultimos4Digitos: document.getElementById("ultimos4Digitos").value,
    limiteMensal: document.getElementById("limiteMensal").value,
    status: document.getElementById("status").value,
    observacao: document.getElementById("observacao").value
  };
  const res = await fetch(id ? `/api/cartoes/${id}` : "/api/cartoes", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  msg.textContent = data.erro || data.mensagem || "Cartão salvo.";
  msg.classList.remove("hidden");
  if (res.ok) {
    form.reset();
    formCard.classList.add("hidden");
    await carregarCartoes();
  }
});

function abrirNovoCartao() {
  form.reset();
  document.getElementById("cartaoId").value = "";
  formCard.querySelector(".section-header h2").textContent = "Novo cartão";
  formCard.classList.remove("hidden");
  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("novoCartaoBtn").addEventListener("click", abrirNovoCartao);
document.getElementById("cancelarCartaoBtn").addEventListener("click", () => formCard.classList.add("hidden"));
document.getElementById("filtroDepartamento").addEventListener("change", carregarCartoes);
document.getElementById("filtroStatus").addEventListener("change", carregarCartoes);
document.getElementById("limparFiltrosCartoes").addEventListener("click", async () => {
  document.getElementById("filtroDepartamento").value = "";
  document.getElementById("filtroStatus").value = "";
  await carregarCartoes();
});
initCartoes();
