const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

function carregar(arquivo, mocks = {}, sufixo = '') {
  const filename = path.resolve(__dirname, '..', arquivo);
  const requireReal = createRequire(filename);
  const contexto = {
    require: Object.assign((name) => Object.hasOwn(mocks, name) ? mocks[name] : requireReal(name), { resolve: requireReal.resolve }),
    module: { exports: {} }, __dirname: path.dirname(filename),
    process, console, Buffer, URL, setTimeout, clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + sufixo, contexto, { filename });
  return contexto.module.exports;
}
module.exports = { carregar };
