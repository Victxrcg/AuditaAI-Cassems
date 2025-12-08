// backend/src/routes/icmsEqualizacaoRoutes.js
const express = require('express');
const router = express.Router();
const {
  listarExtratos,
  uploadExtrato,
  buscarExtrato,
  downloadExtrato,
  removerExtrato,
  processarPDFStream,
  upload
} = require('../controllers/icmsEqualizacaoController');

// Listar todos os extratos
router.get('/anexos', listarExtratos);

// Upload de extrato
router.post('/anexos', upload.single('anexo'), uploadExtrato);

// Buscar extrato específico
router.get('/anexos/:id', buscarExtrato);

// Download de extrato
router.get('/anexos/:id/download', downloadExtrato);

// Remover extrato
router.delete('/anexos/:id', removerExtrato);

// Processar PDF com streaming
router.post('/anexos/:id/processar-stream', processarPDFStream);

module.exports = router;

