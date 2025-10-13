const express = require('express');
const router = express.Router();
const documentos = require('../controllers/documentosController');

router.get('/', documentos.listar);
router.post('/upload', documentos.upload.single('file'), documentos.enviar);
router.get('/:id/download', documentos.baixar);
router.delete('/:id', documentos.remover);

module.exports = router;


