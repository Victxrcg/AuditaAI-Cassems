import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  Shield,
  FileText,
  Users,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  BookOpen
} from "lucide-react";

const Ajuda = () => {
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const faqItems = [
    {
      id: "cronograma",
      title: "Como usar o Cronograma?",
      icon: Calendar,
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">
            O Cronograma é onde você gerencia todas as demandas e atividades da sua organização.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Criar Nova Demanda</h4>
                <p className="text-sm text-muted-foreground">Clique em "Nova Demanda" e preencha os dados básicos como título, descrição e prazo.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Adicionar Checklist</h4>
                <p className="text-sm text-muted-foreground">Cada demanda pode ter um checklist personalizado para acompanhar o progresso.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Visualizar Progresso</h4>
                <p className="text-sm text-muted-foreground">Acompanhe o status de cada demanda e seus itens de checklist.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "compliance",
      title: "Como funciona o Compliance?",
      icon: Shield,
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">
            O módulo de Compliance gerencia o processo de conformidade fiscal da sua organização.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Selecionar Competência</h4>
                <p className="text-sm text-muted-foreground">Escolha o período (mês/ano) que deseja trabalhar.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Preencher Dados</h4>
                <p className="text-sm text-muted-foreground">Complete cada etapa com as informações solicitadas.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Anexar Documentos</h4>
                <p className="text-sm text-muted-foreground">Faça upload dos documentos necessários para cada etapa.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 text-sm font-bold">4</span>
              </div>
              <div>
                <h4 className="font-medium text-base">Enviar por Email</h4>
                <p className="text-sm text-muted-foreground">Use a funcionalidade de email para enviar documentos diretamente.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "documentos",
      title: "Como gerenciar Documentos?",
      icon: FileText,
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">
            O módulo de Documentos permite organizar e gerenciar todos os arquivos da sua organização.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Upload className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-base">Upload de Arquivos</h4>
                <p className="text-sm text-muted-foreground">Arraste e solte ou clique para fazer upload de documentos.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Download className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-base">Download</h4>
                <p className="text-sm text-muted-foreground">Baixe documentos quando necessário.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-base">Organização</h4>
                <p className="text-sm text-muted-foreground">Organize documentos em pastas por categoria ou projeto.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "usuarios",
      title: "Como gerenciar Usuários?",
      icon: Users,
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">
            O módulo de Usuários permite gerenciar quem tem acesso ao sistema e suas permissões.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium text-base">Adicionar Usuários</h4>
                <p className="text-sm text-muted-foreground">Crie contas para novos membros da equipe.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium text-base">Permissões</h4>
                <p className="text-sm text-muted-foreground">Defina quais módulos cada usuário pode acessar.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium text-base">Status</h4>
                <p className="text-sm text-muted-foreground">Ative ou desative contas conforme necessário.</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];


  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary rounded-lg">
              <HelpCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Central de Ajuda</h1>
              <p className="text-lg text-gray-600">Encontre respostas para suas dúvidas sobre o sistema</p>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6" />
              Guia de Início Rápido
            </CardTitle>
            <CardDescription className="text-base">
              Comece a usar o sistema em poucos passos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-blue-600" />
                <h3 className="font-medium text-base mb-2">1. Cronograma</h3>
                <p className="text-sm text-gray-600">Crie demandas e organize tarefas</p>
              </div>
              <div className="text-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <Shield className="h-10 w-10 mx-auto mb-3 text-green-600" />
                <h3 className="font-medium text-base mb-2">2. Compliance</h3>
                <p className="text-sm text-gray-600">Gerencie processos de conformidade</p>
              </div>
              <div className="text-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <FileText className="h-10 w-10 mx-auto mb-3 text-purple-600" />
                <h3 className="font-medium text-base mb-2">3. Documentos</h3>
                <p className="text-sm text-gray-600">Organize e compartilhe arquivos</p>
              </div>
              <div className="text-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <Users className="h-10 w-10 mx-auto mb-3 text-orange-600" />
                <h3 className="font-medium text-base mb-2">4. Usuários</h3>
                <p className="text-sm text-gray-600">Gerencie acesso e permissões</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Perguntas Frequentes</h2>
          <div className="space-y-4">
            {faqItems.map((item) => (
              <Card key={item.id}>
                <Collapsible 
                  open={openSections.includes(item.id)}
                  onOpenChange={() => toggleSection(item.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <item.icon className="h-6 w-6 text-primary" />
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                        </div>
                        {openSections.includes(item.id) ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {item.content}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </div>


        {/* Tips */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Dicas Importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-base">Salve Regularmente</h4>
                  <p className="text-sm text-gray-600">Sempre salve suas alterações para não perder dados</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-base">Verifique Permissões</h4>
                  <p className="text-sm text-gray-600">Certifique-se de ter acesso aos módulos necessários</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Upload className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-base">Formatos Suportados</h4>
                  <p className="text-sm text-gray-600">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Upload className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-base">Email Automático</h4>
                  <p className="text-sm text-gray-600">Use a funcionalidade de email para enviar documentos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Ajuda;
