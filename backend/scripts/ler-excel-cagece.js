/**
 * Lê o Excel de Planos de Trabalho e exibe a estrutura para mapeamento
 */
const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2] || 'C:\\Users\\Victor.antunes\\Downloads\\Planos de Trabalho implantação Cobrança Adiminstrativa (2).xls';

console.log('Lendo:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  console.log('\nAbas:', workbook.SheetNames);
  
  workbook.SheetNames.forEach((sheetName, i) => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`\n--- Aba "${sheetName}" (${data.length} linhas) ---`);
    console.log('Primeiras 15 linhas (raw):');
    data.slice(0, 15).forEach((row, r) => {
      console.log(`  ${r}:`, JSON.stringify(row));
    });
  });
} catch (e) {
  console.error('Erro:', e.message);
  process.exit(1);
}
