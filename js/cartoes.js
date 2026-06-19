let cartoes = [];
const formCard = document.getElementById("cartaoFormCard");
const form = document.getElementById("cartaoForm");
const msg = document.getElementById("cartaoMensagem");

async function initCartoes() {
  const setoresDetalhados = await (await fetch("/api/setores-detalhados")).json();
  preencherSelect(document.getElementById("departamentoId"), setoresDetalhados, "id", "nome");
  preencherSelect(document.getElementById("filtroDepartamento"), setoresDetalhados, "id", "nome", "Todos");
  preencherSelect(document.getElementById("responsavelId"), usuarios, "id", "nome");
  preencherSelect(document.getElementById("gerenteId"), usuarios, "id", "nome");
  await carregarCartoes();
}

async function carregarCartoes() {
  const qs = new URLSearchParams();
  if (document.getElementById("filtroDepartamento").value) qs.set("departamentoId", document.getElementById("filtroDepartamento").value);
  if (document.getElementById("filtroStatus").value) qs.set("status", document.getElementById("filtroStatus").value);
  cartoes = await (await fetch(`/api/cartoes?${qs}`)).json();
  document.getElementById("cartoesTabela").innerHTML = cartoes.map((cartao) => `
    <tr class="report-data-row ${cartao.status === "inativo" ? "row-inactive" : ""}">
      <td><strong>${cartao.nomeCartao}</strong></td><td>${cartao.departamento}</td><td>${cartao.responsavel}</td><td>${cartao.gerente}</td>
      <td><span class="report-number-pill">${cartao.ultimos4Digitos}</span></td><td><span class="report-money-pill">${moeda(cartao.limiteMensal)}</span></td><td><span class="${classeStatus(cartao.status)}">${cartao.status}</span></td>
      <td><div class="actions"><button class="btn btn-secondary" onclick="editarCartao(${cartao.id})">Editar</button><button class="btn btn-danger" onclick="alternarCartao(${cartao.id}, '${cartao.status}')">${cartao.status === "ativo" ? "Inativar" : "Ativar"}</button></div></td>
    </tr>
  `).join("");
}

function editarCartao(id) {
  const cartao = cartoes.find((item) => item.id === id);
  document.getElementById("cartaoId").value = cartao.id;
  document.getElementById("nomeCartao").value = cartao.nomeCartao;
  document.getElementById("departamentoId").value = cartao.departamentoId;
  document.getElementById("responsavelId").value = cartao.responsavelId;
  document.getElementById("gerenteId").value = cartao.gerenteId;
  document.getElementById("ultimos4Digitos").value = cartao.ultimos4Digitos;
  document.getElementById("limiteMensal").value = cartao.limiteMensal || "";
  document.getElementById("status").value = cartao.status;
  document.getElementById("observacao").value = cartao.observacao;
  formCard.classList.remove("hidden");
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
  const res = await fetch(id ? `/api/cartoes/${id}` : "/api/cartoes", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  msg.textContent = data.erro || data.mensagem || "Cartão salvo.";
  msg.classList.remove("hidden");
  if (res.ok) {
    form.reset();
    formCard.classList.add("hidden");
    await carregarCartoes();
  }
});

document.getElementById("novoCartaoBtn").addEventListener("click", () => { form.reset(); formCard.classList.remove("hidden"); });
document.getElementById("cancelarCartaoBtn").addEventListener("click", () => formCard.classList.add("hidden"));
document.getElementById("filtroDepartamento").addEventListener("change", carregarCartoes);
document.getElementById("filtroStatus").addEventListener("change", carregarCartoes);
initCartoes();
