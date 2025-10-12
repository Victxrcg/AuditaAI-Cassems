// backend/src/routes/usuariosRoutes.js
const express = require('express');
const usuariosController = require('../controllers/usuariosController');

const router = express.Router();

// Rotas de usuários
router.get('/', usuariosController.listarUsuarios);
router.get('/organizacoes', usuariosController.listarOrganizacoes);
router.get('/:id', usuariosController.buscarUsuario);
router.post('/', usuariosController.criarUsuario);
router.put('/:id', usuariosController.atualizarUsuario);
router.delete('/:id', usuariosController.deletarUsuario);

module.exports = router;


