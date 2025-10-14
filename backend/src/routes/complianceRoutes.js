const express = require('express');
const multer = require('multer');
const complianceController = require('../controllers/complianceController');
const anexosController = require('../controllers/backend-anexos-controller');

const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB - Aumentado para suportar mais tipos de arquivo
  },
  fileFilter: (req, file, cb) => {
    // Permitir qualquer tipo de arquivo - apenas verificar se é um arquivo válido
    if (file && file.originalname && file.size > 0) {
      cb(null, true);
    } else {
      cb(new Error('Arquivo inválido. Verifique se o arquivo não está corrompido.'), false);
    }
  }
});

// Listar competências
router.get('/competencias', complianceController.listCompetencias);

// Excluir competência - MOVER PARA ANTES da rota GET /competencias/:id
router.delete('/competencias/:id', complianceController.deleteCompetencia);

// Buscar competência por ID
router.get('/competencias/:id', complianceController.getCompetencia);

// Atualizar campo específico de compliance
router.put('/compliance/:id/field', complianceController.updateComplianceField);

// Atualizar competência_referencia
router.put('/competencias/:id/referencia', complianceController.updateCompetenciaReferencia);

// Criar nova competência
router.post('/competencias', complianceController.createCompetencia);

// Upload de anexo
router.post('/competencias/:complianceId/anexos/:tipoAnexo', 
  upload.single('anexo'), 
  anexosController.uploadAnexo
);

// Listar anexos de uma competência
router.get('/competencias/:complianceId/anexos', anexosController.listAnexos);

// Buscar anexo por ID
router.get('/anexos/:anexoId', anexosController.getAnexo);

// Buscar anexos por tipo
router.get('/competencias/:complianceId/anexos/:tipoAnexo', anexosController.getAnexosByTipo);

// Remover anexo
router.delete('/anexos/:anexoId', anexosController.removeAnexo);

// Gerar parecer com IA
router.post('/competencias/:id/gerar-parecer', complianceController.gerarParecer);

// Obter histórico de alterações de uma competência
router.get('/competencias/:id/historico', complianceController.getHistorico); // ← NOVA ROTA

module.exports = router;
