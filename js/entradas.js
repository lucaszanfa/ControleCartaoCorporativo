const materialEntradaSelect = document.getElementById("materialEntrada");
const dataEntradaInput = document.getElementById("dataEntrada");
const entradaForm = document.getElementById("entradaForm");
const mensagemEntradaSucesso = document.getElementById("mensagemEntradaSucesso");

function preencherMateriaisEntrada() {
  materialEntradaSelect.innerHTML = materiais
    .filter((material) => material.ativo)
    .map((material) => `<option value="${material.id}">${material.nome} (${material.unidade})</option>`)
    .join("");

  dataEntradaInput.value = new Date().toISOString().slice(0, 10);
}

entradaForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const novaEntrada = {
    materialId: Number(materialEntradaSelect.value),
    quantidade: Number(document.getElementById("quantidadeEntrada").value),
    valorTotal: Number(document.getElementById("valorEntrada").value),
    data: dataEntradaInput.value,
    observacao: document.getElementById("observacaoEntrada").value
  };

  try {
    const resposta = await fetch("/api/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaEntrada)
    });

    if (!resposta.ok) {
      throw new Error("Erro ao registrar entrada.");
    }

    const resultado = await resposta.json();
    entradas.unshift({ id: resultado.id, ...novaEntrada });
    mensagemEntradaSucesso.textContent = "Entrada registrada com sucesso no banco de dados.";
    mensagemEntradaSucesso.classList.remove("hidden");
    entradaForm.reset();
    preencherMateriaisEntrada();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    mensagemEntradaSucesso.textContent = "Não foi possível registrar no banco. Verifique se o servidor está rodando.";
    mensagemEntradaSucesso.classList.remove("hidden");
    console.error(error);
  }
});

preencherMateriaisEntrada();
