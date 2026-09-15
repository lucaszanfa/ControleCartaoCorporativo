# Controle Cartão Corporativo

Sistema web para controle de cartões corporativos: registro de compras, faturas, conciliação, pendências, relatórios e alertas no Microsoft Teams via Power Automate.

## Tecnologias

Node.js + Express + PostgreSQL (Supabase) no backend; HTML, CSS e JavaScript puro no frontend. Hospedado no Render.

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
DATABASE_URL=postgresql://usuario:senha@host:5432/postgres
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
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

PostgreSQL gerenciado (recomendado: [Supabase](https://supabase.com), plano free). As tabelas e os dados padrão (admin, cartões e bancos de exemplo) são criados automaticamente ao iniciar o servidor, a partir de `backend/sql/schema.sql`.

Configure a variável `DATABASE_URL` com a connection string direta do Postgres (Supabase → Project Settings → Database → Connection string → **URI**, não a versão com pooling/PgBouncer). Sem persistência local nenhuma — o app funciona igual local ou no Render, e os dados sobrevivem a redeploys/reinícios porque não dependem do disco do container.

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
- Comprovantes ficam salvos no **Supabase Storage** (bucket público `comprovantes`), não no disco do servidor — sobrevivem a redeploys/reinícios normalmente. `SUPABASE_SERVICE_ROLE_KEY` é secreta: nunca exponha no frontend, é usada só pelo backend para enviar os arquivos.

## Publicando mudanças

```bash
git add .
git commit -m "Descrição da alteração"
git push origin main
```

O Render faz o deploy automático a cada push na branch `main`.

## Conciliacao sem reutilizar compras

A conciliacao automatica e o vinculo manual compartilham uma transacao SQL,
com uma conexao exclusiva do pool. Os helpers run/all/get/exec usam essa conexao
nas chamadas internas, inclusive na criacao de alertas. Nenhuma mensagem externa
e enviada pela rotina de conciliacao.

- Cada transacao da fatura tem no maximo um vinculo; cada compra/parcela pode
  aparecer em apenas um vinculo, mesmo em faturas diferentes.
- Compras ja vinculadas nao entram na busca de novas correspondencias.
- Correspondencias ambiguas ficam sem vinculo, com status sem_registro e uma
  observacao de conferencia. Nenhuma compra e escolhida pela ordem da consulta.
- Para resolver: abra uma compra existente, clique em editar e salve. O modal
  de pendencias permite escolher a transacao correspondente ou salvar sem vincular.
- Vinculos concluidos sao preservados. Vinculos pendentes sao reavaliados somente
  com sua propria compra (por exemplo, depois de anexar um comprovante).
- Os extratores de faturas do Inter e Bradesco permanecem inalterados.

Na primeira conciliacao ou vinculacao manual bem-sucedida, o sistema cria indices
unicos em conciliacoes_cartao para transacao_fatura_id e compra_cartao_id nao nulo.
Antes disso, verifica duplicidades existentes. Se houver duplicidades, a operacao
e bloqueada para revisao, sem excluir ou desvincular registros automaticamente.
O usuario do banco precisa ter permissao para criar esses indices.

Nesta versao, uma trava de tabela serializa as conciliacoes e vinculacoes manuais
entre processos. Consultas continuam permitidas, mas outras escritas nessa tabela
podem aguardar a conclusao. Para volumes maiores, revisar essa granularidade.

### Testes

Execute npm test. A suite usa conexoes simuladas e armazenamento em memoria:
nao carrega credenciais, nao acessa o banco real e nao envia alertas ao Teams.
Ela cobre correspondencias, ambiguidades, repeticao, vinculos entre faturas,
resolucao manual, rollback e isolamento do contexto das conexoes concorrentes.
A verificacao de bloqueios/indices em um PostgreSQL real e o ensaio no navegador
continuam sendo etapas de homologacao antes da publicacao.

## Marcacao manual de lancamento externo

Nas telas Pesquisar compras e Registrar compra, e nos detalhes de cada compra,
o checkbox de lancamento externo informa se o registro ja foi lancado no outro
sistema da empresa. Nao chama API externa e nao altera o status de conciliacao.
Cada parcela tem uma marcacao independente. Compras existentes e novas comecam
sem marcacao; a edicao de outros campos nao redefine esse estado.

O filtro Lancamento no sistema externo permite consultar lancadas e nao lancadas.
Quem tem permissao de alterar compras do cartao pode marcar/desmarcar; usuarios
com apenas consulta visualizam o estado. As verificacoes seguem a identificacao
de usuario e as regras de cartao existentes no projeto.

A inicializacao normal do servidor adiciona as colunas de marcacao, autor, data e
versao em compras_cartao, de forma idempotente, pelo schema.sql. Reinicie o backend
para aplicar essas colunas antes de usar a nova interface. A marcacao e a auditoria
sao gravadas na mesma transacao. Uma versao desatualizada retorna conflito (409),
sem sobrescrever a alteracao de outra pessoa.

Os testes automatizados e a previa visual usam dados ficticios; nao aplicam a
migracao nem escrevem no banco real.
