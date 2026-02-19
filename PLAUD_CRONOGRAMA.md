# Integração Plaud → Cronograma

Integração com a [Plaud](https://docs.plaud.ai/documentation/get_started/overview) para criar demandas do cronograma a partir de reuniões gravadas.

## Fluxo desejado

1. **Reunião com o cliente** para definir o cronograma das demandas.
2. **Gravação com o Plaud** (app ou dispositivo).
3. **Processamento no Plaud**: transcrição e, opcionalmente, extração estruturada (AI Summary / AI ETL).
4. **No sistema**: importar pelo ID do workflow ou receber webhook → demandas criadas no cronograma.
5. **Cliente**: recebe login e senha e acessa o cronograma já preenchido.

## O que foi implementado

### Backend

- **Config** (`backend/src/config/plaud.js`): `PLAUD_BASE_URL`, `PLAUD_CLIENT_ID`, `PLAUD_SECRET_KEY`, `PLAUD_WEBHOOK_SECRET`.
- **Controller** (`backend/src/controllers/plaudController.js`):
  - **Webhook** `POST /api/plaud/webhook`: recebe eventos do Plaud (ex.: workflow concluído); verifica assinatura (se `PLAUD_WEBHOOK_SECRET` estiver definido); em evento de workflow/transcrição concluída, busca o resultado, extrai demandas e cria itens no cronograma (usa `metadata.organizacao` do workflow).
  - **GET /api/plaud/workflow/:workflowId/result**: retorna status do workflow e lista de demandas extraídas (pré-visualização).
  - **POST /api/plaud/create-from-workflow**: body `{ workflowId, organizacao, created_by? }`; busca o resultado do workflow, extrai demandas e cria no cronograma para a organização informada.
  - **GET /api/plaud/config**: retorna `{ enabled: true/false }` conforme credenciais configuradas.

### Frontend (Cronograma)

- Botão **"Importar da reunião (Plaud)"** ao lado de "Nova Demanda".
- Modal:
  - Campo **ID do workflow** (retornado pelo Plaud ao submeter o workflow).
  - **Organização (cliente)** (select; Portes vê todas, demais usuários veem só a própria).
  - **"Buscar resultado e pré-visualizar"**: chama `GET .../workflow/:id/result` e exibe a lista de demandas extraídas.
  - **"Criar demandas no cronograma"**: chama `POST .../create-from-workflow` e atualiza a lista do cronograma.

### Extração de demandas

O backend interpreta o resultado do workflow Plaud assim:

- **Tasks `ai_etl` ou `ai_summarize`**: se `result` for array ou tiver `demandas`/`items`, cada item com `titulo` (ou `title`/`nome`/`name`), opcionalmente `descricao`, `data_inicio`, `data_fim`, `responsavel`, vira uma demanda.
- **Fallback**: se houver task `audio_transcribe` com texto, as linhas do texto viram demandas (título = linha).

Para melhor resultado, configure no Plaud um workflow com **AI ETL** e um schema/prompt que devolva um JSON no formato esperado (ex.: array de objetos com `titulo`, `descricao`, `data_inicio`, `data_fim`).

## Configuração

### 1. Credenciais Plaud

- Crie um app no [portal Plaud](https://docs.plaud.ai/documentation/get_started/quickstart) e obtenha **Client ID** e **Secret Key**.
- No backend (`.env`):

```env
PLAUD_CLIENT_ID=seu_client_id
PLAUD_SECRET_KEY=sua_secret_key
PLAUD_BASE_URL=https://platform.plaud.ai
```

- Opcional (recomendado em produção para o webhook):

```env
PLAUD_WEBHOOK_SECRET=seu_webhook_secret
```

### 2. Webhook (opcional)

- No portal Plaud, cadastre um webhook com:
  - **Callback URL**: `https://seu-dominio.com/api/plaud/webhook`
  - **Eventos**: ex. conclusão de workflow / transcrição.
- Defina `PLAUD_WEBHOOK_SECRET` com o valor que o Plaud fornecer e use o mesmo no backend.
- Ao submeter um workflow, envie em **metadata** a organização do cliente (ex.: `metadata_json: { organizacao: "rede_frota" }`), para o webhook criar as demandas já vinculadas ao cliente certo.

### 3. Uso sem webhook (manual)

- Grave a reunião no Plaud e submeta o workflow (pelo app ou API).
- Copie o **ID do workflow** retornado.
- No sistema, abra **Cronograma** → **"Importar da reunião (Plaud)"** → informe o ID, selecione a organização → **Buscar resultado e pré-visualizar** → confira a lista → **Criar demandas no cronograma**.

## Referências

- [Plaud – Overview](https://docs.plaud.ai/documentation/get_started/overview)
- [Quickstart](https://docs.plaud.ai/documentation/get_started/quickstart)
- [AI Summary](https://docs.plaud.ai/documentation/capabilities/ai_summary.md)
- [AI Workflow (ETL)](https://docs.plaud.ai/documentation/capabilities/ai_workflow.md)
- [Webhooks](https://docs.plaud.ai/documentation/developer_guides/webhook_events.md)
- [Submit Workflow](https://docs.plaud.ai/api-reference/workflow/submit-workflow.md)
- [Get Workflow Result](https://docs.plaud.ai/api-reference/workflow/get-workflow-result.md)
