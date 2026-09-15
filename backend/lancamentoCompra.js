function erroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function mapLancamento(compra, nomeUsuario) {
  return {
    id: compra.id,
    lancadoExternamente: Boolean(compra.lancado_externamente),
    lancamentoAtualizadoPorId: compra.lancamento_atualizado_por_id || null,
    lancamentoAtualizadoPor: nomeUsuario || compra.lancamento_atualizado_por || null,
    lancamentoAtualizadoEm: compra.lancamento_atualizado_em || null,
    lancamentoVersao: compra.lancamento_versao || 0
  };
}

function criarAtualizadorLancamento({ db, cartoesPermitidosParaUsuario, registrarAuditoria }) {
  return async function atualizarLancamento({ compraId, usuarioId, lancado, versao }) {
    if (!Number.isSafeInteger(compraId) || compraId <= 0 || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      throw erroHttp(400, 'Compra e usuário válidos são obrigatórios.');
    }
    if (typeof lancado !== 'boolean' || !Number.isSafeInteger(versao) || versao < 0) {
      throw erroHttp(400, 'Informe a marcação e a versão atual da compra.');
    }
    return db.withTransaction(async () => {
      const usuario = await db.get('SELECT id, nome, status FROM usuarios WHERE id = ?', [usuarioId]);
      if (!usuario || usuario.status !== 'ativo') throw erroHttp(403, 'Usuário sem acesso ativo.');
      const compra = await db.get('SELECT * FROM compras_cartao WHERE id = ? FOR UPDATE', [compraId]);
      if (!compra) throw erroHttp(404, 'Compra não encontrada.');
      const permitidos = await cartoesPermitidosParaUsuario(usuarioId, 'cadastrar');
      if (permitidos !== null && !permitidos.includes(Number(compra.cartao_id))) {
        throw erroHttp(403, 'Você não tem permissão para alterar compras deste cartão.');
      }
      if (Number(compra.lancamento_versao || 0) !== versao) {
        throw erroHttp(409, 'Outra pessoa atualizou esta marcação. Atualize a lista antes de tentar novamente.');
      }
      if (Boolean(compra.lancado_externamente) === lancado) {
        const autor = compra.lancamento_atualizado_por_id
          ? await db.get('SELECT nome FROM usuarios WHERE id = ?', [compra.lancamento_atualizado_por_id]) : null;
        return mapLancamento(compra, autor?.nome);
      }
      const atualizada = await db.get(
        'UPDATE compras_cartao SET lancado_externamente = ?, lancamento_atualizado_por_id = ?, lancamento_atualizado_em = CURRENT_TIMESTAMP, lancamento_versao = lancamento_versao + 1 WHERE id = ? RETURNING *',
        [lancado, usuarioId, compraId]
      );
      await registrarAuditoria({
        entidade: 'compra_cartao', entidadeId: compraId, acao: 'edicao', usuarioId,
        alteracoes: [{ campo: 'Lançamento no sistema externo', de: compra.lancado_externamente ? 'Lançado' : 'Não lançado', para: lancado ? 'Lançado' : 'Não lançado' }]
      });
      return mapLancamento(atualizada, usuario.nome);
    });
  };
}
module.exports = { criarAtualizadorLancamento, mapLancamento };
