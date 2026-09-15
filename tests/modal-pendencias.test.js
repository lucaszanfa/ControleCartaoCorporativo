const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function preparar() {
  const elementos = {};
  class Elemento {
    constructor() { this.listeners = {}; this.children = []; this.value = ''; this.classList = { add() {}, remove() {} }; }
    set id(value) { elementos[value] = this; }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(event, fn) { this.listeners[event] = fn; }
    removeEventListener(event) { delete this.listeners[event]; }
    disparar(event) { this.listeners[event]?.(); }
  }
  for (const id of ['pendenciaCompatibilidadeModal', 'pendenciaCompatibilidadeConteudo', 'vincularPendenciaBtn', 'registrarNovaCompraBtn']) elementos[id] = new Elemento();
  const source = fs.readFileSync(path.join(__dirname, '../js/compra-cartao.js'), 'utf8');
  const start = source.indexOf('function escolherPendenciaCompativelModal(');
  const end = source.indexOf('\nasync function ', start);
  const context = {
    document: { getElementById: id => elementos[id] || null, createElement: () => new Elemento() },
    compraEdicaoId: 1, detalheItem: (label, value) => label + ':' + value,
    formatarData: value => value, moeda: value => String(value)
  };
  vm.runInNewContext(source.slice(start, end), context);
  return { elementos, escolher: context.escolherPendenciaCompativelModal };
}
const pendencias = [
  { id: 10, dataTransacao: '2026-09-10', estabelecimento: 'Kalunga', valor: 100 },
  { id: 20, dataTransacao: '2026-09-11', estabelecimento: 'Kalunga', valor: 100 }
];

test('modal exige escolha e retorna a segunda transacao selecionada', async () => {
  const { elementos, escolher } = preparar();
  const promise = escolher(pendencias);
  const botao = elementos.vincularPendenciaBtn;
  assert.equal(botao.disabled, true);
  const select = elementos.pendenciaCompativelSelecionada;
  select.value = '1';
  select.disparar('change');
  assert.equal(botao.disabled, false);
  assert.match(elementos.pendenciaCompatibilidadeConteudo.children[1].innerHTML, /2026-09-11/);
  botao.disparar('click');
  assert.equal((await promise).id, 20);
});

test('modal permite salvar compra existente sem vincular', async () => {
  const { elementos, escolher } = preparar();
  const promise = escolher(pendencias);
  assert.equal(elementos.registrarNovaCompraBtn.textContent, 'Salvar sem vincular');
  elementos.registrarNovaCompraBtn.disparar('click');
  assert.equal(await promise, null);
});

test('uma pendencia ainda exige confirmacao explicita', async () => {
  const { elementos, escolher } = preparar();
  const promise = escolher([pendencias[0]]);
  elementos.vincularPendenciaBtn.disparar('click');
  assert.equal((await promise).id, 10);
});
