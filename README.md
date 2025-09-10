# Painel Privado – Square Cloud

Este repositório contém um esqueleto completo (backend + script de importação) para o painel VIP sem banco de dados.

## Uso rápido

```bash
npm install
node scripts/csv_to_yaml.js UNIMED_15072025_ocorrencias_.csv
ADMIN_HASH=$(npx bcrypt-cli suaSenhaSegura) JWT_SECRET=segredo node src/server/index.js
```

Depois, acesse `http://localhost:3000`.
