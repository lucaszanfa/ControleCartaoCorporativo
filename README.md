# Controle Cartão Corporativo

Sistema web para controle de cartões corporativos: registro de compras, faturas, conciliação, pendências, relatórios e alertas no Microsoft Teams via Power Automate.

## Tecnologias

Node.js + Express + SQLite no backend; HTML, CSS e JavaScript puro no frontend. Hospedado no Render.

## Rodando localmente

```bash
npm install
npm start
```

Acesse `http://localhost:3010/login.html` (porta padrão 3010, ajustável pela variável `PORT`).

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (nunca suba esse arquivo pro GitHub):

```env
HOST=0.0.0.0
PORT=3010
APP_BASE_URL=http://localhost:3010
COMPRA_AUTOMATICA_API_KEY=

TEAMS_WEBHOOK_URL=
POWER_AUTOMATE_ALERTA_CARTAO_URL=
POWER_AUTOMATE_COMPRA_SEM_REGISTRO_URL=
POWER_AUTOMATE_COMPRA_SEM_COMPROVANTE_URL=
POWER_AUTOMATE_COMPRA_AUTOMATICA_CADASTRADA_URL=
```

`COMPRA_AUTOMATICA_API_KEY` protege a rota de compra automática (veja abaixo). Sem essa variável definida, a rota aceita chamadas sem chave — útil para testar localmente, mas deve ser configurada em produção.

No Render, cadastre as mesmas variáveis em **Service → Environment**.

## Banco de dados

SQLite local em `backend/database.sqlite`, criado e atualizado automaticamente ao iniciar o servidor (tabelas, colunas novas e dados padrão como bancos e categorias). Funciona bem para o volume atual; se o uso crescer bastante, vale migrar para um banco gerenciado (Postgres/MySQL).

## Deploy no Render

- Build command: `npm install`
- Start command: `npm start`
- Node: versão 22 (definida em `.node-version`)

Depois do deploy, o sistema fica disponível numa URL HTTPS do Render — é essa URL que o Power Automate deve chamar.

## Integração com Power Automate

**Cadastro automático de compra por e-mail** — a automação lê o e-mail e chama:

```
POST /api/compras-cartao/automatica
Content-Type: application/json
x-api-key: <COMPRA_AUTOMATICA_API_KEY>
```

```json
{
  "dataCompra": "07/05/2026",
  "valor": "132,50",
  "fornecedor": "Kalunga",
  "ultimos4Digitos": "4821",
  "codigoAutorizacao": "AUT123456",
  "parcelas": "",
  "bancos": "Itaú",
  "emailOrigemId": "..."
}
```

`parcelas` e `bancos` são opcionais. O sistema procura o cartão ativo pelos últimos 4 dígitos (usando o banco informado para desempatar quando dois cartões têm o mesmo final), cadastra a compra com status pendente e deixa responsável, motivo e comprovante para conclusão manual depois.

Numa compra cadastrada automaticamente, os campos **cartão, departamento, data, valor e fornecedor** ficam protegidos e não podem ser alterados ao completar o cadastro.

**Alerta no Teams após compra automática:** configure `POWER_AUTOMATE_COMPRA_AUTOMATICA_CADASTRADA_URL` com a URL do fluxo do Power Automate que recebe o aviso.

## Segurança

- Nunca suba o `.env` nem exponha URLs do Power Automate no frontend.
- Configure `COMPRA_AUTOMATICA_API_KEY` em produção e use o mesmo valor no header `x-api-key` da automação.
- Comprovantes ficam salvos em `uploads/`. No plano free do Render isso pode não persistir entre redeploys — considere um storage externo (SharePoint, OneDrive, S3) se isso virar um problema.

## Publicando mudanças

```bash
git add .
git commit -m "Descrição da alteração"
git push origin main
```

O Render faz o deploy automático a cada push na branch `main`.
