const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');

// Listar itens do checklist de uma demanda
router.get('/cronograma/:cronogramaId/checklist', checklistController.listChecklistItems);

// Criar novo item do checklist
router.post('/cronograma/:cronogramaId/checklist', checklistController.createChecklistItem);

// Atualizar item do checklist
router.put('/cronograma/:cronogramaId/checklist/:itemId', checklistController.updateChecklistItem);

// Excluir item do checklist
router.delete('/cronograma/:cronogramaId/checklist/:itemId', checklistController.deleteChecklistItem);

module.exports = router;
