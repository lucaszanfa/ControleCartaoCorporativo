const db = require("./db");

// Serializa os fluxos automatico e manual, inclusive entre processos.
// A trava tambem impede escritas concorrentes durante a verificacao do legado.
async function withConciliacao(callback) {
  return db.withTransaction(async () => {
    await db.exec("LOCK TABLE conciliacoes_cartao IN SHARE ROW EXCLUSIVE MODE");
    const duplicada = await db.get(`
      SELECT 1 AS duplicada FROM conciliacoes_cartao
      GROUP BY transacao_fatura_id HAVING COUNT(*) > 1
      UNION ALL
      SELECT 1 AS duplicada FROM conciliacoes_cartao
      WHERE compra_cartao_id IS NOT NULL
      GROUP BY compra_cartao_id HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicada) {
      const error = new Error("Existem vinculos duplicados de conciliacao. Revise os vinculos existentes antes de conciliar; nenhum dado foi desvinculado automaticamente.");
      error.status = 409;
      throw error;
    }
    // Migracao nao destrutiva: so instala as garantias quando os dados permitem.
    await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS conciliacao_transacao_unica ON conciliacoes_cartao (transacao_fatura_id)");
    await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS conciliacao_compra_unica ON conciliacoes_cartao (compra_cartao_id) WHERE compra_cartao_id IS NOT NULL");
    return callback();
  });
}

function selecionarCorrespondencia(transacao, compras, { daysDiff, similarText }) {
  const mesmoValor = (compra) => Number(compra.valor) === Number(transacao.valor);
  const dataProxima = (compra) => Math.abs(daysDiff(transacao.data_transacao, compra.data_compra)) <= 2;
  const mesmoFornecedor = (compra) => similarText(transacao.estabelecimento, compra.fornecedor);
  const grupos = [
    { status: "exata", compras: compras.filter((c) => mesmoValor(c) && dataProxima(c) && mesmoFornecedor(c)) },
    { status: "valor_divergente", compras: compras.filter((c) => dataProxima(c) && mesmoFornecedor(c)) },
    { status: "data_divergente", compras: compras.filter((c) => mesmoValor(c) && mesmoFornecedor(c)) }
  ];
  const grupo = grupos.find((item) => item.compras.length);
  if (!grupo) return { compra: null, status: "sem_registro", ambigua: false };
  if (grupo.compras.length > 1) return { compra: null, status: "sem_registro", ambigua: true };
  const compra = grupo.compras[0];
  const status = grupo.status === "exata"
    ? (compra.comprovante_url ? "conciliada" : "aguardando_comprovante")
    : grupo.status;
  return { compra, status, ambigua: false };
}

module.exports = { withConciliacao, selecionarCorrespondencia };
