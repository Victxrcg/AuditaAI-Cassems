require('dotenv').config();
const express = require('express');
const cors = require('cors');
const complianceRoutes = require('./routes/complianceRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api/compliance', complianceRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api', authRoutes); // Login e registro em /api/login e /api/registrar

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});