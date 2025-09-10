module.exports = {
  apps: [{
    name: 'api-auditaai',
    script: 'backend/src/app.js',
    cwd: '/home/portes/auditaai/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_USER: 'auditaai_user',
      DB_PASS: '123Mudar',
      DB_NAME: 'auditaai'
    },
    error_file: '/home/portes/.pm2/logs/api-auditaai-error.log',
    out_file: '/home/portes/.pm2/logs/api-auditaai-out.log',
    log_file: '/home/portes/.pm2/logs/api-auditaai-combined.log',
    time: true
  }]
}; 