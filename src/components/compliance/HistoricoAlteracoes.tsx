import { HistoricoAlteracao } from './types';
import { formatDateTimeBR } from '@/utils/dateUtils';
import { Pencil } from 'lucide-react';
import { getOrganizationBadge } from './components';

interface HistoricoAlteracoesProps {
  historico: HistoricoAlteracao[];
  loading: boolean;
}

const HistoricoAlteracoes = ({ historico, loading }: HistoricoAlteracoesProps) => {
  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Carregando histórico...</span>
        </div>
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">Nenhuma alteração registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Pencil className="h-5 w-5" />
        Histórico de Alterações
      </h3>
      <div className="space-y-3">
        {historico.map((alteracao) => (
          <div key={alteracao.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: alteracao.alterado_por_cor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {alteracao.alterado_por_nome}
                </span>
                {getOrganizationBadge(alteracao.alterado_por_organizacao, alteracao.alterado_por_cor)}
                <span className="text-xs text-gray-500">
                  {formatDateTimeBR(alteracao.alterado_em)}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">Campo:</span> {alteracao.campo_alterado_titulo || alteracao.campo_alterado}
              </div>
              
              {/* Exibir informações específicas para parecer_texto */}
              {alteracao.campo_alterado === 'parecer_texto' ? (
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                  <span className="font-medium">Ação:</span> {alteracao.valor_novo}
                  {alteracao.valor_anterior && alteracao.valor_anterior !== '[Nenhum parecer anterior]' && (
                    <div className="mt-1 text-xs text-gray-600">
                      Substituiu parecer anterior
                    </div>
                  )}
                </div>
              ) : alteracao.campo_alterado.startsWith('anexo_') ? (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded border-l-4 border-green-400">
                  <span className="font-medium">Ação:</span> {alteracao.valor_novo}
                  {alteracao.valor_anterior && alteracao.valor_anterior !== '[Nenhum arquivo anterior]' && (
                    <div className="mt-1 text-xs text-gray-600">
                      {alteracao.valor_anterior}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    Tipo: {alteracao.campo_alterado.replace('anexo_', '').replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              ) : (
                <>
                  {alteracao.valor_anterior && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Valor anterior:</span> {alteracao.valor_anterior}
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Novo valor:</span> {alteracao.valor_novo}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoricoAlteracoes;





