const materialSelect = document.getElementById("material");
const setorSelect = document.getElementById("setor");
const dataInput = document.getElementById("data");
const saidaForm = document.getElementById("saidaForm");
const mensagemSucesso = document.getElementById("mensagemSucesso");

function preencherFormulario() {
  materialSelect.innerHTML = materiais
    .filter((material) => material.ativo)
    .map((material) => `<option value="${material.id}">${material.nome}</option>`)
    .join("");

  setorSelect.innerHTML = setores
    .map((setor) => `<option value="${setor}">${setor}</option>`)
    .join("");

  dataInput.value = new Date().toISOString().slice(0, 10);
}

saidaForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const novaSaida = {
    materialId: Number(materialSelect.value),
    quantidade: Number(document.getElementById("quantidade").value),
    data: dataInput.value,
    setor: setorSelect.value,
    responsavel: document.getElementById("responsavel").value,
    localUso: document.getElementById("localUso").value,
    motivo: document.getElementById("motivo").value,
    observacao: document.getElementById("observacao").value
  };

  try {
    const resposta = await fetch("/api/saidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaSaida)
    });

    if (!resposta.ok) {
      throw new Error("Erro ao registrar saída.");
    }

    const resultado = await resposta.json();
    saidas.unshift({ id: resultado.id, ...novaSaida });
    mensagemSucesso.textContent = "Saída registrada com sucesso no banco de dados.";
    mensagemSucesso.classList.remove("hidden");
    saidaForm.reset();
    preencherFormulario();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    mensagemSucesso.textContent = "Não foi possível registrar no banco. Verifique se o servidor está rodando.";
    mensagemSucesso.classList.remove("hidden");
    console.error(error);
  }
});

preencherFormulario();
