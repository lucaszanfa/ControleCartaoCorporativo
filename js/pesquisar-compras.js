const situacoesPesquisaCompras = {
  registrada: 'Registrada', aguardando_conferencia: 'Aguardando conferência',
  conferida: 'Conferida / conciliada', divergente: 'Divergente',
  sem_comprovante: 'Sem comprovante', resolvida: 'Resolvida',
  cancelada: 'Cancelada', aguardando_fatura: 'Aguardando fatura'
};

function normalizarPesquisaCompra(valor) {
  return String(valor ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function filtrarPesquisaCompras(compras, cartoesPermitidos, filtros = {}) {
  const ids = new Set(cartoesPermitidos.map(cartao => String(cartao.id)));
  const termos = normalizarPesquisaCompra(filtros.texto).split(/\s+/).filter(Boolean);
  const fornecedor = normalizarPesquisaCompra(filtros.fornecedor);
  const pendentes = new Set(['sem_comprovante', 'aguardando_fatura', 'aguardando_conferencia', 'divergente']);
  return compras.filter(compra => {
    if (!ids.has(String(compra.cartaoId))) return false;
    if (filtros.cartao && String(compra.cartaoId) !== filtros.cartao) return false;
    const data = String(compra.dataCompra || '').slice(0, 10);
    if (filtros.inicio && data < filtros.inicio) return false;
    if (filtros.fim && data > filtros.fim) return false;
    if (filtros.status === 'pendentes' && !pendentes.has(compra.status)) return false;
    if (filtros.status && filtros.status !== 'pendentes' && compra.status !== filtros.status) return false;
    if (fornecedor && !normalizarPesquisaCompra(compra.fornecedor).includes(fornecedor)) return false;
    const texto = normalizarPesquisaCompra([
      compra.fornecedor, compra.cartao, compra.ultimos4Digitos, compra.responsavel,
      compra.departamento, compra.categoria, compra.motivo, compra.status,
      situacoesPesquisaCompras[compra.status]
    ].join(' '));
    return termos.every(termo => texto.includes(termo));
  }).sort((a, b) => String(b.dataCompra).localeCompare(String(a.dataCompra)) || Number(b.id) - Number(a.id));
}

function escaparPesquisaCompra(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function iniciarPesquisaCompras() {
  const el = id => document.getElementById(id);
  const form = el('pesquisaForm');
  const tabela = el('pesquisaTabela');
  const resumo = el('pesquisaResumo');
  const erro = el('pesquisaErro');
  const campos = el('pesquisaCampos');
  let compras = [];
  let cartoes = [];
  let filtradas = [];
  let pagina = 1;
  let carregando = false;
  const porPagina = 25;

  function mensagemErro(texto = '') {
    erro.textContent = texto;
    erro.classList.toggle('hidden', !texto);
  }

  function paginar() {
    const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
    pagina = Math.min(pagina, paginas);
    const inicio = (pagina - 1) * porPagina;
    const itens = filtradas.slice(inicio, inicio + porPagina);
    tabela.innerHTML = itens.length ? itens.map(compra => {
      const status = situacoesPesquisaCompras[compra.status] || compra.status || '-';
      const parcela = Number(compra.parcelaTotal) > 1 ? String(compra.parcelaAtual) + '/' + String(compra.parcelaTotal) : 'À vista';
      const final = compra.ultimos4Digitos ? 'Final ' + compra.ultimos4Digitos : '';
      return '<tr>' +
        '<td>' + escaparPesquisaCompra(formatarData(String(compra.dataCompra || '').slice(0,10))) + '</td>' +
        '<td><strong>' + escaparPesquisaCompra(compra.fornecedor || '-') + '</strong><small>' + escaparPesquisaCompra(compra.departamento || '') + '</small></td>' +
        '<td>' + escaparPesquisaCompra(compra.cartao || '-') + '<small>' + escaparPesquisaCompra(final) + '</small></td>' +
        '<td>' + escaparPesquisaCompra(compra.responsavel || 'Não informado') + '</td>' +
        '<td>' + escaparPesquisaCompra(parcela) + '</td><td>' + moeda(compra.valor) + '</td>' +
        '<td><span class="' + classeStatus(compra.status) + '">' + escaparPesquisaCompra(status) + '</span></td>' +
        '<td><a class="btn btn-secondary btn-compact" href="compra-cartao.html?verCompraId=' + encodeURIComponent(compra.id) + '" aria-label="Ver compra de ' + escaparPesquisaCompra(compra.fornecedor || 'fornecedor não informado') + '">Ver detalhes</a></td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty-state">' + (cartoes.length ? 'Nenhuma compra encontrada. Ajuste ou limpe os filtros.' : 'Nenhum cartão disponível para consulta. Verifique suas permissões com o administrador.') + '</td></tr>';
    el('pesquisaPagina').textContent = filtradas.length ? (inicio + 1) + '–' + (inicio + itens.length) + ' de ' + filtradas.length + ' · Página ' + pagina + ' de ' + paginas : '';
    el('pesquisaAnterior').disabled = pagina <= 1 || !filtradas.length;
    el('pesquisaProxima').disabled = pagina >= paginas || !filtradas.length;
  }

  function pesquisar() {
    if (carregando) return;
    const filtros = {
      texto: el('pesquisaTexto').value, fornecedor: el('pesquisaFornecedor').value,
      cartao: el('pesquisaCartao').value, status: el('pesquisaStatus').value,
      inicio: el('pesquisaInicio').value, fim: el('pesquisaFim').value
    };
    pagina = 1;
    if (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim) {
      mensagemErro('A data inicial deve ser anterior ou igual à data final.');
      filtradas = [];
      paginar();
      resumo.textContent = 'Revise o período informado.';
      return;
    }
    mensagemErro();
    filtradas = filtrarPesquisaCompras(compras, cartoes, filtros);
    const total = filtradas.reduce((soma, compra) => soma + (Number(compra.valor) || 0), 0);
    resumo.textContent = filtradas.length + ' compra(s) / parcela(s) · Total: ' + moeda(total);
    paginar();
  }

  async function consultar(url) {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error('Não foi possível carregar a pesquisa. Clique em Atualizar para tentar novamente.');
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error('Resposta inválida ao carregar a pesquisa. Tente novamente.');
    return dados;
  }

  async function carregar() {
    if (carregando) return;
    carregando = true;
    campos.disabled = true;
    el('pesquisaAtualizar').disabled = true;
    el('pesquisaAnterior').disabled = true;
    el('pesquisaProxima').disabled = true;
    el('pesquisaPagina').textContent = '';
    el('pesquisaResultados').setAttribute('aria-busy', 'true');
    mensagemErro();
    resumo.textContent = 'Carregando compras...';
    tabela.innerHTML = '<tr><td colspan="8" class="empty-state">Carregando...</td></tr>';
    compras = [];
    cartoes = [];
    filtradas = [];
    try {
      const id = Number(usuarioLogado?.id);
      if (!Number.isSafeInteger(id) || id <= 0 || usuarioLogado?.status !== 'ativo') throw new Error('Entre no sistema com um usuário ativo para pesquisar compras.');
      cartoes = await consultar('/api/cartoes?usuarioId=' + id + '&permissao=ver');
      const select = el('pesquisaCartao');
      const selecionado = select.value;
      select.replaceChildren(new Option('Todos os cartões permitidos', ''));
      cartoes.forEach(cartao => select.add(new Option(cartao.nomeCartao + (cartao.ultimos4Digitos ? ' · ' + cartao.ultimos4Digitos : ''), String(cartao.id))));
      select.value = cartoes.some(cartao => String(cartao.id) === selecionado) ? selecionado : '';
      if (cartoes.length) compras = await consultar('/api/compras-cartao?usuarioId=' + id);
      campos.disabled = false;
      carregando = false;
      pesquisar();
    } catch (error) {
      mensagemErro(error.message || 'Não foi possível carregar as compras.');
      resumo.textContent = 'Pesquisa indisponível.';
      tabela.innerHTML = '<tr><td colspan="8" class="empty-state">Não foi possível carregar os resultados.</td></tr>';
    } finally {
      carregando = false;
      el('pesquisaAtualizar').disabled = false;
      el('pesquisaResultados').setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); pesquisar(); });
  form.addEventListener('input', pesquisar);
  el('pesquisaLimpar').addEventListener('click', () => { form.reset(); pesquisar(); el('pesquisaTexto').focus(); });
  el('pesquisaAtualizar').addEventListener('click', carregar);
  el('pesquisaAnterior').addEventListener('click', () => { pagina -= 1; paginar(); });
  el('pesquisaProxima').addEventListener('click', () => { pagina += 1; paginar(); });
  await carregar();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { filtrarPesquisaCompras, normalizarPesquisaCompra, escaparPesquisaCompra };
if (typeof document !== 'undefined') iniciarPesquisaCompras();
