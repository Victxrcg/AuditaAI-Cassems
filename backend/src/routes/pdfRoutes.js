// backend/src/routes/pdfRoutes.js
const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

// Rota para obter dados formatados para PDF
router.get('/dados-cronograma', pdfController.obterDadosParaPDF);

// Rota para analisar cronograma com IA
router.post('/analisar-cronograma-ia', pdfController.analisarCronogramaIA);

module.exports = router;
