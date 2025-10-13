import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const frontPort = Number(env['FRONT-PORTA'] || process.env['FRONT-PORTA'] || 4011);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: frontPort,
      allowedHosts: [
        'localhost',
        'auditaai.portes.com.br',
        'api-auditaai.portes.com.br',
        'cassems.portes.com.br',
        'api-cassems.portes.com.br'
      ],
      fs: {
        allow: ['..', '../.env']
      }
    },
  };
});