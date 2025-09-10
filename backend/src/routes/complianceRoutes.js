const express = require('express');
const multer = require('multer');
const complianceController = require('../controllers/complianceController');
const anexosController = require('../controllers/backend-anexos-controller');

const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Permitir apenas arquivos de documentos
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// Listar competências
router.get('/competencias', complianceController.listCompetencias);

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

module.exports = router;
