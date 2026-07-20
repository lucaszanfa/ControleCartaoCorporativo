const compraAutomaticaForm = document.getElementById("compraAutomaticaForm");
const compraAutomaticaMensagem = document.getElementById("compraAutomaticaMensagem");
const cartaoTeste = document.getElementById("cartaoTeste");
let cartoesAutomaticos = [];

async function carregarCartoesAutomaticos() {
  cartoesAutomaticos = await fetch("/api/cartoes?status=ativo").then((resposta) => resposta.json());
  cartaoTeste.innerHTML = cartoesAutomaticos.map((cartao) => `
    <option value="${cartao.id}" data-final="${cartao.ultimos4Digitos}">
      ${cartao.nomeCartao} - ${cartao.departamento}
    </option>
  `).join("");
  preencherFinalCartao();
}

function preencherFinalCartao() {
  const option = cartaoTeste.options[cartaoTeste.selectedIndex];
  document.getElementById("ultimos4Digitos").value = option?.dataset.final || "";
}

async function cadastrarCompraAutomatica(event) {
  event.preventDefault();
  preencherFinalCartao();

  const payload = {
    dataCompra: document.getElementById("dataCompra").value,
    valor: document.getElementById("valor").value,
    fornecedor: document.getElementById("fornecedor").value,
    ultimos4Digitos: document.getElementById("ultimos4Digitos").value,
    codigoAutorizacao: document.getElementById("codigoAutorizacao").value,
    emailOrigemId: "teste-manual"
  };

  const resposta = await fetch("/api/compras-cartao/automatica", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const dados = await resposta.json().catch(() => ({}));

  compraAutomaticaMensagem.textContent = dados.mensagem || dados.erro || "Não foi possível cadastrar a compra automática.";
  if (dados.compraId) {
    compraAutomaticaMensagem.textContent += ` ID da compra: ${dados.compraId}.`;
  }
  if (dados.detalhe) {
    compraAutomaticaMensagem.textContent += ` Detalhe: ${dados.detalhe}`;
  }
  compraAutomaticaMensagem.classList.remove("hidden");

  if (resposta.ok) {
    compraAutomaticaForm.reset();
    document.getElementById("dataCompra").value = new Date().toISOString().slice(0, 10);
    preencherFinalCartao();
  }
}

cartaoTeste.addEventListener("change", preencherFinalCartao);
compraAutomaticaForm.addEventListener("submit", cadastrarCompraAutomatica);
document.getElementById("dataCompra").value = new Date().toISOString().slice(0, 10);
carregarCartoesAutomaticos();
