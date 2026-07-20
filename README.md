# Controle Cartao Corporativo

Sistema web dedicado ao controle de cartoes corporativos, compras, faturas, conciliacao e alertas via Microsoft Teams/Power Automate.

O projeto roda em Node.js com Express e atualmente usa SQLite como banco local. Ele tambem pode ser publicado no Render para receber chamadas HTTPS do Power Automate.

## Funcionalidades

- Login e cadastro/aprovacao de usuarios.
- Controle de cartoes corporativos: cadastro de cartoes, compras, faturas, conciliacao e relatorios.
- Compras automaticas por e-mail usando Power Automate.
- Compras pendentes de conclusao.
- Alertas para Microsoft Teams.
- Exportacao de relatorios em PDF.

## Tecnologias

- Node.js 22
- Express
- SQLite
- HTML, CSS e JavaScript puro
- Power Automate
- Microsoft Teams
- Render

## Estrutura

```txt
backend/
  config.js
  db.js
  seed.js
  server.js
  teamsNotificationService.js
  sql/schema.sql

css/
js/
img/
uploads/

*.html
package.json
README.md
```

## Requisitos

- Node.js 22 LTS ou superior.
- npm.
- Git.

## Como Rodar Localmente

Instale as dependencias:

```bash
npm install
```

Inicie o servidor:

```bash
npm start
```

Acesse:

```txt
http://localhost:3010/login.html
```

Por padrao, o servidor usa:

```txt
HOST=0.0.0.0
PORT=3010
```

## Banco De Dados Local

O banco atual fica em:

```txt
backend/database.sqlite
```

O schema principal fica em:

```txt
backend/sql/schema.sql
```

Ao iniciar o servidor, o sistema cria/atualiza as tabelas necessarias e garante dados iniciais.

Importante: SQLite local funciona bem para desenvolvimento, mas nao e o ideal para producao no Render Free, porque o arquivo pode nao persistir corretamente apos reinicios ou redeploys.

Para producao, o recomendado e migrar para um banco em nuvem, como:

- Render PostgreSQL;
- Neon PostgreSQL;
- Supabase PostgreSQL;
- Azure Database for PostgreSQL/MySQL;
- MySQL gerenciado.

## Variaveis De Ambiente

Crie um arquivo `.env` na raiz do projeto para ambiente local.

Exemplo:

```env
HOST=0.0.0.0
PORT=3010
APP_BASE_URL=http://localhost:3010

POWER_AUTOMATE_ALERTA_CARTAO_URL=
POWER_AUTOMATE_COMPRA_SEM_REGISTRO_URL=
POWER_AUTOMATE_COMPRA_SEM_COMPROVANTE_URL=
POWER_AUTOMATE_COMPRA_AUTOMATICA_CADASTRADA_URL=
TEAMS_WEBHOOK_URL=
```

No Render, essas mesmas variaveis devem ser cadastradas em:

```txt
Service > Environment > Environment Variables
```

Para producao, use:

```env
APP_BASE_URL=https://controlecartaocorporativo.onrender.com
```

Nunca suba o arquivo `.env` para o GitHub.

## Deploy No Render

Configuracao sugerida:

```txt
Runtime: Node
Build Command: npm install
Start Command: npm start
Node Version: 22
```

O arquivo `.node-version` tambem indica a versao do Node usada no deploy.

Depois do deploy, o sistema fica disponivel em uma URL HTTPS do Render, por exemplo:

```txt
https://controlecartaocorporativo.onrender.com
```

Essa URL publica e necessaria para o Power Automate chamar as APIs do sistema.

## Power Automate

### Cadastro Automatico De Compra Por E-mail

O fluxo deve:

1. Receber o e-mail da compra.
2. Extrair os dados do corpo do e-mail:
   - data da compra;
   - valor;
   - fornecedor;
   - ultimos 4 digitos do cartao;
   - codigo de autorizacao, se existir.
3. Enviar uma requisicao HTTP para o sistema.

Use a acao:

```txt
HTTP
```

Nao use `Enviar uma solicitacao HTTP` do Outlook/Graph, pois ela e para Microsoft Graph.

Metodo:

```txt
POST
```

URI em producao:

```txt
https://controlecartaocorporativo.onrender.com/api/compras-cartao/automatica
```

Headers:

```txt
Content-Type: application/json
```

Body:

```json
{
  "dataCompra": "@{variables('dataCompra')}",
  "valor": "@{variables('valorNumerico')}",
  "fornecedor": "@{variables('fornecedor')}",
  "ultimos4Digitos": "@{variables('ultimos4Digitos')}",
  "codigoAutorizacao": "@{variables('codigoAutorizacao')}",
  "emailOrigemId": "@{triggerOutputs()?['body/id']}"
}
```

Ao receber essa chamada, o sistema:

- procura um cartao ativo pelos ultimos 4 digitos;
- cadastra a compra automaticamente;
- deixa responsavel, categoria, motivo e comprovante para conclusao posterior;
- registra a observacao `Compra cadastrada automaticamente.`;
- envia alerta para o Teams, se a variavel de Power Automate estiver configurada.

### Alerta Teams Apos Compra Automatica

Configure no Render:

```env
POWER_AUTOMATE_COMPRA_AUTOMATICA_CADASTRADA_URL=https://...
```

Essa URL deve ser o endpoint gerado pelo gatilho manual/HTTP do Power Automate.

A mensagem enviada pode conter:

```txt
Compra registrada automaticamente no sistema:

Cartao:
Data da compra:
Fornecedor:
Valor:

Para concluir o registro, entre no link caso essa compra tenha sido feita por voce.
```

O link de conclusao aponta para:

```txt
{APP_BASE_URL}/compra-cartao.html?compraId={id}
```

## Regras De Compra Automatica

Quando uma compra e cadastrada automaticamente, o usuario que for concluir o cadastro nao pode alterar os dados importados do e-mail.

Campos protegidos:

- cartao;
- departamento;
- data;
- valor;
- fornecedor;
- observacao.

Campos que podem ser completados:

- responsavel;
- categoria;
- motivo;
- comprovante.

Essa protecao existe na tela e tambem no backend.

## Comprovantes

Os comprovantes enviados pelo sistema local ficam em:

```txt
uploads/
```

Em producao, o ideal e salvar comprovantes em um storage externo, como:

- SharePoint;
- OneDrive;
- Azure Blob Storage;
- Supabase Storage;
- S3 compativel.

Assim os arquivos nao dependem do disco local do servidor.

## URLs Importantes

Local:

```txt
http://localhost:3010/login.html
http://localhost:3010/compra-cartao.html
http://localhost:3010/compras-pendentes.html
```

Render:

```txt
https://controlecartaocorporativo.onrender.com/login.html
https://controlecartaocorporativo.onrender.com/compra-cartao.html
https://controlecartaocorporativo.onrender.com/compras-pendentes.html
```

API de compra automatica:

```txt
POST /api/compras-cartao/automatica
```

## Cuidados De Seguranca

- Nunca publique `.env`.
- Nunca coloque URLs secretas do Power Automate no frontend.
- Configure variaveis sensiveis apenas no ambiente do servidor.
- Para producao, adicione uma chave secreta nas rotas chamadas pelo Power Automate, por exemplo `x-api-key`.
- Use banco gerenciado em nuvem para evitar perda de dados.
- Evite expor banco de dados diretamente para usuarios ou automacoes; o acesso deve passar pelo backend.

## Fluxo De Desenvolvimento

1. Altere o codigo localmente.
2. Teste em `localhost`.
3. Rode uma checagem basica:

```bash
node --check backend/server.js
```

4. Faca commit:

```bash
git add .
git commit -m "Descricao da alteracao"
```

5. Envie para o GitHub:

```bash
git push origin main
```

6. Aguarde o deploy automatico no Render.

## Observacoes Para Producao

Para o sistema ficar mais robusto em producao, os proximos passos recomendados sao:

- migrar SQLite para PostgreSQL ou MySQL em nuvem;
- salvar comprovantes em storage externo;
- proteger APIs de automacao com token;
- criar logs de auditoria;
- criar backups automaticos;
- separar ambiente de teste e ambiente de producao.
