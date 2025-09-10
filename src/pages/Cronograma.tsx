import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  status: 'pendente' | 'em_andamento' | 'concluido' | 'atrasado';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  responsavel: string;
}

const Cronograma = () => {
  const [tarefas] = useState<Tarefa[]>([
    {
      id: 1,
      titulo: 'Revisão de Compliance Fiscal',
      descricao: 'Revisar todos os documentos de compliance fiscal do mês',
      dataInicio: '2024-01-15',
      dataFim: '2024-01-20',
      status: 'em_andamento',
      prioridade: 'alta',
      responsavel: 'João Silva'
    },
    {
      id: 2,
      titulo: 'Atualização de Normas',
      descricao: 'Verificar se as normas estão atualizadas',
      dataInicio: '2024-01-10',
      dataFim: '2024-01-25',
      status: 'pendente',
      prioridade: 'media',
      responsavel: 'Maria Santos'
    },
    {
      id: 3,
      titulo: 'Relatório Mensal',
      descricao: 'Elaborar relatório mensal de compliance',
      dataInicio: '2024-01-01',
      dataFim: '2024-01-05',
      status: 'concluido',
      prioridade: 'alta',
      responsavel: 'Pedro Costa'
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'em_andamento':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'atrasado':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: 'secondary',
      em_andamento: 'default',
      concluido: 'success',
      atrasado: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const variants = {
      baixa: 'secondary',
      media: 'default',
      alta: 'destructive',
      critica: 'destructive'
    } as const;

    return (
      <Badge variant={variants[prioridade as keyof typeof variants] || 'secondary'}>
        {prioridade.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cronograma</h1>
          <p className="text-muted-foreground">
            Gerencie as tarefas e prazos do compliance fiscal
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <div className="grid gap-4">
        {tarefas.map((tarefa) => (
          <Card key={tarefa.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {getStatusIcon(tarefa.status)}
                  <CardTitle className="text-lg">{tarefa.titulo}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>{tarefa.descricao}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Início: {new Date(tarefa.dataInicio).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Fim: {new Date(tarefa.dataFim).toLocaleDateString('pt-BR')}</span>
                </div>
                <div>
                  <span>Responsável: {tarefa.responsavel}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {getStatusBadge(tarefa.status)}
                {getPrioridadeBadge(tarefa.prioridade)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Cronograma;
