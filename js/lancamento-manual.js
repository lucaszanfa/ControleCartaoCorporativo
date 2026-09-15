const LancamentoManual = (() => {
  const compras = new Map();
  const salvando = new Set();
  const avisos = new Map();
  let cartoesEditaveis = new Set();
  let permissoesCarregadas = false;
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function html(compra) {
    const id = Number(compra.id);
    compras.set(id, compra);
    const permitido = cartoesEditaveis.has(Number(compra.cartaoId));
    const emAndamento = salvando.has(id);
    const titulo = !permissoesCarregadas ? 'Carregando permissões' : !permitido ? 'Somente quem pode alterar compras deste cartão pode marcar o lançamento.' : 'Marque após lançar esta compra ou parcela no sistema externo.';
    const data = compra.lancamentoAtualizadoEm ? new Date(compra.lancamentoAtualizadoEm) : null;
    const quando = data && !Number.isNaN(data.getTime()) ? data.toLocaleString('pt-BR') : '';
    const autoria = [compra.lancamentoAtualizadoPor, quando].filter(Boolean).join(' · ');
    return '<div class="lancamento-manual" data-lancamento-compra="' + id + '">' +
      '<label title="' + escapar(titulo) + '"><input type="checkbox" data-lancamento-toggle="' + id + '" ' + (compra.lancadoExternamente ? 'checked ' : '') + (!permitido || emAndamento ? 'disabled ' : '') + 'aria-label="Lançado no sistema externo: ' + escapar(compra.fornecedor || 'compra') + '"><span>' + (emAndamento ? 'Salvando...' : compra.lancadoExternamente ? 'Lançado' : 'Não lançado') + '</span></label>' +
      (autoria ? '<small>Última alteração: ' + escapar(autoria) + '</small>' : '') +
      '<small class="lancamento-aviso" role="status">' + escapar(avisos.get(id) || '') + '</small></div>';
  }

  function atualizarControles(id) {
    document.querySelectorAll('[data-lancamento-compra]').forEach(container => {
      const compraId = Number(container.dataset.lancamentoCompra);
      if ((id === undefined || id === compraId) && compras.has(compraId)) container.outerHTML = html(compras.get(compraId));
    });
  }

  async function iniciar() {
    document.addEventListener('change', async event => {
      const input = event.target.closest('[data-lancamento-toggle]');
      if (!input) return;
      const id = Number(input.dataset.lancamentoToggle);
      const compra = compras.get(id);
      if (!compra || salvando.has(id) || !cartoesEditaveis.has(Number(compra.cartaoId))) return;
      const lancado = input.checked;
      salvando.add(id);
      avisos.delete(id);
      atualizarControles(id);
      try {
        const resposta = await fetch('/api/compras-cartao/' + id + '/lancamento-externo', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioLogadoId: Number(usuarioLogado.id), lancado, versao: Number(compra.lancamentoVersao || 0) })
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível salvar. Atualize a lista para conferir o estado atual.');
        Object.assign(compra, dados);
        compras.set(id, compra);
        avisos.set(id, 'Salvo.');
        document.dispatchEvent(new CustomEvent('lancamento-compra-atualizado', { detail: dados }));
      } catch (error) {
        avisos.set(id, error.message || 'Não foi possível confirmar a gravação. Atualize a lista.');
      } finally {
        salvando.delete(id);
        atualizarControles(id);
      }
    });
    try {
      const id = Number(usuarioLogado?.id);
      if (!Number.isSafeInteger(id) || id <= 0 || usuarioLogado?.status !== 'ativo') return;
      const resposta = await fetch('/api/cartoes?usuarioId=' + id + '&permissao=cadastrar');
      if (!resposta.ok) throw new Error('Permissões indisponíveis');
      const cartoes = await resposta.json();
      if (!Array.isArray(cartoes)) throw new Error('Permissões inválidas');
      cartoesEditaveis = new Set(cartoes.map(cartao => Number(cartao.id)));
    } catch {
      cartoesEditaveis.clear();
    } finally {
      permissoesCarregadas = true;
      atualizarControles();
    }
  }
  if (typeof document !== 'undefined') iniciar();
  return { html };
})();
