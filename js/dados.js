let materiais = [
  { id: 1, nome: "Caneta", categoria: "Escritório", unidade: "unidade", ativo: true },
  { id: 2, nome: "Papel", categoria: "Escritório", unidade: "resma", ativo: true },
  { id: 3, nome: "Corretivo", categoria: "Escritório", unidade: "unidade", ativo: true },
  { id: 4, nome: "Marca-texto", categoria: "Escritório", unidade: "unidade", ativo: true },
  { id: 5, nome: "Café", categoria: "Copa", unidade: "pacote", ativo: true },
  { id: 6, nome: "Papel toalha", categoria: "Limpeza", unidade: "pacote", ativo: true },
  { id: 7, nome: "Detergente", categoria: "Limpeza", unidade: "unidade", ativo: true },
  { id: 8, nome: "Bucha", categoria: "Limpeza", unidade: "unidade", ativo: true },
  { id: 9, nome: "Papel higiênico", categoria: "Limpeza", unidade: "pacote", ativo: true },
  { id: 10, nome: "Bom ar", categoria: "Limpeza", unidade: "unidade", ativo: true }
];

let setores = [
  "Administrativo",
  "Financeiro",
  "Recursos Humanos",
  "Compras",
  "Recepção",
  "Operações"
];

let usuarios = [
  { id: 1, nome: "Ana Souza", email: "ana.souza@empresa.com", setor: "Administrativo" },
  { id: 2, nome: "Carlos Lima", email: "carlos.lima@empresa.com", setor: "Financeiro" },
  { id: 3, nome: "Marina Costa", email: "marina.costa@empresa.com", setor: "Recursos Humanos" },
  { id: 4, nome: "João Pereira", email: "joao.pereira@empresa.com", setor: "Compras" }
];

let saidas = [
  { id: 1, materialId: 1, quantidade: 12, data: "2026-06-03", setor: "Administrativo", responsavel: "Ana Souza", localUso: "Sala administrativa", motivo: "Reposição de mesa", observacao: "" },
  { id: 2, materialId: 2, quantidade: 8, data: "2026-06-04", setor: "Financeiro", responsavel: "Carlos Lima", localUso: "Arquivo fiscal", motivo: "Impressão de relatórios", observacao: "" },
  { id: 3, materialId: 5, quantidade: 6, data: "2026-06-05", setor: "Recepção", responsavel: "Beatriz Rocha", localUso: "Copa principal", motivo: "Consumo mensal", observacao: "Retirada programada" },
  { id: 4, materialId: 6, quantidade: 10, data: "2026-06-06", setor: "Operações", responsavel: "Rafael Mendes", localUso: "Banheiros", motivo: "Reposição", observacao: "" },
  { id: 5, materialId: 9, quantidade: 14, data: "2026-06-07", setor: "Operações", responsavel: "Rafael Mendes", localUso: "Banheiros", motivo: "Reposição", observacao: "" },
  { id: 6, materialId: 4, quantidade: 5, data: "2026-06-08", setor: "Recursos Humanos", responsavel: "Marina Costa", localUso: "Sala de treinamento", motivo: "Treinamento interno", observacao: "" },
  { id: 7, materialId: 7, quantidade: 4, data: "2026-06-09", setor: "Recepção", responsavel: "Beatriz Rocha", localUso: "Copa principal", motivo: "Limpeza", observacao: "" },
  { id: 8, materialId: 1, quantidade: 9, data: "2026-06-10", setor: "Compras", responsavel: "João Pereira", localUso: "Mesa da equipe", motivo: "Reposição", observacao: "" },
  { id: 9, materialId: 10, quantidade: 3, data: "2026-06-11", setor: "Administrativo", responsavel: "Ana Souza", localUso: "Salas de reunião", motivo: "Manutenção do ambiente", observacao: "" },
  { id: 10, materialId: 8, quantidade: 6, data: "2026-06-12", setor: "Recepção", responsavel: "Beatriz Rocha", localUso: "Copa principal", motivo: "Limpeza", observacao: "" },
  { id: 11, materialId: 2, quantidade: 6, data: "2026-05-12", setor: "Administrativo", responsavel: "Ana Souza", localUso: "Impressoras", motivo: "Rotina administrativa", observacao: "" },
  { id: 12, materialId: 5, quantidade: 4, data: "2026-05-14", setor: "Recepção", responsavel: "Beatriz Rocha", localUso: "Copa principal", motivo: "Consumo mensal", observacao: "" },
  { id: 13, materialId: 9, quantidade: 9, data: "2026-05-18", setor: "Operações", responsavel: "Rafael Mendes", localUso: "Banheiros", motivo: "Reposição", observacao: "" },
  { id: 14, materialId: 3, quantidade: 3, data: "2026-05-20", setor: "Financeiro", responsavel: "Carlos Lima", localUso: "Mesa da equipe", motivo: "Correção de documentos", observacao: "" },
  { id: 15, materialId: 7, quantidade: 5, data: "2026-04-10", setor: "Recepção", responsavel: "Beatriz Rocha", localUso: "Copa principal", motivo: "Limpeza", observacao: "" },
  { id: 16, materialId: 1, quantidade: 7, data: "2026-04-16", setor: "Recursos Humanos", responsavel: "Marina Costa", localUso: "Sala de treinamento", motivo: "Treinamento interno", observacao: "" }
];

let entradas = [
  { id: 1, materialId: 1, quantidade: 100, valorTotal: 185.00, data: "2026-06-02", observacao: "Compra mensal" },
  { id: 2, materialId: 2, quantidade: 25, valorTotal: 725.00, data: "2026-06-03", observacao: "Reposição de papel A4" },
  { id: 3, materialId: 5, quantidade: 18, valorTotal: 342.00, data: "2026-06-04", observacao: "Copa administrativa" },
  { id: 4, materialId: 6, quantidade: 30, valorTotal: 390.00, data: "2026-06-05", observacao: "Limpeza geral" },
  { id: 5, materialId: 9, quantidade: 24, valorTotal: 456.00, data: "2026-06-06", observacao: "Reposição sanitários" },
  { id: 6, materialId: 7, quantidade: 16, valorTotal: 128.00, data: "2026-06-08", observacao: "Limpeza copa" },
  { id: 7, materialId: 4, quantidade: 40, valorTotal: 220.00, data: "2026-05-07", observacao: "Treinamentos" },
  { id: 8, materialId: 2, quantidade: 20, valorTotal: 580.00, data: "2026-05-10", observacao: "Rotina administrativa" },
  { id: 9, materialId: 5, quantidade: 15, valorTotal: 285.00, data: "2026-05-12", observacao: "Copa" },
  { id: 10, materialId: 10, quantidade: 12, valorTotal: 156.00, data: "2026-05-18", observacao: "Ambientes comuns" },
  { id: 11, materialId: 1, quantidade: 80, valorTotal: 148.00, data: "2026-04-08", observacao: "Reposição inicial" },
  { id: 12, materialId: 8, quantidade: 25, valorTotal: 87.50, data: "2026-04-11", observacao: "Limpeza copa" }
];

function buscarMaterial(id) {
  return materiais.find((material) => material.id === Number(id));
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function carregarDadosDaApi() {
  try {
    const requisicao = new XMLHttpRequest();
    requisicao.open("GET", "/api/bootstrap", false);
    requisicao.send();

    if (requisicao.status >= 200 && requisicao.status < 300) {
      const dados = JSON.parse(requisicao.responseText);
      materiais = dados.materiais || materiais;
      setores = dados.setores || setores;
      usuarios = dados.usuarios || usuarios;
      saidas = dados.saidas || saidas;
      entradas = dados.entradas || entradas;
    }
  } catch (error) {
    console.warn("API indisponível. Usando dados simulados locais.", error);
  }
}

carregarDadosDaApi();
