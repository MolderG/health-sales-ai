import OpenAI from 'openai';
import type { InteractionType, Stakeholder, OutreachMessages } from '@/types/prospect';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const AI_MODEL = 'openai/gpt-oss-120b';

// --- Briefing ---

interface BriefingContext {
  // Empresa
  nome_fantasia: string | null;
  razao_social: string | null;
  porte: string | null;
  capital_social: number | null;
  atividade_principal: { codigo: string; descricao: string } | null;
  endereco: { municipio?: string; uf?: string } | null;
  socios: { nome: string; qualificacao?: string }[] | null;

  // Saúde
  tipo_estabelecimento: string | null;
  leitos_total: number | null;
  leitos_sus: number | null;
  leitos_nao_sus: number | null;
  sistema_gestao: string | null;

  // Comercial
  decisor_nome: string | null;
  decisor_cargo: string | null;
  stakeholders: Stakeholder[] | null;
  interacoes_anteriores?: string[];
}

const SYSTEM_PROMPT = `Você é um assistente de vendas especializado em healthtech no Brasil. Seu usuário é o Henrique, Regional Partner da WeKnow HealthTech no Paraná. A WeKnow é uma plataforma de Business Intelligence para saúde que se conecta a sistemas hospitalares (Tasy, MV, Philips) e planilhas Excel, integra dados em painéis com indicadores de fácil entendimento. Foco: gestão estratégica, ocupação de leitos, centro cirúrgico, glosas, custos.`;

export async function generateBriefing(context: BriefingContext): Promise<string> {
  const nomeInstituicao = context.nome_fantasia || context.razao_social || 'Instituição';

  const userPrompt = `Gere um briefing de vendas para a seguinte instituição de saúde:

**Instituição:** ${nomeInstituicao}
**Razão Social:** ${context.razao_social || 'N/A'}
**Porte:** ${context.porte || 'N/A'}
**Capital Social:** ${context.capital_social ? `R$ ${context.capital_social.toLocaleString('pt-BR')}` : 'N/A'}
**Atividade Principal:** ${context.atividade_principal ? `${context.atividade_principal.codigo} - ${context.atividade_principal.descricao}` : 'N/A'}
**Localização:** ${context.endereco ? `${context.endereco.municipio || ''} - ${context.endereco.uf || ''}` : 'N/A'}
**Sócios:** ${context.socios?.map((s) => `${s.nome} (${s.qualificacao || 'N/I'})`).join(', ') || 'N/A'}

**Tipo de Estabelecimento:** ${context.tipo_estabelecimento || 'N/A'}
**Leitos Total:** ${context.leitos_total ?? 'N/A'}
**Leitos SUS:** ${context.leitos_sus ?? 'N/A'}
**Leitos Não-SUS:** ${context.leitos_nao_sus ?? 'N/A'}
**Sistema de Gestão Atual:** ${context.sistema_gestao || 'Não identificado'}

**Decisor:** ${context.decisor_nome ? `${context.decisor_nome} (${context.decisor_cargo || 'cargo N/I'})` : 'Não identificado'}
**Stakeholders:** ${context.stakeholders?.map((s) => `${s.nome} - ${s.cargo} (${s.papel_miller_heiman})`).join('; ') || 'Não mapeados'}
${context.interacoes_anteriores?.length ? `**Interações anteriores:**\n${context.interacoes_anteriores.map((i) => `- ${i}`).join('\n')}` : ''}

Estruture o briefing com:
1. **Contexto da Instituição** — resumo do perfil e relevância
2. **Possíveis Dores Operacionais** — problemas que a WeKnow resolve baseado no perfil
3. **Mapa de Stakeholders (Miller Heiman)** — análise dos decisores e influenciadores
4. **Perguntas de Discovery** — perguntas estratégicas para a primeira reunião
5. **Cases e Argumentos Relevantes** — argumentos de venda personalizados para este perfil`;

  const completion = await openrouter.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return completion.choices[0]?.message?.content || 'Não foi possível gerar o briefing.';
}

// --- Análise de Interação ---

const INTERACTION_SYSTEM_PROMPT = `Você é um assistente de vendas especializado em healthtech no Brasil, focado em análise de interações comerciais. Seu usuário é o Henrique, Regional Partner da WeKnow HealthTech no Paraná.

**Sobre a WeKnow:** Plataforma de Business Intelligence para saúde que se conecta a sistemas hospitalares (Tasy, MV, Philips) e planilhas Excel, integra dados em painéis com indicadores de fácil entendimento. Foco: gestão estratégica, ocupação de leitos, centro cirúrgico, glosas, custos.

**Metodologia de vendas — Miller Heiman (Strategic Selling):**
- Identifique o papel de cada contato: Economic Buyer (decisor financeiro), Technical Buyer (avaliador técnico/TI), User Buyer (usuário final/gestores clínicos), Coach (aliado interno)
- Avalie a posição de cada buyer: Growth (quer crescer), Trouble (tem problema urgente), Even Keel (satisfeito), Overconfident (não vê necessidade)
- Sempre sugira próximos passos que avancem o deal com múltiplos stakeholders

**Cadência multicanal recomendada:**
- Dia 1: LinkedIn (conexão + mensagem personalizada)
- Dia 3: Email de introdução com case relevante
- Dia 5: Ligação para o decisor
- Dia 8: WhatsApp com conteúdo de valor
- Dia 12: Email de follow-up
- Dia 15: Ligação final ou convite para evento/webinar

**Segmentação por tipo de instituição:**
- Hospitais grandes (>150 leitos): foco em ROI, integração com sistemas existentes, gestão de centro cirúrgico
- Hospitais médios (50-150 leitos): foco em eficiência operacional, ocupação de leitos, redução de glosas
- Hospitais pequenos (<50 leitos): foco em simplicidade, custo-benefício, substituição de planilhas
- Clínicas e ambulatórios: foco em agendamento, produtividade médica, indicadores básicos
- Operadoras de saúde: foco em gestão de rede, auditoria, indicadores de qualidade

Ao analisar interações, considere o contexto completo: tipo de instituição, porte, estágio no funil, histórico de contatos e sentimento geral da negociação.`;

interface InteractionContext {
  prospect_nome: string;
  prospect_porte?: string | null;
  prospect_tipo?: string | null;
  prospect_status?: string | null;
  tipo_interacao: InteractionType;
  resumo: string;
  detalhes?: string | null;
  historico?: string[];
}

interface InteractionAnalysis {
  proximos_passos: string;
  sentimento: string;
}

export async function analyzeInteraction(
  context: InteractionContext
): Promise<InteractionAnalysis> {
  const userPrompt = `Analise esta interação comercial e responda APENAS com JSON puro (sem markdown, sem \`\`\`):

**Prospect:** ${context.prospect_nome}
${context.prospect_tipo ? `**Tipo de estabelecimento:** ${context.prospect_tipo}` : ''}
${context.prospect_porte ? `**Porte:** ${context.prospect_porte}` : ''}
${context.prospect_status ? `**Status no funil:** ${context.prospect_status}` : ''}
**Tipo de interação:** ${context.tipo_interacao}
**Resumo:** ${context.resumo}
${context.detalhes ? `**Detalhes:** ${context.detalhes}` : ''}
${context.historico?.length ? `**Histórico recente:**\n${context.historico.map((h) => `- ${h}`).join('\n')}` : ''}

Responda neste formato JSON:
{
  "proximos_passos": "descrição concreta e acionável dos próximos passos recomendados (máximo 2-3 frases)",
  "sentimento": "positivo | neutro | negativo"
}`;

  const completion = await openrouter.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: INTERACTION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const raw = completion.choices[0]?.message?.content || '';

  try {
    return JSON.parse(raw) as InteractionAnalysis;
  } catch {
    return {
      proximos_passos: raw || 'Não foi possível analisar a interação.',
      sentimento: 'neutro',
    };
  }
}

// --- Segmentação de Prospect ---

type ProspectSegment = 'hospital_filantropico' | 'hospital' | 'holding_grupo' | 'operadora' | 'clinica' | 'saude';

function classifyProspectSegment(context: OutreachContext): ProspectSegment {
  const natureza = (context.natureza_juridica || '').toLowerCase();
  const atividadeDesc = (context.atividade_principal?.descricao || '').toLowerCase();
  const sociosText = (context.socios || []).map(s => (s.qualificacao || '').toLowerCase()).join(' ');

  if (natureza.includes('filantrópic') || natureza.includes('filantropic')) {
    return 'hospital_filantropico';
  }

  if ((context.capital_social && context.capital_social > 10_000_000) || sociosText.includes('holding')) {
    return 'holding_grupo';
  }

  if (atividadeDesc.includes('hospitalar') || atividadeDesc.includes('hospital')) {
    return 'hospital';
  }

  if (atividadeDesc.includes('operadora') || atividadeDesc.includes('plano') || atividadeDesc.includes('saúde suplementar')) {
    return 'operadora';
  }

  if (atividadeDesc.includes('clínica') || atividadeDesc.includes('diagnóstico') || atividadeDesc.includes('laboratório')) {
    return 'clinica';
  }

  return 'saude';
}

// --- Geração de Mensagens de Abordagem ---

interface OutreachContext {
  nome_fantasia: string | null;
  razao_social: string | null;
  porte: string | null;
  capital_social: number | null;
  atividade_principal: { codigo: string; descricao: string } | null;
  natureza_juridica: string | null;
  endereco: { municipio?: string; uf?: string } | null;
  socios: { nome: string; qualificacao?: string }[] | null;
  tipo_estabelecimento: string | null;
  leitos_total: number | null;
  sistema_gestao: string | null;
  decisor_nome: string | null;
  decisor_cargo: string | null;
  stakeholders: Stakeholder[] | null;
  interacoes_anteriores?: string[];
}

const OUTREACH_SYSTEM_PROMPT = `Você é um especialista em copywriting de vendas B2B no setor de saúde brasileiro. Você escreve mensagens de prospecção para o Henrique, Regional Partner da WeKnow HealthTech no Paraná.

**Sobre a WeKnow:** Plataforma de Business Intelligence para saúde que se conecta a sistemas hospitalares (Tasy, MV, Philips) e planilhas Excel, integra dados em painéis com indicadores de fácil entendimento. Foco: gestão estratégica, ocupação de leitos, centro cirúrgico, glosas, custos.

**Regras de abordagem consultiva:**
- Tom profissional mas humano, nunca robótico ou genérico
- Personalizar com dados reais da instituição (nome, porte, tipo, localização)
- Mencionar dores específicas do segmento
- Nunca fazer pitch direto — sempre oferecer valor primeiro (insight, case, convite)
- Se houver decisor identificado, personalizar com nome e cargo
- Referenciar cases relevantes quando possível

**Formatos por canal:**
1. **LinkedIn Conexão** (máx 300 caracteres): Mensagem curta para pedido de conexão. Mencionar algo específico da instituição. Sem pitch.
2. **LinkedIn Follow-up**: Mensagem após aceite da conexão. Oferecer insight ou conteúdo relevante. Pode ser mais longa.
3. **Email**: Assunto curto e direto (sem "RE:" fake). Corpo com gancho personalizado, 1 case/dado relevante, CTA claro para conversa de 15min.
4. **Ligação — Roteiro**: Script de ligação com: abertura (quem sou, por que ligo), gancho de valor, perguntas de qualificação, CTA para reunião.

**Segmentação por tipo de instituição:**
- Hospital filantrópico: foco em eficiência com recursos limitados, compliance SUS, gestão de glosas SUS
- Hospital grande (>150 leitos): foco em ROI, integração com sistemas existentes, gestão de centro cirúrgico
- Hospital médio/pequeno: foco em eficiência operacional, substituição de planilhas, ocupação de leitos
- Holding/grupo: foco em consolidação de dados multi-unidade, benchmarking entre unidades, visão corporativa
- Operadora de saúde: foco em gestão de rede, auditoria, indicadores de qualidade
- Clínica/diagnóstico: foco em agendamento, produtividade, indicadores básicos

**Cases de referência:**
- Hospital filantrópico no PR reduziu glosas em 35% em 6 meses
- Grupo hospitalar consolidou dados de 4 unidades em dashboard único
- Hospital de 200 leitos aumentou ocupação em 12% com painel de gestão de leitos

Responda APENAS com JSON puro (sem markdown, sem \`\`\`) com as chaves: linkedin_conexao, linkedin_followup, email_assunto, email_corpo, ligacao.`;

export async function generateOutreachMessages(context: OutreachContext): Promise<OutreachMessages> {
  const nomeInstituicao = context.nome_fantasia || context.razao_social || 'Instituição';
  const segmento = classifyProspectSegment(context);

  const segmentoLabels: Record<ProspectSegment, string> = {
    hospital_filantropico: 'Hospital Filantrópico',
    hospital: 'Hospital',
    holding_grupo: 'Holding / Grupo Hospitalar',
    operadora: 'Operadora de Saúde',
    clinica: 'Clínica / Diagnóstico',
    saude: 'Instituição de Saúde',
  };

  const userPrompt = `Gere mensagens de prospecção personalizadas para a seguinte instituição:

**Instituição:** ${nomeInstituicao}
**Razão Social:** ${context.razao_social || 'N/A'}
**Segmento identificado:** ${segmentoLabels[segmento]}
**Porte:** ${context.porte || 'N/A'}
**Capital Social:** ${context.capital_social ? `R$ ${context.capital_social.toLocaleString('pt-BR')}` : 'N/A'}
**Natureza Jurídica:** ${context.natureza_juridica || 'N/A'}
**Atividade Principal:** ${context.atividade_principal ? `${context.atividade_principal.codigo} - ${context.atividade_principal.descricao}` : 'N/A'}
**Localização:** ${context.endereco ? `${context.endereco.municipio || ''} - ${context.endereco.uf || ''}` : 'N/A'}
**Sócios:** ${context.socios?.map((s) => `${s.nome} (${s.qualificacao || 'N/I'})`).join(', ') || 'N/A'}

**Tipo de Estabelecimento:** ${context.tipo_estabelecimento || 'N/A'}
**Leitos Total:** ${context.leitos_total ?? 'N/A'}
**Sistema de Gestão Atual:** ${context.sistema_gestao || 'Não identificado'}

**Decisor:** ${context.decisor_nome ? `${context.decisor_nome} (${context.decisor_cargo || 'cargo N/I'})` : 'Não identificado'}
**Stakeholders:** ${context.stakeholders?.map((s) => `${s.nome} - ${s.cargo} (${s.papel_miller_heiman})`).join('; ') || 'Não mapeados'}
${context.interacoes_anteriores?.length ? `**Interações anteriores:**\n${context.interacoes_anteriores.map((i) => `- ${i}`).join('\n')}` : ''}

Gere as 5 mensagens personalizadas em JSON puro:
{
  "linkedin_conexao": "mensagem curta para pedido de conexão (máx 300 chars)",
  "linkedin_followup": "mensagem de follow-up após conexão aceita",
  "email_assunto": "assunto do email",
  "email_corpo": "corpo do email completo",
  "ligacao": "roteiro completo de ligação"
}`;

  const completion = await openrouter.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: OUTREACH_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const raw = completion.choices[0]?.message?.content || '';

  try {
    return JSON.parse(raw) as OutreachMessages;
  } catch {
    return {
      linkedin_conexao: 'Erro ao gerar mensagem. Tente novamente.',
      linkedin_followup: 'Erro ao gerar mensagem. Tente novamente.',
      email_assunto: 'Erro ao gerar mensagem. Tente novamente.',
      email_corpo: 'Erro ao gerar mensagem. Tente novamente.',
      ligacao: 'Erro ao gerar mensagem. Tente novamente.',
    };
  }
}
