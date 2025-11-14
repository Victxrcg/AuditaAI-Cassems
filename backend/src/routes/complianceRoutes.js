const express = require('express');
const multer = require('multer');
const complianceController = require('../controllers/complianceController');
const anexosController = require('../controllers/backend-anexos-controller');

const router = express.Router();

// Middleware específico para CORS em rotas de anexos
router.use('/competencias/:complianceId/anexos*', (req, res, next) => {
  console.log('🔍 CORS middleware para anexos - Origin:', req.headers.origin);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, x-tipo-compliance, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Configurar multer para upload de arquivos
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB - Limite aumentado para arquivos muito grandes
    files: 10, // Máximo 10 arquivos por requisição
    fieldSize: 1024 * 1024 * 1024 // 1GB para campos
  },
  fileFilter: (req, file, cb) => {
    // Permitir qualquer tipo de arquivo - apenas verificar se é um arquivo válido
    console.log('🔍 Debug - Arquivo recebido no multer:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      size: file.size,
      extension: file.originalname ? file.originalname.split('.').pop() : 'unknown'
    });
    
    // Aceitar qualquer arquivo que tenha nome - ignorar size undefined
    if (file && file.originalname && file.originalname.trim()) {
      console.log('✅ Arquivo aceito pelo multer - ignorando size undefined');
      cb(null, true);
    } else {
      console.error('❌ Arquivo rejeitado pelo multer:', {
        hasFile: !!file,
        hasOriginalName: !!(file && file.originalname),
        originalName: file ? file.originalname : 'undefined',
        size: file ? file.size : 'undefined'
      });
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

// Rota OPTIONS para anexos (preflight CORS)
router.options('/competencias/:complianceId/anexos/:tipoAnexo', (req, res) => {
  console.log('🔍 OPTIONS request para anexos - Origin:', req.headers.origin);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, x-tipo-compliance, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Upload de anexo
router.post('/competencias/:complianceId/anexos/:tipoAnexo', 
  upload.single('anexo'), 
  (err, req, res, next) => {
    if (err) {
      console.error('❌ Erro no multer:', err.message);
      
      // Tratar erros específicos
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
          error: 'Arquivo muito grande', 
          details: 'O arquivo excede o limite de 1GB',
          maxSize: '1GB'
        });
      }
      
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ 
          error: 'Arquivo inesperado', 
          details: 'Verifique se o arquivo foi enviado corretamente'
        });
      }
      
      return res.status(400).json({ 
        error: 'Erro no upload do arquivo', 
        details: err.message 
      });
    }
    next();
  },
  anexosController.uploadAnexo
);

// Listar anexos de uma competência
router.get('/competencias/:complianceId/anexos', anexosController.listAnexos);

// Listar anexos agrupados por categoria
router.get('/competencias/:complianceId/anexos-categorias', anexosController.listAnexosByCategory);

// Buscar anexo por ID
router.get('/anexos/:anexoId', anexosController.getAnexo);

// Buscar anexos por tipo
router.get('/competencias/:complianceId/anexos/:tipoAnexo', anexosController.getAnexosByTipo);

// Remover anexo
router.delete('/anexos/:anexoId', anexosController.removeAnexo);

// Gerar parecer com IA
router.post('/competencias/:id/gerar-parecer', (req, res, next) => {
  console.log('🔍 Rota generateParecer chamada:', req.params.id);
  console.log('🔍 URL completa:', req.originalUrl);
  console.log('🔍 Método:', req.method);
  console.log('🔍 Headers:', req.headers);
  console.log('🔍 Body:', req.body);
  
  if (typeof complianceController.generateParecer === 'function') {
    console.log('✅ Chamando complianceController.generateParecer');
    complianceController.generateParecer(req, res, next);
  } else {
    console.error('❌ generateParecer não é uma função:', typeof complianceController.generateParecer);
    res.status(500).json({ error: 'Função generateParecer não encontrada' });
  }
});

// Obter histórico de alterações de uma competência
router.get('/competencias/:id/historico', complianceController.getHistorico);

// Migrar documentos de uma competência para subpastas
router.post('/competencias/:id/migrar-documentos', complianceController.migrarDocumentosCompetencia);

// Debug: listar todas as rotas registradas
console.log('🔍 Rotas compliance registradas:');
router.stack.forEach((middleware) => {
  if (middleware.route) {
    const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
    console.log(`  ${methods} ${middleware.route.path}`);
  }
});

module.exports = router;
