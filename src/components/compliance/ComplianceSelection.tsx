import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileBarChart, Receipt, Users, Search, Landmark, ArrowRight } from 'lucide-react';

const ComplianceSelection = () => {
  const navigate = useNavigate();

  const complianceTypes = [
    {
      id: 'rat-fat',
      title: 'RAT e FAP',
      description: 'Relatórios de Análise Técnica e Faturamento',
      icon: FileBarChart,
      path: '/compliance/rat-fat',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      iconColor: 'text-blue-600'
    },
    {
      id: 'subvencao-fiscal',
      title: 'Subvenção Fiscal',
      description: 'Gestão de subvenções e incentivos fiscais',
      icon: Receipt,
      path: '/compliance/subvencao-fiscal',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
      iconColor: 'text-green-600'
    },
    {
      id: 'terceiros',
      title: 'Terceiros',
      description: 'Compliance e gestão de terceiros',
      icon: Users,
      path: '/compliance/terceiros',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
      iconColor: 'text-purple-600'
    },
    {
      id: 'creditos-nao-alocados',
      title: 'Créditos não alocados',
      description: 'Gestão de créditos fiscais não alocados',
      icon: Search,
      path: '/compliance/creditos-nao-alocados',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
      iconColor: 'text-orange-600'
    },
    {
      id: 'icms-equalizacao',
      title: 'ICMS e Equalização',
      description: 'Gestão de ICMS e equalização fiscal',
      icon: Landmark,
      path: '/compliance/icms-equalizacao',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
      iconColor: 'text-red-600'
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Compliance</h1>
        <p className="text-gray-600">Selecione o tipo de compliance que deseja gerenciar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {complianceTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card
              key={type.id}
              className={`${type.color} cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2`}
              onClick={() => navigate(type.path)}
            >
              <CardHeader className="pb-4">
                <div className={`w-12 h-12 rounded-lg ${type.color} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${type.iconColor}`} />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  {type.title}
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  {type.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm font-medium text-gray-700 group">
                  Acessar
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ComplianceSelection;

