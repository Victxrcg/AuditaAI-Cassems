const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Middleware para CORS
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Health check endpoint
router.get('/health', healthController.healthCheck);

// Maintenance mode endpoint
router.get('/maintenance', healthController.maintenanceMode);

module.exports = router;
