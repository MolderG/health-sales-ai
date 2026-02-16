// ============================================================
// Health Sales AI — Tipos TypeScript
// Espelham o schema em supabase/migrations/001_initial_schema.sql
// ============================================================

// --- Enums como union types ---

export type ProspectStatus =
  | 'novo'
  | 'pesquisando'
  | 'contatado'
  | 'reuniao_agendada'
  | 'proposta_enviada'
  | 'negociando'
  | 'ganho'
  | 'perdido'
  | 'inativo';

export type InteractionType =
  | 'ligacao'
  | 'email'
  | 'reuniao'
  | 'linkedin'
  | 'whatsapp'
  | 'visita'
  | 'evento'
  | 'outro';

export type ProspectPriority = 'alta' | 'media' | 'baixa';

// --- Interfaces auxiliares ---

export interface Endereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

export interface Socio {
  nome: string;
  qualificacao?: string;
  faixa_etaria?: string;
  data_entrada_sociedade?: string;
}

export interface Stakeholder {
  nome: string;
  cargo: string;
  papel_miller_heiman: 'economic_buyer' | 'technical_buyer' | 'user' | 'coach';
  linkedin?: string;
}

export interface AtividadeEconomica {
  codigo: string;
  descricao: string;
}

// --- Tabelas principais ---

export interface Prospect {
  id: string;
  user_id: string;

  // Dados CNPJ
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  porte: string | null;
  capital_social: number | null;
  natureza_juridica: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  atividade_principal: AtividadeEconomica | null;
  atividades_secundarias: AtividadeEconomica[] | null;
  endereco: Endereco | null;
  telefone: string | null;
  email: string | null;
  socios: Socio[] | null;

  // Dados CNES
  cnes_codigo: string | null;
  tipo_estabelecimento: string | null;
  subtipo: string | null;
  leitos_total: number | null;
  leitos_sus: number | null;
  leitos_nao_sus: number | null;
  equipamentos: unknown[] | null;
  habilitacoes: unknown[] | null;
  dados_cnes_raw: Record<string, unknown> | null;

  // Dados comerciais
  sistema_gestao: string | null;
  decisor_nome: string | null;
  decisor_cargo: string | null;
  decisor_linkedin: string | null;
  stakeholders: Stakeholder[] | null;

  // IA e análise
  briefing_ai: string | null;
  briefing_generated_at: string | null;
  dores_identificadas: string[] | null;
  score: number;
  priority: ProspectPriority;

  // Status e organização
  status: ProspectStatus;
  tags: string[];
  notas: string | null;
  proximo_contato: string | null;
  motivo_perda: string | null;

  // Dados brutos
  enrichment_raw: Record<string, unknown> | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ProspectWithStats extends Prospect {
  total_interacoes: number;
  ultima_interacao: string | null;
}

export interface Interaction {
  id: string;
  user_id: string;
  prospect_id: string;
  tipo: InteractionType;
  resumo: string;
  detalhes: string | null;
  resultado: string | null;
  proximos_passos_ai: string | null;
  sentimento: string | null;
  data_interacao: string;
  created_at: string;
}

export interface Briefing {
  id: string;
  user_id: string;
  prospect_id: string;
  conteudo: string;
  contexto_usado: Record<string, unknown> | null;
  modelo_ai: string | null;
  created_at: string;
}

// --- BrasilAPI ---

export interface BrasilApiResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  porte: string;
  capital_social: number;
  natureza_juridica: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  data_inicio_atividade: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: {
    codigo: number;
    descricao: string;
  }[];
  descricao_tipo_de_logradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string | null;
  qsa: {
    nome_socio: string;
    qualificacao_socio: string;
    faixa_etaria: string;
    data_entrada_sociedade: string;
  }[];
}

// --- Resultados de processamento ---

export interface EnrichmentResult {
  success: boolean;
  prospect: Prospect | null;
  brasil_api_raw: BrasilApiResponse | null;
  error?: string;
}

export interface BriefingResult {
  success: boolean;
  briefing: string | null;
  modelo_ai: string;
  tokens_usados?: number;
  error?: string;
}

// --- Configs para UI ---

interface StatusConfig {
  label: string;
  color: string;
}

export const STATUS_CONFIG: Record<ProspectStatus, StatusConfig> = {
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-800' },
  pesquisando: { label: 'Pesquisando', color: 'bg-cyan-100 text-cyan-800' },
  contatado: { label: 'Contatado', color: 'bg-yellow-100 text-yellow-800' },
  reuniao_agendada: { label: 'Reunião Agendada', color: 'bg-purple-100 text-purple-800' },
  proposta_enviada: { label: 'Proposta Enviada', color: 'bg-orange-100 text-orange-800' },
  negociando: { label: 'Negociando', color: 'bg-amber-100 text-amber-800' },
  ganho: { label: 'Ganho', color: 'bg-green-100 text-green-800' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-800' },
  inativo: { label: 'Inativo', color: 'bg-gray-100 text-gray-800' },
};

export const PRIORITY_CONFIG: Record<ProspectPriority, StatusConfig> = {
  alta: { label: 'Alta', color: 'bg-red-100 text-red-800' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-800' },
};
