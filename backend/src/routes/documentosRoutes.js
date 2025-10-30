const express = require('express');
const router = express.Router();
const documentos = require('../controllers/documentosController');

// Middleware específico para CORS em documentos
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Rotas para documentos
router.get('/', documentos.listar);
router.post('/upload', documentos.upload.single('file'), documentos.enviar);
router.get('/:id/download', documentos.baixar);
router.delete('/:id', documentos.remover);
router.put('/:id/mover', documentos.moverDocumento);

// Rotas para pastas
router.get('/pastas', documentos.listarPastas);
router.post('/pastas', documentos.criarPasta);
router.put('/pastas/:id', documentos.atualizarPasta);
router.delete('/pastas/:id', documentos.removerPasta);

// Organizações disponíveis (Portes)
router.get('/organizacoes', documentos.listarOrganizacoes);

module.exports = router;


