const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// Rota para enviar notas fiscais por email
router.post('/enviar-notas-fiscais', emailController.enviarNotasFiscais);

// Rota para testar configuração de email
router.post('/testar', emailController.testarEmail);

module.exports = router;
