// backend/src/routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authControllers');

const router = express.Router();

// Rotas de autenticação
router.post('/login', authController.login);
router.post('/registrar', authController.registrar);
router.get('/verificar', authController.verificarToken);

module.exports = router;
