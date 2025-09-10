const express = require('express');
const router = express.Router();
const lotesController = require('../controllers/lotesController');

router.get('/', lotesController.listarLotes);
router.post('/importar', lotesController.importarLote);

module.exports = router; 