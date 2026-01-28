import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, CheckCircle2, ScrollText, Upload, Key, AlertCircle, ChevronRight, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FirstAccessFormProps {
  tipoCompliance: string;
  userId: number;
  onComplete: () => void;
  onCancel?: () => void;
}

// Campos específicos para RAT e FAP
const RAT_FAP_FIELDS = [
  { id: 'razao_social', label: 'Razão Social', type: 'text', required: true },
  { id: 'cnpj', label: 'CNPJ', type: 'text', required: true, mask: 'cnpj' },
  { id: 'cep', label: 'CEP', type: 'text', required: true, mask: 'cep' },
  { id: 'endereco', label: 'Endereço', type: 'text', required: true },
  { id: 'numero', label: 'Número', type: 'text', required: true },
  { id: 'cidade', label: 'Cidade', type: 'text', required: true },
  { id: 'estado', label: 'Estado (UF)', type: 'text', required: true, maxLength: 2 },
  { id: 'inscricao_estadual', label: 'Inscrição Estadual', type: 'text', required: false },
  { id: 'telefone', label: 'Telefone', type: 'text', required: false, mask: 'phone' },
  { id: 'email_contato', label: 'E-mail de Contato', type: 'email', required: true },
  { id: 'responsavel_nome', label: 'Nome do Responsável', type: 'text', required: true },
  { id: 'responsavel_cargo', label: 'Cargo do Responsável', type: 'text', required: false },
];

// Função para formatar o NDA seguindo padrão ABNT
const formatNDAForABNT = (content: string): string => {
  const lines = content.split('\n');
  const formattedLines: string[] = [];
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line) {
      continue;
    }
    
    // Título principal
    if (line === 'TERMO DE CONFIDENCIALIDADE') {
      formattedLines.push('<h1 style="font-size: 16px; font-weight: bold; text-align: center; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; font-family: \'Times New Roman\', serif;">TERMO DE CONFIDENCIALIDADE</h1>');
      continue;
    }
    
    // Subtítulo
    if (line === '(NDA - NON DISCLOSURE AGREEMENT)') {
      formattedLines.push('<p style="font-size: 14px; text-align: center; margin-bottom: 24px; font-style: italic; font-family: \'Times New Roman\', serif;">(NDA - NON DISCLOSURE AGREEMENT)</p>');
      continue;
    }
    
    // Seções principais
    if (line === 'QUADRO RESUMO' || line === 'CONSIDERANDOS' || line === 'QUADRO INFORMATIVO DE TERMINOLOGIAS:') {
      formattedLines.push(`<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 12px; text-transform: uppercase; font-family: 'Times New Roman', serif;">${line}</h2>`);
      continue;
    }
    
    // CLÁUSULA
    if (line.match(/^CLÁUSULA [A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]+ – [A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]+:/)) {
      formattedLines.push(`<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 12px; text-transform: uppercase; font-family: 'Times New Roman', serif;">${line}</h2>`);
      continue;
    }
    
    // Numeração romana (I –, II –, etc.)
    const romanMatch = line.match(/^([IVX]+)\s*–\s*(.+)$/);
    if (romanMatch) {
      formattedLines.push(`<h3 style="font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 8px; font-family: 'Times New Roman', serif;">${romanMatch[1]} – ${romanMatch[2]}</h3>`);
      continue;
    }
    
    // Subitens (I.1., I.2., etc.)
    const subitemMatch = line.match(/^([IVX]+)\.([0-9]+)\.\s*(.+)$/);
    if (subitemMatch) {
      formattedLines.push(`<p style="margin-top: 12px; margin-bottom: 12px; text-align: justify; text-indent: 0; font-size: 14px; line-height: 1.5; font-family: 'Times New Roman', serif;"><strong>${subitemMatch[1]}.${subitemMatch[2]}.</strong> ${subitemMatch[3]}</p>`);
      continue;
    }
    
    // Itens de lista (a), b), c), etc.)
    const listItemMatch = line.match(/^([a-z])\)\s*(.+)$/);
    if (listItemMatch) {
      formattedLines.push(`<p style="margin-left: 24px; margin-top: 8px; margin-bottom: 8px; text-align: justify; text-indent: 0; font-size: 14px; line-height: 1.5; font-family: 'Times New Roman', serif;">${listItemMatch[1]}) ${listItemMatch[2]}</p>`);
      continue;
    }
    
    // Itens com bullet (•)
    if (line.startsWith('•')) {
      formattedLines.push(`<p style="margin-left: 24px; margin-top: 8px; margin-bottom: 8px; text-align: justify; text-indent: 0; font-size: 14px; line-height: 1.5; font-family: 'Times New Roman', serif;">${line}</p>`);
      continue;
    }
    
    // Tabela de terminologias
    if (line === 'TERMINOLOGIA	DEFINIÇÃO' || line.includes('TERMINOLOGIA') && line.includes('DEFINIÇÃO')) {
      inTable = true;
      formattedLines.push('<table style="width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 12px; font-size: 14px; font-family: \'Times New Roman\', serif;"><thead><tr><th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; width: 30%;">TERMINOLOGIA</th><th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">DEFINIÇÃO</th></tr></thead><tbody>');
      continue;
    }
    
    // Linhas da tabela
    if (inTable) {
      if (line.includes('(Esta folha integra')) {
        formattedLines.push('</tbody></table>');
        inTable = false;
        formattedLines.push(`<p style="margin-top: 12px; margin-bottom: 12px; text-align: justify; font-style: italic; font-size: 14px; line-height: 1.5; font-family: 'Times New Roman', serif;">${line}</p>`);
        continue;
      }
      
      const tabMatch = line.match(/^([^\t]+)\t(.+)$/);
      if (tabMatch) {
        formattedLines.push(`<tr><td style="border: 1px solid #000; padding: 8px;">${tabMatch[1]}</td><td style="border: 1px solid #000; padding: 8px;">${tabMatch[2]}</td></tr>`);
        continue;
      } else if (line.match(/^[A-Z][A-Z\s]+$/)) {
        // Linha que parece ser título de tabela
        inTable = false;
        formattedLines.push('</tbody></table>');
      }
    }
    
    // ASSINATURA
    if (line === 'ASSINATURA:') {
      formattedLines.push(`<p style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; font-weight: bold; font-family: 'Times New Roman', serif;">${line}</p>`);
      continue;
    }
    
    // Parágrafos normais
    formattedLines.push(`<p style="margin-top: 12px; margin-bottom: 12px; text-align: justify; text-indent: 1.25cm; font-size: 14px; line-height: 1.5; font-family: 'Times New Roman', serif;">${line}</p>`);
  }
  
  // Fechar tabela se ainda estiver aberta
  if (inTable) {
    formattedLines.push('</tbody></table>');
  }
  
  return formattedLines.join('\n');
};

// Termo curto de aceite para primeiro acesso (com formatação HTML para destacar palavras importantes)
const TERMO_ACEITE_CURTO = `
<h1 style="font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #1e40af;">TERMO DE ACEITE, CONFIDENCIALIDADE E COMPLIANCE RAT E FAP</h1>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">1. OBJETO</h2>

<p style="text-align: justify; line-height: 1.6; margin-bottom: 15px;">
Este Termo tem por finalidade estabelecer as condições de uso do sistema de compliance fiscal e previdenciário da <strong style="color: #1e40af;">PORTES FINTECH TECNOLOGIA EMPRESARIAL LTDA</strong>, destinado à análise, cálculo, monitoramento e identificação de possíveis valores pagos indevidamente relacionados a <strong style="color: #dc2626;">RAT (Riscos Ambientais do Trabalho)</strong> e <strong style="color: #dc2626;">FAP (Fator Acidentário de Prevenção)</strong>.
</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">2. FUNCIONAMENTO DO SISTEMA</h2>

<p style="margin-bottom: 10px; font-weight: 600;">O usuário declara ciência de que:</p>

<ul style="list-style: none; padding-left: 0; margin-bottom: 15px;">
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  O sistema opera de forma <strong>automatizada</strong>, a partir dos dados e arquivos fornecidos pelo próprio usuário;
</li>
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  Os cálculos e análises são realizados com base na legislação previdenciária vigente, incluindo o <strong style="color: #dc2626;">Decreto nº 3.048/1999</strong> e normas correlatas;
</li>
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  A disponibilização de resultados <strong>não constitui garantia automática</strong> de recuperação de valores, tratando-se de <strong>análise técnica e indicativa</strong>.
</li>
</ul>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">3. CONFIDENCIALIDADE</h2>

<p style="text-align: justify; line-height: 1.6; margin-bottom: 15px;">
Todas as informações inseridas no sistema, incluindo dados <strong>financeiros</strong>, <strong>previdenciários</strong>, de <strong>pagamento</strong>, <strong style="color: #dc2626;">CNAE</strong>, <strong>folha salarial</strong>, <strong>acidentalidade</strong> e documentos enviados, serão tratadas como <strong style="color: #dc2626;">estritamente confidenciais</strong>, sendo utilizadas exclusivamente para a execução dos serviços de compliance <strong style="color: #dc2626;">RAT</strong> e <strong style="color: #dc2626;">FAP</strong>.
</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">4. PROTEÇÃO DE DADOS (<span style="color: #dc2626;">LGPD</span>)</h2>

<p style="text-align: justify; line-height: 1.6; margin-bottom: 10px;">
O usuário autoriza expressamente o tratamento dos dados inseridos no sistema, nos termos da <strong style="color: #dc2626;">Lei nº 13.709/2018 (LGPD)</strong>, exclusivamente para:
</p>

<ul style="list-style: none; padding-left: 0; margin-bottom: 15px;">
<li style="margin-bottom: 8px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  <strong>Análise de conformidade previdenciária</strong>;
</li>
<li style="margin-bottom: 8px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  <strong>Identificação de valores pagos a maior</strong>;
</li>
<li style="margin-bottom: 8px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  <strong>Geração de relatórios técnicos e indicadores</strong>.
</li>
</ul>

<p style="text-align: justify; line-height: 1.6; margin-bottom: 15px;">
A <strong style="color: #1e40af;">PORTES FINTECH</strong> compromete-se a adotar <strong>medidas técnicas e organizacionais adequadas</strong> para proteção dos dados.
</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">5. RESPONSABILIDADE DO USUÁRIO</h2>

<p style="margin-bottom: 10px; font-weight: 600;">O usuário declara que:</p>

<ul style="list-style: none; padding-left: 0; margin-bottom: 15px;">
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  As informações e documentos enviados são <strong>verdadeiros</strong>, <strong>completos</strong> e <strong>atualizados</strong>;
</li>
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  Possui <strong>autorização legal</strong> para fornecer tais dados;
</li>
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  Reconhece que <strong style="color: #dc2626;">inconsistências nos dados podem impactar</strong> os resultados apresentados pelo sistema.
</li>
</ul>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">6. LIMITAÇÃO DE RESPONSABILIDADE</h2>

<p style="margin-bottom: 10px;">
A <strong style="color: #1e40af;">PORTES FINTECH</strong> não se responsabiliza por:
</p>

<ul style="list-style: none; padding-left: 0; margin-bottom: 15px;">
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  <strong>Erros decorrentes de dados incorretos, incompletos ou desatualizados</strong> fornecidos pelo usuário;
</li>
<li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
  <span style="position: absolute; left: 0; color: #1e40af; font-weight: bold;">•</span>
  <strong>Decisões tomadas exclusivamente com base nos resultados automatizados</strong>, sem validação jurídica ou contábil posterior.
</li>
</ul>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">7. ACEITE ELETRÔNICO</h2>

<p style="text-align: justify; line-height: 1.6; margin-bottom: 15px; background-color: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px;">
Ao marcar a opção <strong style="color: #dc2626;">"Li e aceito os termos"</strong>, o usuário declara concordar integralmente com este Termo, que passa a ter <strong>validade jurídica</strong>, nos termos do <strong style="color: #dc2626;">art. 10, §2º da MP nº 2.200-2/2001</strong>.
</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e40af;">8. FORO</h2>

<p style="text-align: justify; line-height: 1.6; margin-bottom: 15px;">
Fica eleito o foro da Comarca de <strong style="color: #dc2626;">Campo Grande/MS</strong> para dirimir quaisquer controvérsias decorrentes deste Termo.
</p>
`;

// Função para aplicar máscaras
const applyMask = (value: string, maskType: string): string => {
  if (!value) return '';
  
  switch (maskType) {
    case 'cnpj':
      return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 18);
    case 'cep':
      return value
        .replace(/\D/g, '')
        .replace(/^(\d{5})(\d)/, '$1-$2')
        .substring(0, 9);
    case 'phone':
      return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
        .substring(0, 15);
    default:
      return value;
  }
};

// Função para gerar o NDA adaptado para RAT e FAP
const generateNDAContent = (formData: Record<string, string>, assinaturaInfo?: { nomeAssinante: string; dataAssinatura: string; horaAssinatura: string }): string => {
  const razaoSocial = formData.razao_social || '(NOME EMPRESA/RAZAO SOCIAL)';
  const cnpj = formData.cnpj || '(NUMERO_CNPJ)';
  const endereco = formData.endereco || '(ENDEREÇO_EMPRESA)';
  const cep = formData.cep || '(CEP_EMPRESA)';
  const cidade = formData.cidade || '';
  const estado = formData.estado || '';
  const email = formData.email_contato || '(EMAILS_REPRESENTANTES)';
  
  // Montar endereço completo de forma inteligente
  const numero = formData.numero || '';
  const partesEndereco: string[] = [];
  if (endereco && !endereco.includes('(ENDEREÇO')) {
    const enderecoComNumero = numero ? `${endereco}, ${numero}` : endereco;
    partesEndereco.push(enderecoComNumero);
  }
  if (cidade && estado) {
    partesEndereco.push(`${cidade}/${estado}`);
  } else if (cidade) {
    partesEndereco.push(cidade);
  } else if (estado) {
    partesEndereco.push(estado);
  }
  if (cep && !cep.includes('(CEP')) partesEndereco.push(cep);
  const enderecoCompleto = partesEndereco.length > 0 
    ? partesEndereco.join(', ') 
    : '(ENDEREÇO_EMPRESA)';
  
  const dataAtual = new Date();
  const dataFormatada = dataAtual.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const cidadeEstado = cidade && estado 
    ? `${cidade}/${estado}` 
    : cidade 
      ? cidade 
      : estado 
        ? estado 
        : 'Campo Grande/MS';

  return `
TERMO DE CONFIDENCIALIDADE
(NDA - NON DISCLOSURE AGREEMENT)

QUADRO RESUMO

I – CONTRATANTE/PARTE DIVULGADORA

I.1. ${razaoSocial}, pessoa jurídica no CNPJ sob o nº ${cnpj}, com sede na ${enderecoCompleto}, com os e-mails ${email}, neste ato representada na forma de seus atos societários, doravante denominada "CONTRATANTE".

II – CONTRATADA/PARTE RECEPTORA

DADOS DA EMPRESA PORTES

III – OBJETO

III.1. Garantir o sigilo absoluto das INFORMAÇÕES CONFIDENCIAIS trocadas entre as partes, referentes à execução dos trabalhos e análises objeto das tratativas comerciais entre a PARTE DIVULGADORA e a PARTE RECEPTORA, conforme detalhado nas cláusulas do presente instrumento, em atenção à Lei Geral de Proteção de Dados Pessoais (LGPD) Lei 13.709/2018.

III.2. Relação jurídica: A relação comercial firmada entre as partes tem como finalidade a prestação de serviços especializados de consultoria, estruturação e implementação de uma operação completa e integrada de compliance fiscal e previdenciário, com foco específico em RAT (Riscos Ambientais do Trabalho) e FAP (Fator Acidentário de Prevenção). O contrato visa a reestruturação e profissionalização das unidades da CONTRATANTE, por meio de:

• Diagnóstico detalhado da operação de compliance RAT e FAP atual;
• Análise de alíquotas RAT aplicáveis conforme Decreto 3.048/1999 e legislação previdenciária vigente;
• Estruturação de fluxos, políticas e manuais de compliance previdenciário;
• Implementação de ferramentas tecnológicas de gestão e automação para cálculo e monitoramento de RAT e FAP;
• Treinamento da equipe interna sobre legislação previdenciária e compliance RAT/FAP;
• Definição de indicadores de desempenho (KPIs) relacionados a acidentalidade, doenças ocupacionais e fatores de prevenção;
• Implantação de mecanismos de mitigação de risco previdenciário e formalização contratual com garantias robustas;
• Análise e otimização do FAP (Fator Acidentário de Prevenção) conforme Portaria 1.263/2012 e legislação complementar;
• Consultoria especializada em recuperação de créditos previdenciários relacionados a RAT e FAP.

Essa prestação será realizada pela empresa PORTES FINTECH TECNOLOGIA EMPRESARIAL LTDA., contratada com expertise técnica e tecnológica na área de compliance fiscal e previdenciário, especialmente em RAT e FAP.

IV – PRINCIPAIS OBRIGAÇÕES

IV.1. Manter confidencialidade absoluta das informações recebidas da outra parte; Limitar o acesso às informações exclusivamente às pessoas diretamente envolvidas com o objeto deste contrato; Não utilizar as INFORMAÇÕES CONFIDENCIAIS recebidas para benefício próprio ou de terceiros; Não divulgar, sob qualquer forma ou meio, as INFORMAÇÕES CONFIDENCIAIS sem autorização expressa da outra Parte; Abster-se de divulgar, por qualquer meio, informações, pareceres, estratégias, relatórios ou quaisquer documentos elaborados por qualquer das PARTES no âmbito da execução dos serviços relacionados ao NEGÓCIO, salvo mediante autorização expressa e prévia da PARTE TITULAR.

V – PENALIDADES

V.1. Multa equivalente a 20% (vinte por cento) sobre o valor total do Contrato principal;

V.2. Multa não compensatória no valor de R$ 150.000,00 (cento e cinquenta mil reais) por contato ou repasse de informação indevida ou tentativa de contato ou repasse, direto ou indireto, com terceiros relacionados às INFORMAÇÕES CONFIDENCIAIS, sem prévia autorização ou contrato formalizado violação às obrigações de confidencialidade;

V.3. Multa diária de R$ 5.000,00 (cinco mil reais) até que cesse integralmente a violação ao sigilo contratual, sem prejuízo da apuração de perdas e danos e das sanções cíveis, penais e administrativas cabíveis.

VI – PRAZO

VI.1. Este Contrato terá vigência pelo prazo de 06 (seis) anos, independentemente da vigência do Contrato principal, contados da assinatura, podendo ser prorrogado mediante termo aditivo expresso.

VII – FORO DE ELEIÇÃO

VII.1. As PARTES elegem o Foro da Comarca de Campo Grande/MS como competente para dirimir quaisquer questões oriundas deste Contrato, renunciando expressamente a qualquer outro, por mais privilegiado que seja ou venha a ser.

VIII – CONDIÇÕES ESPECIAIS

VIII.1. As PARTES acordam os seguintes termos que prevalecerão sobre as Condições Gerais do Contrato:

VIII.2. Todas as informações relacionadas a cálculos de RAT (Riscos Ambientais do Trabalho), FAP (Fator Acidentário de Prevenção), alíquotas previdenciárias, dados de acidentalidade, doenças ocupacionais, massa salarial, CNAE (Classificação Nacional de Atividades Econômicas), e demais informações sensíveis relacionadas à previdência social serão tratadas com máxima confidencialidade.

VIII.3. A PARTE RECEPTORA compromete-se a não utilizar informações sobre estratégias de otimização de RAT e FAP, recuperação de créditos previdenciários, ou análises de conformidade previdenciária para benefício próprio ou de terceiros, sem autorização expressa da PARTE DIVULGADORA.

IX – DATA E LOCAL DA ASSINATURA

IX.1. ${cidadeEstado}, ${dataFormatada}.

QUADRO INFORMATIVO DE TERMINOLOGIAS:

TERMINOLOGIA	DEFINIÇÃO

Parte Divulgadora ou Contratante ou Titular	Individual e indistintamente a Parte que fornece as Informações Confidenciais (proprietária).

Parte Receptora ou Contratada	Individual e indistintamente a Parte que recebe as Informações Confidenciais.

Parte Infratora	Parte que descumpre obrigações assumidas no Termo de Confidencialidade.

Parte Prejudicada	Parte que sofre danos em decorrência de descumprimento das obrigações de confidencialidade.

Informações Confidenciais	Informações sigilosas trocadas entre as Partes, incluindo dados sobre RAT, FAP, alíquotas previdenciárias, acidentalidade, e estratégias de compliance.

Contrato Principal	Contrato específico vinculado a este Termo, relacionado a serviços de compliance RAT e FAP.

Termo	Presente documento de proteção das informações trocadas.

Partes	Serão doravante denominadas em conjunto que fornece e recebe as informações confidenciais.

Negócio	Tratativas comerciais e jurídicas pretendidas pelas Partes relacionadas a compliance fiscal e previdenciário, especialmente RAT e FAP, que motivam a troca de informações.

(Esta folha integra o Termo de Confidencialidade, NDA - non disclosure agreement da PORTES ADVOCACIA).

TERMO DE CONFIDENCIALIDADE
(NDA - NON DISCLOSURE AGREEMENT)

CONSIDERANDOS

CONSIDERANDO que as PARTES terão de trocar INFORMAÇÕES CONFIDENCIAIS, as quais possuem valor econômico significativo para ambas as PARTES, de forma que sua divulgação ou utilização inadequada poderia causar prejuízos irreparáveis aos respectivos interesses comerciais, jurídicos e estratégicos;

CONSIDERANDO que as PARTES trocarão informações que deverão ser tratadas como confidenciais, no âmbito do negócio que pretendem celebrar ("NEGÓCIO"), relacionado a serviços de compliance fiscal e previdenciário com foco em RAT (Riscos Ambientais do Trabalho) e FAP (Fator Acidentário de Prevenção), doravante denominadas INFORMAÇÕES CONFIDENCIAIS, as quais se sujeitarão aos termos e condições deste TERMO;

CONSIDERANDO a obrigação de manter as INFORMAÇÕES CONFIDENCIAIS em estrito sigilo é condição essencial e indispensável para autorizar e viabilizar a troca de informações entre as PARTES;

CONSIDERANDO que as PARTES desejam formalizar, por meio deste Contrato, as condições específicas para proteção, segurança e confidencialidade das informações trocadas, prevenindo assim a ocorrência de quaisquer divulgações não autorizadas ou uso inadequado dessas informações, especialmente no contexto de dados sensíveis relacionados a previdência social, acidentalidade e estratégias de compliance;

Pelo presente instrumento particular e na melhor forma de direito, RESOLVEM AS PARTES celebrar o presente Termo de Confidencialidade ("TERMO") com a finalidade de garantir o sigilo das INFORMAÇÕES CONFIDENCIAIS, que será regido pelas seguintes cláusulas e condições das quais as PARTES se comprometem a respeitar todas as cláusulas contidas no presente TERMO.

CLÁUSULA PRIMEIRA – DO OBJETO:

1.1. Constitui objeto deste Termo de Confidencialidade a proteção e o sigilo das INFORMAÇÕES CONFIDENCIAIS que venham a ser trocadas entre as PARTES, direta ou indiretamente, de forma oral, escrita, eletrônica ou qualquer outro meio, relativas às atividades comerciais, operacionais, técnicas, jurídicas, estratégicas, financeiras, administrativas, ou de qualquer outra natureza, vinculadas à seguinte relação jurídica: A relação comercial firmada entre as partes tem como finalidade a prestação de serviços especializados de consultoria, estruturação e implementação de uma operação completa e integrada de compliance fiscal e previdenciário, com foco específico em RAT (Riscos Ambientais do Trabalho) e FAP (Fator Acidentário de Prevenção). O contrato visa a reestruturação e profissionalização das unidades da CONTRATANTE, por meio de:

• Diagnóstico detalhado da operação de compliance RAT e FAP atual;
• Análise de alíquotas RAT aplicáveis conforme Decreto 3.048/1999, Anexo V, e legislação previdenciária vigente;
• Estruturação de fluxos, políticas e manuais de compliance previdenciário;
• Implementação de ferramentas tecnológicas de gestão e automação para cálculo e monitoramento de RAT e FAP;
• Treinamento da equipe interna sobre legislação previdenciária e compliance RAT/FAP;
• Definição de indicadores de desempenho (KPIs) relacionados a acidentalidade, doenças ocupacionais e fatores de prevenção;
• Implantação de mecanismos de mitigação de risco previdenciário e formalização contratual com garantias robustas;
• Análise e otimização do FAP (Fator Acidentário de Prevenção) conforme Portaria 1.263/2012 e legislação complementar;
• Consultoria especializada em recuperação de créditos previdenciários relacionados a RAT e FAP.

Essa prestação será realizada pela empresa PORTES FINTECH TECNOLOGIA EMPRESARIAL LTDA e PORTES ADVOGADOS ASSOCIADOS, contratada com expertise técnica e tecnológica na área de compliance fiscal e previdenciário, especialmente em RAT e FAP.

necessárias ao desenvolvimento das tratativas entre a PARTE DIVULGADORA e a PARTE RECEPTORA.

1.2. Para os fins deste instrumento, serão consideradas como "INFORMAÇÕES CONFIDENCIAIS" aquelas expressamente identificadas como tal, bem como quaisquer outras informações cujo caráter confidencial seja presumido, devido à sua própria natureza ou circunstância em que foram fornecidas, incluindo-se, sem limitação:

a) Informações jurídicas, técnicas, financeiras, contábeis, comerciais ou estratégicas relacionadas a RAT, FAP, alíquotas previdenciárias e compliance fiscal;

b) Know-how, metodologias e estratégias operacionais de otimização de RAT e FAP;

c) Relatórios, análises, pareceres e estudos relacionados ao objeto deste Contrato, incluindo análises de acidentalidade, doenças ocupacionais e cálculos previdenciários;

d) Informações sobre clientes, fornecedores, colaboradores, parceiros comerciais ou terceiros relacionados direta ou indiretamente às PARTES;

e) Dados sensíveis sobre massa salarial, número de funcionários, CNAE (Classificação Nacional de Atividades Econômicas), histórico de acidentes de trabalho, doenças ocupacionais, e demais informações previdenciárias;

f) apresentadas sob forma física, digital, verbal, visual, gráfica, magnética ou qualquer outra;

g) Qualquer outro dado que, por sua natureza, deva ser mantido em sigilo para preservar os interesses comerciais, jurídicos e econômicos das PARTES, seja elas relativos a pesquisa, desenvolvimento, invenções, serviços, produtos, produção aplicação, consumo, finanças, comercialização, logística, planos de negócios, fórmulas, algoritmos, processos, projetos, croquis, fotografias, plantas, desenhos, conceitos de produto, conceitos de serviços, marcas e logomarcas, especificações, clientes, nomes e/ou particularidades de revendedores e/ou de distribuidores, preços, custos, margens, definições, informações mercadológicas, ideias, amostras de ideias, estratégias, planos de ação, compilações, desenhos, gravações, fitas magnéticas, amostras, protótipos, folhas de dados, planilhas, exemplos, materiais, componentes ou métodos, entre outros aqui não mencionados, que sejam de propriedade da DIVULGADORA ou de empresas suas subsidiárias ou a ela coligadas, ou, ainda, que sejam obtidos pela RECEPTORA mediante visita a qualquer instalação, estabelecimento ou escritório da DIVULGADORA, como resultado do relacionamento ordinário das PARTES ou especificamente para o propósito do NEGÓCIO, informações essas relativas à DIVULGADORA ou relativas a quaisquer de suas empresas coligadas, afiliadas ou do mesmo grupo econômico, seja qual for a fonte reveladora.

1.3. Consideram-se também como Informação Confidencial (i) o próprio NEGÓCIO, ficando todos os dados e informações a ele relacionados e/ou dele derivados sujeitos aos termos deste instrumento e (ii) toda e qualquer informação desenvolvida por qualquer das PARTES que contenha, em parte ou na íntegra, a informação revelada.

1.4. As INFORMAÇÕES CONFIDENCIAIS poderão se revestir de qualquer forma, seja oral ou escrita, corpórea ou não.

1.5. As INFORMAÇÕES CONFIDENCIAIS objeto deste TERMO são fornecidas exclusivamente para análise e realização das tratativas comerciais e jurídicas entre as PARTES relacionadas a compliance RAT e FAP, não podendo ser utilizadas para qualquer outro fim que não aquele expressamente indicado no contrato principal.

CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DAS PARTES

2.1. Em decorrência do presente TERMO, as PARTES obrigam-se, reciprocamente, a manter absoluto sigilo e confidencialidade sobre as informações obtidas direta ou indiretamente uma da outra, em razão da negociação, execução e cumprimento do contrato principal ao qual este instrumento se vincula, exceto nos casos expressamente autorizados por escrito pela PARTE TITULAR das informações ou quando exigido por lei ou autoridade competente.

2.2. A PARTE RECEPTORA compromete-se e obriga-se, inclusive por seus conselheiros, administradores, diretores, empregados, consultores, representantes, contratados e prepostos, bem como controladores, controladas, coligadas, afiliadas e fornecedores, e seus respectivos representantes, a

a) Manter as INFORMAÇÕES CONFIDENCIAIS a que tiver acesso em absoluto sigilo e confidencialidade, devendo tais informações ser utilizadas exclusivamente para o desenvolvimento, análise e implementação dos projetos, propostas e serviços negociados relacionados a compliance RAT e FAP, nos termos estabelecidos pela PARTE DIVULGADORA;

b) Não discutir, perante terceiros, nem usar, copiar, reproduzir, armazenar, divulgar, revelar ou dispor das INFORMAÇÕES CONFIDENCIAIS para outra finalidade que não aquelas relacionadas à avaliação de seu interesse em realizar o NEGÓCIO, cumprindo-lhe adotar cautelas e precauções adequadas no sentido de impedir o uso indevido das INFORMAÇÕES CONFIDENCIAIS por qualquer pessoa que a estas venha a ter acesso por intermédio da RECEPTORA;

c) Limitar o acesso às INFORMAÇÕES CONFIDENCIAIS somente às pessoas estritamente necessárias para a execução do contrato principal, responsabilizando-se pela ciência e cumprimento, por estas pessoas, das obrigações de sigilo previstas neste instrumento;

d) Notificar imediatamente à outra Parte sobre qualquer violação ou suspeita fundada de violação do dever de confidencialidade previsto neste contrato, comprometendo-se a tomar providências imediatas para mitigar quaisquer danos;

e) Zelar pelas INFORMAÇÕES CONFIDENCIAIS recebidas com o mesmo rigor e cuidado com que protege suas próprias informações confidenciais;

f) Cumprir integralmente as disposições previstas na Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018), assumindo integral responsabilidade pela segurança e tratamento dos dados pessoais eventualmente compartilhados entre as PARTES em decorrência do contrato principal;

g) não utilizar qualquer INFORMAÇÃO CONFIDENCIAL da DIVULGADORA para atrair clientes ou buscar uma vantagem comercial pessoal sobre aquela ou utilizar a INFORMAÇÃO CONFIDENCIAL de qualquer outra forma que possa causar qualquer prejuízo à DIVULGADORA, a empresas que sejam suas subsidiárias, controladoras, por ela controladas ou a ela coligadas, e/ou aos seus negócios;

h) controlar quaisquer cópias de documentos, dados e reproduções feitas de tais INFORMAÇÕES CONFIDENCIAIS, sendo sua circulação restrita às próprias PARTES;

i) devolver à DIVULGADORA, no prazo máximo de 03 (três) dias úteis, contados da data da solicitação escrita desta ou do término deste TERMO, por qualquer razão, todos e quaisquer documentos, compilações, papéis, desenhos, relatórios, gravações, fitas magnéticas, CD's, drives, pen drives, amostras, dentre outros, que, por qualquer forma, contenham ou armazenem INFORMAÇÕES CONFIDENCIAIS e as respectivas cópias, sendo-lhe proibido alterar sua substância ou forma;

j) destruir todas as INFORMAÇÕES CONFIDENCIAIS que não tenham sido devolvidas, bem como anotações, memorandos e outros materiais preparados em razão deste TERMO, que refletem, avaliam, incluem ou são derivados de quaisquer INFORMAÇÕES CONFIDENCIAIS, devendo fornecer à PARTE DIVULGADORA declaração sobre o cumprimento desta obrigação;

k) não revelar a terceiros a existência e o conteúdo deste instrumento, bem como de outro contrato que eventualmente, em decorrência dele ou não, possa vir a ser firmado entre as PARTES, sem a prévia e expressa autorização, por escrito, da DIVULGADORA;

2.3. A autorização para eventual divulgação ou compartilhamento das INFORMAÇÕES CONFIDENCIAIS não implica qualquer cessão ou transferência de direitos sobre tais informações à PARTE RECEPTORA.

2.4. Caso a PARTE RECEPTORA seja obrigada, por força de ordem judicial, ou administrativa fundamentada, a revelar INFORMAÇÕES CONFIDENCIAIS, deverá:

a) notificar imediatamente a PARTE DIVULGADORA sobre tal determinação;

b) divulgar as informações solicitadas nos limites da ordem judicial ou administrativa;

c) empregar seus melhores esforços para assegurar o tratamento sigiloso das INFORMAÇÕES CONFIDENCIAIS.

2.5. Todas as declarações, anúncios públicos e divulgações relativas a este TERMO deverão ser previamente comunicadas e coordenadas com a outra PARTE, dependendo a sua declaração, anúncio e/ou divulgação de seu prévio consentimento por escrito. A existência deste TERMO e a natureza das discussões entre as PARTES não deverão ser divulgadas por qualquer PARTE sem o prévio consentimento por escrito da outra PARTE.

CLÁUSULA TERCEIRA – DAS EXCEÇÕES AO SIGILO

3.1. Não estarão abrangidas pelo dever de confidencialidade previsto neste TERMO, as informações que, comprovadamente:

a) Já eram de conhecimento público na data em que foram reveladas, ou posteriormente tenham se tornado públicas, desde que não em decorrência de ato ilícito ou violação ao presente TERMO;

b) Tenham sido legal e comprovadamente obtidas pela PARTE RECEPTORA por outros meios legítimos e independentes da relação estabelecida pelo Contrato principal ou por este TERMO;

c) Tenham sido divulgadas mediante autorização prévia e expressa da PARTE TITULAR das informações;

d) Devam ser reveladas por força de lei ou decisão judicial, arbitral ou administrativa, desde que a PARTE RECEPTORA informe previamente a outra Parte sobre tal obrigação, a tempo de permitir a adoção das medidas cabíveis para proteção das INFORMAÇÕES CONFIDENCIAIS;

e) devam ser reveladas pelas PARTES em razão de ordem ou decisão prolatada por órgão administrativo, regulador ou judicial com jurisdição sobre as PARTES, somente até a extensão de tal ordem

3.2. A Parte que invocar qualquer das exceções mencionadas acima deverá fornecer, mediante solicitação da outra Parte, evidências documentais comprobatórias da situação alegada.

3.3. A PARTE RECEPTORA concorda que nenhuma falha ou atraso causado pela PARTE DIVULGADORA, no exercício do direito, autoridade ou prerrogativa doravante expresso neste TERMO ou em lei, devem ser caracterizados como motivo de não cumprimento de suas obrigações, e que nenhum compromisso individual ou parcial poderá impedir o cumprimento de qualquer outro compromisso, futuro ou atual, bem como impedir o exercício do direito, autoridade ou prerrogativa da PARTE DIVULGADORA, ora especificados neste TERMO.

CLÁUSULA QUARTA – DAS PENALIDADES

4.1. O presente TERMO constitui um pacto de obrigações específicas em si mesmo, conforme os termos aqui definidos, no que tange ao intercâmbio, tratamento e preservação das INFORMAÇÕES CONFIDENCIAIS de ambas as PARTES. Ele não obriga as PARTES, uma com relação à outra, a formalizarem entre si qualquer outro contrato ou ajuste, mesmo que em decorrência dos resultados que alcançarem a partir e como decorrência de suas atuações relacionadas ao NEGÓCIO. O prazo de vigência do presente instrumento será de 2 (dois) anos a partir da data de sua assinatura e engloba todas as INFORMAÇÕES CONFIDENCIAIS recebidas durante este período, devendo, todavia, a obrigação de sigilo permanecer vigente por prazo indeterminado, mesmo após a vigência do TERMO.

4.2. A violação das obrigações previstas neste TERMO sujeitará a Parte infratora, sem prejuízo de outras medidas judiciais cabíveis, às seguintes penalidades:

a) Em caso de utilização indevida das INFORMAÇÕES CONFIDENCIAIS para contratação direta com terceiros indicados pela PARTE DIVULGADORA sem sua autorização prévia e expressa, multa não compensatória equivalente a 20% (vinte por cento) sobre o valor total do Contrato principal;

b) Multa não compensatória no valor de R$ 150.000,00 (cento e cinquenta mil reais) por contato ou repasse de informação indevida ou tentativa de contato ou repasse, direto ou indireto, com terceiros relacionados às INFORMAÇÕES CONFIDENCIAIS, sem prévia autorização ou contrato formalizado violação às obrigações de confidencialidade;

c) Multa diária no valor de R$ 5.000,00 (cinco mil reais), em caso de continuidade da violação, até cessação integral do comportamento irregular ou inadequado relacionado à utilização ou divulgação indevida das INFORMAÇÕES CONFIDENCIAIS.

4.3. A aplicação das penalidades acima não exclui o direito da Parte prejudicada buscar judicialmente o ressarcimento integral das perdas e danos sofridos em decorrência da violação deste TERMO, incluindo lucros cessantes e danos morais eventualmente configurados.

4.4. As penalidades previstas nesta cláusula serão aplicadas isolada ou cumulativamente, conforme a extensão e gravidade da violação, sem prejuízo das sanções administrativas, civis e penais eventualmente aplicáveis.

CLÁUSULA QUINTA – DA VIGÊNCIA E EXTINÇÃO

5.1. Este TERMO entrará em vigor na data de sua assinatura e permanecerá vigente pelo prazo de 06 (seis) anos, independentemente da vigência do Contrato principal, ressalvada a hipótese de extensão da vigência mediante comum acordo por escrito entre as PARTES.

5.2. A extinção ou rescisão antecipada do Contrato principal não afetará a vigência deste TERMO, permanecendo válidas e exigíveis todas as obrigações de confidencialidade estabelecidas, durante todo o período estipulado no item anterior.

5.3. Após o término deste TERMO ou quando solicitado expressamente por escrito pela PARTE TITULAR das informações, a PARTE RECEPTORA obriga-se a devolver ou destruir, conforme indicado pela PARTE TITULAR, todas as INFORMAÇÕES CONFIDENCIAIS recebidas, incluindo documentos físicos ou eletrônicos, cópias, reproduções e quaisquer outros materiais relacionados, no prazo máximo de 10 (dez) dias úteis após tal solicitação.

5.4. A obrigação de confidencialidade permanecerá vigente mesmo após o término ou rescisão deste TERMO, pelo prazo integral estabelecido no item 5.1, comprometendo-se as PARTES a manter absoluto sigilo sobre as INFORMAÇÕES CONFIDENCIAIS recebidas, independentemente do motivo da extinção.

CLÁUSULA SEXTA – DISPOSIÇÕES GERAIS

6.1. O presente instrumento não confere a qualquer das PARTES o direito de utilizar o nome comercial ou qualquer marca ou logotipo, ou qualquer outro direito de propriedade intelectual da outra PARTE, ou quaisquer dados fornecidos pela PARTE DIVULGADORA na execução do NEGÓCIO, utilização essa que somente poderá ocorrer mediante autorização prévia por escrito da outra PARTE.

6.2. Não Cessão: Nenhuma das PARTES poderá ceder ou transferir, total ou parcialmente, os direitos e obrigações previstos neste TERMO sem o consentimento prévio e expresso, por escrito, da outra Parte.

6.3. Independência das Partes: Este TERMO não estabelece qualquer vínculo societário, trabalhista ou associativo entre as PARTES, permanecendo cada Parte integralmente responsável por suas próprias obrigações legais e fiscais decorrentes das atividades relacionadas ao Contrato principal.

6.4. Renúncia: A tolerância de qualquer das PARTES quanto ao descumprimento das obrigações aqui previstas não configurará renúncia ou novação, nem afetará o direito de exigir o estrito cumprimento das obrigações deste TERMO posteriormente.

6.5. Validade Parcial: Caso qualquer disposição contida neste TERMO seja posteriormente considerada nula, ilícita ou inexequível, a exequibilidade das disposições remanescentes não ficará afetada ou prejudicada. A disposição considerada nula, ilícita ou inexequível será, conforme o disposto em lei, substituída por outra, válida, lícita e/ou exequível, que produzirá efeitos do modo mais próximo possível da disposição que substituir.

6.6. Comunicação: Todas as notificações ou comunicações entre as PARTES relacionadas a este TERMO deverão ser feitas por escrito, através dos endereços eletrônicos ou físicos indicados no Quadro Resumo deste TERMO, devendo as PARTES informar imediatamente quaisquer alterações posteriores em seus dados cadastrais.

6.7. Lei Aplicável: Este TERMO será regido e interpretado de acordo com as leis vigentes na República Federativa do Brasil, especialmente o Código Civil Brasileiro (Lei nº 10.406/2002) e a Lei Geral de Proteção de Dados – LGPD (Lei nº 13.709/2018), sem prejuízo das demais normas legais aplicáveis ao caso, incluindo a legislação previdenciária relacionada a RAT e FAP (Decreto 3.048/1999, Portaria 1.263/2012 e legislação complementar).

6.8. Foro: Fica eleito o Foro da Comarca de Campo Grande/MS, com renúncia expressa a qualquer outro, por mais privilegiado que seja ou venha a ser, para dirimir quaisquer questões decorrentes ou relativas ao presente TERMO.

6.9. Assinatura eletrônica: As PARTES e as testemunhas envolvidas neste instrumento afirmam e declaram que esse poderá ser assinado eletronicamente por meio da plataforma "D4SIGN", atualmente no endereço https://www.d4sign.com.br, com fundamento no Artigo 10, parágrafo 2º da MP 2200-2/2001, e do Artigo 6º do Decreto 10.278/2020, sendo as assinaturas consideradas válidas, vinculantes e executáveis, desde que firmadas pelos representantes legais das PARTES.

E, por estarem assim justas e acordadas, as PARTES assinam o presente Termo de Confidencialidade em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo qualificadas, obrigando-se ao seu fiel e integral cumprimento.

${cidadeEstado}, ${dataFormatada}.

${assinaturaInfo ? `
ASSINADO POR: ${assinaturaInfo.nomeAssinante}
Data: ${assinaturaInfo.dataAssinatura}
Hora: ${assinaturaInfo.horaAssinatura}
` : `
ASSINATURA:
`}
  `.trim();
};

export default function FirstAccessForm({ tipoCompliance, userId, onComplete, onCancel }: FirstAccessFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [assinandoDigital, setAssinandoDigital] = useState(false);
  const [assinadoDigital, setAssinadoDigital] = useState(false);
  const [assinaturaInfo, setAssinaturaInfo] = useState<{ nomeAssinante: string; dataAssinatura: string; horaAssinatura: string } | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [aceiteTermo, setAceiteTermo] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState<'dados' | 'termo' | 'assinatura'>('dados');
  const [ultimoCampoEditado, setUltimoCampoEditado] = useState<string | null>(null);
  const [mostrarSucessoAssinatura, setMostrarSucessoAssinatura] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';

  // Verificar se é primeiro acesso ao montar
  useEffect(() => {
    const checkFirstAccess = async () => {
      try {
        setChecking(true);
        // Construir URL corretamente - verificar se API_BASE já contém /api
        let baseUrl = API_BASE;
        if (baseUrl.endsWith('/api')) {
          baseUrl = baseUrl.slice(0, -4); // Remove /api do final
        }
        const url = `${baseUrl}/api/compliance/first-access/${tipoCompliance}/check`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();
        
        if (data.success) {
          setIsFirstAccess(data.isFirstAccess);
          
          // Se já tem dados, preencher formulário
          if (!data.isFirstAccess && data.data) {
            // Carregar dados do cadastro se existirem
            if (data.data.dados_cadastro) {
              const dadosParsed = typeof data.data.dados_cadastro === 'string' 
                ? JSON.parse(data.data.dados_cadastro) 
                : data.data.dados_cadastro;
              setFormData(dadosParsed);
            }
            
            const assinado = data.data.assinado_digital === true || data.data.assinado_digital === 1;
            setAssinadoDigital(assinado);
            
            // Se já aceitou o termo, marcar checkbox
            if (data.data.aceite_termo) {
              setAceiteTermo(true);
            }
            
            // Determinar etapa inicial baseado no progresso
            const temDados = data.data.dados_cadastro && 
              (typeof data.data.dados_cadastro === 'string' 
                ? Object.keys(JSON.parse(data.data.dados_cadastro || '{}')).length > 0
                : Object.keys(data.data.dados_cadastro).length > 0);
            
            if (!data.data.aceite_termo) {
              // Não aceitou termo: começar pelo termo de aceite
              setEtapaAtual('dados');
            } else if (!temDados) {
              // Aceitou termo mas não preencheu dados: ir para preenchimento
              setEtapaAtual('termo');
            } else if (!assinado) {
              // Tem dados mas não assinou: ir para assinatura
              setEtapaAtual('assinatura');
            } else {
              // Tudo completo: mostrar termo (mas não deveria chegar aqui se validação estiver correta)
              setEtapaAtual('termo');
            }
            
            // Se já está assinado, carregar informações de assinatura
            if (assinado && data.data.nome_assinante && data.data.data_assinatura_digital) {
              const dataAssinatura = new Date(data.data.data_assinatura_digital);
              setAssinaturaInfo({
                nomeAssinante: data.data.nome_assinante,
                dataAssinatura: dataAssinatura.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                }),
                horaAssinatura: dataAssinatura.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar primeiro acesso:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível verificar o primeiro acesso',
          variant: 'destructive',
        });
      } finally {
        setChecking(false);
      }
    };

    checkFirstAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCompliance, userId]);

  // Se não é primeiro acesso, verificar qual etapa mostrar
  useEffect(() => {
    if (!isFirstAccess) {
      // Se não aceitou o termo, começar pelo termo de aceite
      if (!aceiteTermo && etapaAtual !== 'dados') {
        setEtapaAtual('dados');
      }
      // Se aceitou termo mas não preencheu dados, ir para dados
      else if (aceiteTermo && !formData.razao_social && etapaAtual !== 'termo') {
        setEtapaAtual('termo');
      }
      // Se tem dados mas não assinou, ir para assinatura
      else if (formData.razao_social && !assinadoDigital && etapaAtual !== 'assinatura') {
        setEtapaAtual('assinatura');
      }
    }
  }, [isFirstAccess, aceiteTermo, assinadoDigital, etapaAtual, formData.razao_social]);

  // Obter campos do formulário baseado no tipo de compliance (memoizado)
  const fields = useMemo(() => {
    switch (tipoCompliance) {
      case 'rat-fat':
        return RAT_FAP_FIELDS;
      default:
        return RAT_FAP_FIELDS; // Por enquanto, usar RAT e FAP como padrão
    }
  }, [tipoCompliance]);

  // Gerar conteúdo do NDA baseado nos dados do formulário
  const ndaContent = useMemo(() => {
    return generateNDAContent(formData, assinaturaInfo || undefined);
  }, [formData, assinaturaInfo]);

  // Função para buscar CEP na API ViaCEP
  const buscarCep = async (cep: string) => {
    // Remove formatação do CEP
    const cepLimpo = cep.replace(/\D/g, '');
    
    // Valida se tem 8 dígitos
    if (cepLimpo.length !== 8) {
      return;
    }

    try {
      setBuscandoCep(true);
      
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: 'CEP não encontrado',
          description: 'O CEP informado não foi encontrado. Verifique e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      // Preencher campos automaticamente
      setFormData(prev => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado,
        cep: cep, // Manter o CEP formatado
      }));

      toast({
        title: 'Endereço encontrado',
        description: `Endereço preenchido automaticamente: ${data.logradouro}, ${data.localidade}/${data.uf}`,
      });

    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível buscar o endereço. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleInputChange = (fieldId: string, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    let processedValue = value;

    // Aplicar máscara se necessário
    if (field?.mask) {
      processedValue = applyMask(value, field.mask);
    }

    // Limitar tamanho se necessário
    if (field?.maxLength) {
      processedValue = processedValue.substring(0, field.maxLength);
    }

    // Normalizar estado (UF) para maiúsculas
    if (fieldId === 'estado') {
      processedValue = processedValue.toUpperCase();
    }

    // Marcar campo como editado para feedback visual
    setUltimoCampoEditado(fieldId);
    setTimeout(() => setUltimoCampoEditado(null), 2000); // Remover destaque após 2 segundos

    setFormData(prev => ({
      ...prev,
      [fieldId]: processedValue,
    }));

    // Se for CEP e tiver 8 dígitos, buscar automaticamente
    if (fieldId === 'cep') {
      const cepLimpo = processedValue.replace(/\D/g, '');
      if (cepLimpo.length === 8) {
        // Aguardar um pouco para o usuário terminar de digitar
        setTimeout(() => {
          buscarCep(processedValue);
        }, 500);
      }
    }
  };

  // Handler para quando o usuário sair do campo CEP
  const handleCepBlur = (value: string) => {
    const cepLimpo = value.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      buscarCep(value);
    }
  };

  // Validação silenciosa (sem toast) para usar em disabled
  const isFormValid = useMemo(() => {
    for (const field of fields) {
      if (field.required && !formData[field.id]?.trim()) {
        return false;
      }

      // Validação de email
      if (field.type === 'email' && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.id])) {
          return false;
        }
      }

      // Validação de CNPJ
      if (field.id === 'cnpj' && formData[field.id]) {
        const cnpj = formData[field.id].replace(/\D/g, '');
        if (cnpj.length !== 14) {
          return false;
        }
      }

      // Validação de CEP
      if (field.id === 'cep' && formData[field.id]) {
        const cep = formData[field.id].replace(/\D/g, '');
        if (cep.length !== 8) {
          return false;
        }
      }

      // Validação de Estado (UF)
      if (field.id === 'estado' && formData[field.id]) {
        const uf = formData[field.id].toUpperCase();
        if (uf.length !== 2) {
          return false;
        }
      }
    }

    return true;
  }, [formData, fields]);

  // Validação com toast para usar em handlers
  const validateForm = (): boolean => {
    for (const field of fields) {
      if (field.required && !formData[field.id]?.trim()) {
        toast({
          title: 'Campos obrigatórios',
          description: `O campo "${field.label}" é obrigatório`,
          variant: 'destructive',
        });
        return false;
      }

      // Validação de email
      if (field.type === 'email' && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.id])) {
          toast({
            title: 'E-mail inválido',
            description: `O e-mail informado não é válido`,
            variant: 'destructive',
          });
          return false;
        }
      }

      // Validação de CNPJ
      if (field.id === 'cnpj' && formData[field.id]) {
        const cnpj = formData[field.id].replace(/\D/g, '');
        if (cnpj.length !== 14) {
          toast({
            title: 'CNPJ inválido',
            description: 'O CNPJ deve conter 14 dígitos',
            variant: 'destructive',
          });
          return false;
        }
      }

      // Validação de CEP
      if (field.id === 'cep' && formData[field.id]) {
        const cep = formData[field.id].replace(/\D/g, '');
        if (cep.length !== 8) {
          toast({
            title: 'CEP inválido',
            description: 'O CEP deve conter 8 dígitos',
            variant: 'destructive',
          });
          return false;
        }
      }

      // Validação de Estado (UF) - não atualizar estado aqui para evitar loop
      if (field.id === 'estado' && formData[field.id]) {
        const uf = formData[field.id].toUpperCase();
        if (uf.length !== 2) {
          toast({
            title: 'Estado inválido',
            description: 'O estado deve conter 2 caracteres (UF)',
            variant: 'destructive',
          });
          return false;
        }
        // A normalização do estado será feita no handleInputChange
      }
    }

    return true;
  };

  // Função para assinar documento de forma simples
  const handleAssinarDigital = async () => {
    if (!validateForm()) {
      return;
    }

    if (!aceiteTermo) {
      toast({
        title: 'Aceite necessário',
        description: 'Você precisa aceitar o Termo de Aceite antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAssinandoDigital(true);
      
      // Obter informações do usuário
      const userFromStorage = localStorage.getItem('user');
      let nomeAssinante = 'Usuário';
      
      if (userFromStorage) {
        try {
          const parsedUser = JSON.parse(userFromStorage);
          nomeAssinante = parsedUser.nome || parsedUser.nome_empresa || 'Usuário';
        } catch (error) {
          console.error('Erro ao obter nome do usuário:', error);
        }
      }
      
      // Gerar data e hora atual
      const agora = new Date();
      const dataAssinatura = agora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const horaAssinatura = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      console.log('🔍 [ASSINATURA] Assinando documento:', {
        nomeAssinante,
        dataAssinatura,
        horaAssinatura,
        userId
      });
      
      // Salvar dados do formulário primeiro
      await saveFormData();
      
      // Salvar assinatura no backend
      let baseUrl = API_BASE;
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
      }
      const url = `${baseUrl}/api/compliance/first-access/${tipoCompliance}/assinar-simples`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          nomeAssinante,
          dataAssinatura: agora.toISOString(),
          dadosCadastro: formData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao assinar documento');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao assinar documento');
      }

      // Salvar informações de assinatura para exibir no termo
      setAssinaturaInfo({
        nomeAssinante,
        dataAssinatura,
        horaAssinatura
      });

      // Verificar se PDF foi gerado e email foi enviado
      const pdfGerado = data.data?.pdfGerado === true;
      const emailEnviadoStatus = data.data?.emailEnviado === true;
      setEmailEnviado(emailEnviadoStatus);
      
      console.log('📧 [ASSINATURA] Status do email:', { 
        pdfGerado, 
        emailEnviado: emailEnviadoStatus,
        userEmail: data.data?.userEmail 
      });

      toast({
        title: 'Documento assinado com sucesso!',
        description: `Documento assinado por ${nomeAssinante} em ${dataAssinatura} às ${horaAssinatura}. ${emailEnviadoStatus ? 'Uma cópia será enviada por email.' : 'PDF gerado com sucesso.'}`,
      });

      setAssinadoDigital(true);
      setMostrarSucessoAssinatura(true);
      
      // Aguardar um pouco para o usuário ver a mensagem antes de fechar
      setTimeout(() => {
        setMostrarSucessoAssinatura(false);
        onComplete();
      }, 5000); // Aumentado para 5 segundos para dar tempo de ler

    } catch (error: any) {
      console.error('❌ [ASSINATURA] Erro ao assinar documento:', error);
      toast({
        title: 'Erro na assinatura',
        description: error.message || 'Não foi possível assinar o documento.',
        variant: 'destructive',
      });
    } finally {
      setAssinandoDigital(false);
    }
  };

  // Função para salvar aceite dos termos
  const salvarAceiteTermo = async () => {
    try {
      // Obter informações do usuário
      const userFromStorage = localStorage.getItem('user');
      let nomeAgente = 'Usuário Desconhecido';
      
      if (userFromStorage) {
        try {
          const parsedUser = JSON.parse(userFromStorage);
          nomeAgente = parsedUser.nome || parsedUser.nome_empresa || parsedUser.nome_usuario || 'Usuário Desconhecido';
          console.log('🔍 [ACEITE] Nome do agente obtido:', nomeAgente);
          console.log('🔍 [ACEITE] Dados do usuário:', { nome: parsedUser.nome, nome_empresa: parsedUser.nome_empresa });
        } catch (error) {
          console.error('❌ [ACEITE] Erro ao obter nome do usuário:', error);
        }
      } else {
        console.warn('⚠️ [ACEITE] Usuário não encontrado no localStorage');
      }
      
      if (!nomeAgente || nomeAgente === 'Usuário Desconhecido') {
        throw new Error('Não foi possível obter o nome do usuário. Faça login novamente.');
      }
      
      let baseUrl = API_BASE;
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
      }
      const url = `${baseUrl}/api/compliance/first-access/${tipoCompliance}/aceitar-termo`;
      
      console.log('🔍 [ACEITE] Salvando aceite dos termos:', { userId, nomeAgente, tipoCompliance });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          nomeAgenteAceite: nomeAgente,
          tipoCompliance,
          dataAceiteTermo: new Date().toISOString(),
        }),
      });

      console.log('🔍 [ACEITE] Status da resposta:', response.status);
      
      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          console.error('❌ [ACEITE] Resposta de erro:', text);
          errorData = JSON.parse(text);
        } catch (parseError) {
          console.error('❌ [ACEITE] Erro ao fazer parse da resposta:', parseError);
          errorData = { error: `Erro ${response.status}: ${response.statusText}` };
        }
        
        const errorMessage = errorData.error || errorData.details || `Erro ${response.status}: ${response.statusText}`;
        console.error('❌ [ACEITE] Erro completo:', errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ [ACEITE] Resposta recebida:', data);
      
      if (!data.success) {
        const errorMessage = data.error || data.details || 'Erro ao salvar aceite dos termos';
        console.error('❌ [ACEITE] Erro na resposta:', data);
        throw new Error(errorMessage);
      }

      console.log('✅ [ACEITE] Aceite dos termos salvo com sucesso');
      
      toast({
        title: 'Termo aceito',
        description: 'Aceite dos termos salvo com sucesso',
      });
    } catch (error: any) {
      console.error('❌ [ACEITE] Erro ao salvar aceite dos termos:', error);
      toast({
        title: 'Erro ao salvar aceite',
        description: error.message || 'Não foi possível salvar o aceite dos termos.',
        variant: 'destructive',
      });
      throw error; // Re-throw para que o botão possa tratar o erro
    }
  };

  const saveFormData = async (tokenAssinatura?: string) => {
    try {
      setLoading(true);

      // Construir URL corretamente - verificar se API_BASE já contém /api
      let baseUrl = API_BASE;
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4); // Remove /api do final
      }
      const url = `${baseUrl}/api/compliance/first-access/${tipoCompliance}/save`;
      
      const requestBody = {
        userId,
        dadosCadastro: formData,
        tokenAssinaturaDigital: tokenAssinatura,
        tipo_compliance: tipoCompliance,
      };
      
      console.log('🔍 [SAVE] Enviando requisição para:', url);
      console.log('🔍 [SAVE] Body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔍 [SAVE] Status da resposta:', response.status);
      console.log('🔍 [SAVE] Status OK?', response.ok);

      // Tentar ler a resposta como JSON, mas tratar caso não seja JSON
      let data;
      try {
        const text = await response.text();
        console.log('🔍 [SAVE] Resposta bruta:', text.substring(0, 500));
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('❌ [SAVE] Erro ao fazer parse da resposta:', parseError);
          throw new Error(`Resposta do servidor não é JSON válido: ${text.substring(0, 200)}`);
        }
      } catch (textError) {
        console.error('❌ [SAVE] Erro ao ler resposta:', textError);
        throw new Error('Não foi possível ler a resposta do servidor');
      }
      
      console.log('🔍 [SAVE] Dados recebidos:', data);
      console.log('🔍 [SAVE] Dados recebidos (stringify):', JSON.stringify(data, null, 2));

      if (!response.ok) {
        // Construir mensagem de erro mais detalhada
        let errorMessage = data.error || `Erro ${response.status}: ${response.statusText}`;
        if (data.details) {
          errorMessage += ` - ${data.details}`;
        }
        if (data.sqlError) {
          errorMessage += ` (SQL: ${data.sqlError})`;
        }
        if (data.sqlState) {
          errorMessage += ` [${data.sqlState}]`;
        }
        
        console.error('❌ [SAVE] Erro completo do servidor:', {
          error: data.error,
          details: data.details,
          sqlError: data.sqlError,
          sqlState: data.sqlState,
          errno: data.errno
        });
        
        throw new Error(errorMessage);
      }

      if (!data.success) {
        let errorMessage = data.error || data.details || 'Erro ao salvar dados';
        if (data.sqlError) {
          errorMessage += ` (SQL: ${data.sqlError})`;
        }
        throw new Error(errorMessage);
      }

      return data;
    } catch (error: any) {
      console.error('❌ [SAVE] Erro ao salvar dados:', error);
      console.error('❌ [SAVE] Mensagem:', error.message);
      console.error('❌ [SAVE] Stack:', error.stack);
      
      // Melhorar mensagem de erro para o usuário
      const errorMessage = error.message || 'Não foi possível salvar os dados. Verifique sua conexão e tente novamente.';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarSemAssinatura = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await saveFormData();
      
      toast({
        title: 'Dados salvos',
        description: 'Você pode assinar depois com certificado digital',
      });

      onComplete();
    } catch (error: any) {
      console.error('❌ [SAVE] Erro ao salvar:', error);
      console.error('❌ [SAVE] Detalhes completos:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Mostrar mensagem de erro mais detalhada
      let errorDescription = error.message || 'Não foi possível salvar os dados';
      
      // Se o erro contém informações SQL, adicionar ao toast
      if (error.message && error.message.includes('SQL')) {
        errorDescription += '\n\nVerifique os logs do console para mais detalhes.';
      }
      
      toast({
        title: 'Erro ao salvar',
        description: errorDescription,
        variant: 'destructive',
        duration: 10000, // 10 segundos para dar tempo de ler
      });
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Se não é primeiro acesso mas ainda não assinou, o formulário será mostrado na etapa de assinatura
  // (já configurado no useEffect acima)

  if (!isFirstAccess && assinadoDigital) {
    // Já preencheu e assinou, não precisa mostrar formulário
    return null;
  }

  // Renderizar etapa de aceite do termo
  if (etapaAtual === 'dados') {
    return (
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Ativação do Compliance RAT & FAP
            </DialogTitle>
            <DialogDescription>
              Para iniciar as análises automatizadas de RAT e FAP, precisamos do seu aceite quanto ao uso seguro dos dados e às regras de compliance do sistema.
            </DialogDescription>
          </DialogHeader>

          {/* Indicador de Progresso */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 font-semibold">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">1</div>
                <span>Termo de Aceite</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">2</div>
                <span>Dados da Empresa</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">3</div>
                <span>Assinatura Digital</span>
              </div>
            </div>
          </div>

          {/* Termo de Aceite Curto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Termo de Aceite, Confidencialidade e Compliance {tipoCompliance === 'rat-fat' ? 'RAT e FAP' : tipoCompliance.toUpperCase()}</CardTitle>
            </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto p-4 bg-white border rounded-lg mb-4 text-sm space-y-3 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: TERMO_ACEITE_CURTO }} />
                </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="aceite-termo"
                  checked={aceiteTermo}
                  onCheckedChange={(checked) => setAceiteTermo(checked === true)}
                  className="mt-1"
                />
                <Label htmlFor="aceite-termo" className="text-sm cursor-pointer">
                  Li e aceito os <strong>Termos de Confidencialidade e Compliance {tipoCompliance === 'rat-fat' ? 'RAT e FAP' : tipoCompliance.toUpperCase()}</strong>
                  <span className="text-red-500 ml-1">*</span>
                </Label>
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    if (!aceiteTermo) {
                      return;
                    }
                    
                    try {
                      // Salvar aceite dos termos no banco
                      await salvarAceiteTermo();
                      // Se salvou com sucesso, avançar para próxima etapa
                      setEtapaAtual('termo');
                    } catch (error) {
                      // Erro já foi tratado na função salvarAceiteTermo
                      console.error('Erro ao salvar aceite, não avançando etapa');
                    }
                  }}
                  disabled={!aceiteTermo}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Ativar sistema e continuar
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {etapaAtual === 'assinatura' 
              ? 'Assinatura Digital do Documento'
              : `Cadastro Inicial - ${tipoCompliance === 'rat-fat' ? 'RAT e FAP' : tipoCompliance}`
            }
          </DialogTitle>
          <DialogDescription>
            {etapaAtual === 'assinatura' 
              ? 'Assine o documento usando o certificado digital da empresa para finalizar o cadastro.'
              : 'Preencha os dados básicos para começar a usar o sistema de compliance. Este formulário deve ser assinado com certificado digital da empresa.'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de Progresso */}
        <div className="px-6 pt-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-green-600">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span>Termo de Aceite</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${etapaAtual === 'termo' ? 'text-blue-600 font-semibold' : etapaAtual === 'assinatura' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${etapaAtual === 'termo' ? 'bg-blue-600 text-white' : etapaAtual === 'assinatura' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                {etapaAtual === 'assinatura' ? <CheckCircle2 className="h-5 w-5" /> : '2'}
              </div>
              <span>Dados da Empresa</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${etapaAtual === 'assinatura' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${etapaAtual === 'assinatura' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span>Assinatura Digital</span>
            </div>
          </div>
        </div>

        {etapaAtual === 'termo' ? (
          <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4 p-6">
            {/* Grid 1: Formulário de Preenchimento */}
            <div className="flex flex-col overflow-hidden">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="text-lg">Dados da Empresa</CardTitle>
                  <CardDescription>Informações básicas da sua empresa</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {fields.map((field) => (
                      <div key={field.id} className={field.id === 'razao_social' || field.id === 'endereco' ? 'col-span-1' : ''}>
                        <Label htmlFor={field.id}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                          {field.id === 'cep' && buscandoCep && (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-600 inline" />
                          )}
                        </Label>
                        <Input
                          id={field.id}
                          type={field.type}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          onBlur={field.id === 'cep' ? (e) => handleCepBlur(e.target.value) : undefined}
                          placeholder={`Digite ${field.label.toLowerCase()}`}
                          required={field.required}
                          maxLength={field.maxLength}
                          className={`mt-1 transition-all duration-300 ${
                            ultimoCampoEditado === field.id 
                              ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' 
                              : ''
                          }`}
                          disabled={field.id === 'cep' && buscandoCep}
                        />
                        {field.id === 'cep' && buscandoCep && (
                          <p className="text-xs text-blue-600 mt-1">Buscando endereço...</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Grid 2: NDA Preenchido Automaticamente */}
            <div className="flex flex-col overflow-hidden">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ScrollText className="h-5 w-5 text-green-600" />
                      Termo de Confidencialidade (NDA)
                    </CardTitle>
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      Atualizando em tempo real
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    <strong>Documento preenchido automaticamente</strong> conforme você preenche os dados ao lado. 
                    As alterações aparecem instantaneamente neste documento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto bg-white p-0">
                  <div 
                    className="abnt-document"
                    style={{
                      fontFamily: "'Times New Roman', serif",
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: '#000000',
                      padding: '60px 50px',
                      maxWidth: '100%',
                      backgroundColor: '#ffffff',
                      minHeight: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatNDAForABNT(ndaContent) 
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Etapa de Assinatura - Mostra a seção de assinatura à esquerda e o NDA à direita */
          <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4 p-6">
            {/* Grid 1: Seção de Assinatura */}
            <div className="flex flex-col overflow-hidden">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5 text-blue-600" />
                    Assinatura Digital
                  </CardTitle>
                  <CardDescription>
                    Para finalizar o cadastro, você precisará assinar este formulário. 
                    A assinatura garante a autenticidade e integridade dos dados informados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Ao clicar em "Assinar", o documento será assinado com seu nome, data e hora da assinatura.
                    </AlertDescription>
                  </Alert>
                  {assinandoDigital && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-blue-700 font-semibold">
                        Processando assinatura...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Grid 2: NDA Completo */}
            <div className="flex flex-col overflow-hidden">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ScrollText className="h-5 w-5 text-green-600" />
                    Termo de Confidencialidade (NDA)
                  </CardTitle>
                  <CardDescription>
                    Documento que será assinado digitalmente
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto bg-white p-0">
                  <div 
                    className="abnt-document"
                    style={{
                      fontFamily: "'Times New Roman', serif",
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: '#000000',
                      padding: '60px 50px',
                      maxWidth: '100%',
                      backgroundColor: '#ffffff',
                      minHeight: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatNDAForABNT(ndaContent) 
                      }} 
                    />
                    {/* Espaço para assinatura */}
                    <div style={{
                      marginTop: '60px',
                      paddingTop: '40px',
                      borderTop: '2px solid #000',
                      textAlign: 'center'
                    }}>
                      <p style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginBottom: '80px',
                        color: '#000'
                      }}>
                        ASSINATURA:
                      </p>
                      <div style={{
                        minHeight: '100px',
                        border: '1px dashed #ccc',
                        marginTop: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        fontSize: '12px'
                      }}>
                        {assinadoDigital ? (
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: 'bold', color: '#16a34a', marginBottom: '10px' }}>
                              ✓ Documento Assinado Digitalmente
                            </p>
                            <p style={{ fontSize: '11px', color: '#666' }}>
                              {new Date().toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        ) : (
                          'Assinatura digital será aplicada aqui'
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Mensagem de Sucesso após Assinatura */}
        {mostrarSucessoAssinatura && assinadoDigital && (
          <div className="px-6 pb-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <p className="font-semibold text-base">
                    ✅ Documento assinado com sucesso!
                  </p>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Assinado por:</strong> {assinaturaInfo?.nomeAssinante}
                    </p>
                    <p>
                      <strong>Data:</strong> {assinaturaInfo?.dataAssinatura} às {assinaturaInfo?.horaAssinatura}
                    </p>
                    {emailEnviado ? (
                      <p className="mt-2 text-green-700 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Uma cópia do termo assinado em PDF será enviada para o email cadastrado ({formData.email_contato || 'seu email'}) em instantes.
                      </p>
                    ) : (
                      <p className="mt-2 text-amber-700">
                        ⚠️ O PDF foi gerado, mas o email não pôde ser enviado automaticamente. Entre em contato com o suporte se necessário.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-600">
                      Este documento foi salvo em nossos registros e está disponível para consulta.
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-4 justify-end pt-4 border-t px-6 pb-6">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading || assinandoDigital}>
              Cancelar
            </Button>
          )}
          {etapaAtual === 'termo' && (
            <>
              <Button
                variant="outline"
                onClick={() => setEtapaAtual('dados')}
                disabled={loading || assinandoDigital}
              >
                Voltar
              </Button>
              <Button
                onClick={() => setEtapaAtual('assinatura')}
                disabled={loading || assinandoDigital || !isFormValid}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continuar para Assinatura
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          {etapaAtual === 'assinatura' && (
            <>
              <Button
                variant="outline"
                onClick={() => setEtapaAtual('termo')}
                disabled={loading || assinandoDigital}
              >
                Voltar
              </Button>
              <Button
                variant="outline"
                onClick={handleSalvarSemAssinatura}
                disabled={loading || assinandoDigital}
              >
                Salvar e assinar depois
              </Button>
              <Button
                onClick={handleAssinarDigital}
                disabled={loading || assinandoDigital}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {assinandoDigital ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assinando...
                  </>
                ) : assinadoDigital ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Assinado
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Iniciar Assinatura Digital
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>

    </Dialog>
  );
}

