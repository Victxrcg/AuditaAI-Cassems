const { executeQueryWithRetry } = require('../lib/db');
const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, '..', '..', '.maintenance');

// Verificar se está em modo de manutenção
function isMaintenanceMode() {
  try {
    return fs.existsSync(MAINTENANCE_FILE);
  } catch (error) {
    return false;
  }
}

// Obter dados de manutenção
function getMaintenanceData() {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Health check endpoint
exports.healthCheck = async (req, res) => {
  try {
    // Verificar se está em modo de manutenção
    if (isMaintenanceMode()) {
      const maintenanceData = getMaintenanceData();
      return res.status(503).json({
        status: 'maintenance',
        timestamp: new Date().toISOString(),
        message: maintenanceData?.message || 'Sistema em manutenção',
        estimatedReturn: maintenanceData?.estimatedReturn || 'Unknown',
        startTime: maintenanceData?.startTime
      });
    }

    // Verificar conexão com o banco de dados
    await executeQueryWithRetry('SELECT 1 as health', []);
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      message: 'Service temporarily unavailable'
    });
  }
};

// Maintenance mode endpoint
exports.maintenanceMode = async (req, res) => {
  res.status(503).json({
    status: 'maintenance',
    timestamp: new Date().toISOString(),
    message: 'System is under maintenance',
    estimatedReturn: process.env.MAINTENANCE_ETA || 'Unknown'
  });
};
