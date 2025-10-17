#!/usr/bin/env node

/**
 * Script para ativar/desativar modo de manutenção
 * 
 * Uso:
 * node maintenance-mode.js on  - Ativa modo de manutenção
 * node maintenance-mode.js off - Desativa modo de manutenção
 * node maintenance-mode.js status - Verifica status atual
 */

const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, '..', '.maintenance');

function setMaintenanceMode(enabled) {
  try {
    if (enabled) {
      const maintenanceData = {
        enabled: true,
        startTime: new Date().toISOString(),
        message: 'Sistema em manutenção programada',
        estimatedReturn: process.env.MAINTENANCE_ETA || '30 minutos'
      };
      
      fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(maintenanceData, null, 2));
      console.log('✅ Modo de manutenção ATIVADO');
      console.log(`📝 Arquivo criado: ${MAINTENANCE_FILE}`);
    } else {
      if (fs.existsSync(MAINTENANCE_FILE)) {
        fs.unlinkSync(MAINTENANCE_FILE);
        console.log('✅ Modo de manutenção DESATIVADO');
        console.log(`🗑️ Arquivo removido: ${MAINTENANCE_FILE}`);
      } else {
        console.log('ℹ️ Modo de manutenção já estava desativado');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao alterar modo de manutenção:', error.message);
    process.exit(1);
  }
}

function checkMaintenanceStatus() {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
      console.log('🔧 Modo de manutenção ATIVO');
      console.log(`📅 Iniciado em: ${new Date(data.startTime).toLocaleString('pt-BR')}`);
      console.log(`💬 Mensagem: ${data.message}`);
      console.log(`⏰ Retorno estimado: ${data.estimatedReturn}`);
    } else {
      console.log('✅ Sistema operacional - Modo de manutenção DESATIVADO');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.message);
    process.exit(1);
  }
}

// Processar argumentos da linha de comando
const command = process.argv[2];

switch (command) {
  case 'on':
    setMaintenanceMode(true);
    break;
  case 'off':
    setMaintenanceMode(false);
    break;
  case 'status':
    checkMaintenanceStatus();
    break;
  default:
    console.log('Uso: node maintenance-mode.js [on|off|status]');
    console.log('');
    console.log('Comandos:');
    console.log('  on     - Ativa modo de manutenção');
    console.log('  off    - Desativa modo de manutenção');
    console.log('  status - Verifica status atual');
    process.exit(1);
}
