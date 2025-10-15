// backend/src/routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authControllers');

const router = express.Router();

// Rotas de autenticação
router.post('/login', authController.login);
router.post('/registrar', authController.registrar);
router.post('/reset-password', authController.resetPassword); // ← NOVA ROTA
router.post('/send-code', authController.sendVerificationCode);
router.post('/verify-code', authController.verifyEmailCode);
router.get('/verificar', authController.verificarToken);
router.get('/user/:userId', authController.getCurrentUser);

module.exports = router;
