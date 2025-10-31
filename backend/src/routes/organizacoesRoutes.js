// backend/src/routes/organizacoesRoutes.js
const express = require('express');
const organizacoesController = require('../controllers/organizacoesController');

const router = express.Router();

// Listar todas as organizações
router.get('/', organizacoesController.listarOrganizacoes);

// Buscar organização por ID
router.get('/:id', organizacoesController.buscarOrganizacao);

// Criar nova organização
router.post('/', organizacoesController.criarOrganizacao);

// Atualizar organização
router.put('/:id', organizacoesController.atualizarOrganizacao);

// Deletar organização
router.delete('/:id', organizacoesController.deletarOrganizacao);

module.exports = router;

