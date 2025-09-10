# AuditaAI Backend

## Como usar

1. Copie `.env.example` para `.env` e preencha com suas credenciais.
2. Instale as dependências:
   ```
   npm install
   ```
3. Rode o backend:
   ```
   npm start
   ```

O backend irá expor as rotas em http://localhost:3001/api/...

## Estrutura de pastas
- `src/app.js`: inicialização do Express
- `src/lib/db.js`: conexão MySQL direta
- `src/routes/`: rotas da API
- `src/controllers/`: lógica de cada recurso 