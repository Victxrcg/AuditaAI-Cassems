const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');

// /api/lotes_cancelamento/:loteId/clientes
router.get('/:loteId/clientes', clientesController.listarClientesDoLote);

// /api/anexos/:cpf - Buscar anexos por CPF
router.get('/anexos/:cpf', clientesController.buscarAnexosPorCpf);

module.exports = router; 