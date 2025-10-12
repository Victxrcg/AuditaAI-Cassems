// backend/src/routes/cronogramaRoutes.js
const express = require('express');
const cronogramaController = require('../controllers/cronogramaController');

const router = express.Router();

// Rotas de cronograma
router.get('/', cronogramaController.listarCronogramas);
router.get('/estatisticas', cronogramaController.estatisticasCronograma);
router.get('/:id', cronogramaController.buscarCronograma);
router.post('/', cronogramaController.criarCronograma);
router.put('/:id', cronogramaController.atualizarCronograma);
router.delete('/:id', cronogramaController.deletarCronograma);

module.exports = router;
