-- ============================================================
-- Health Sales AI — Schema Inicial
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Extensões necessárias
create extension if not exists "uuid-ossp";

-- 2. Enum de status do prospect
create type prospect_status as enum (
  'novo',
  'pesquisando',
  'contatado',
  'reuniao_agendada',
  'proposta_enviada',
  'negociando',
  'ganho',
  'perdido',
  'inativo'
);

-- 3. Enum de tipo de interação
create type interaction_type as enum (
  'ligacao',
  'email',
  'reuniao',
  'linkedin',
  'whatsapp',
  'visita',
  'evento',
  'outro'
);

-- 4. Enum de prioridade
create type prospect_priority as enum (
  'alta',
  'media',
  'baixa'
);

-- 5. Tabela principal: prospects
create table prospects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Dados do CNPJ (BrasilAPI)
  cnpj text not null,
  razao_social text,
  nome_fantasia text,
  porte text,
  capital_social numeric(15,2),
  natureza_juridica text,
  situacao_cadastral text,
  data_abertura date,
  atividade_principal jsonb default '{}',
  atividades_secundarias jsonb default '[]',
  endereco jsonb default '{}',
  telefone text,
  email text,
  socios jsonb default '[]',

  -- Dados de saúde (CNES)
  cnes_codigo text,
  tipo_estabelecimento text,
  subtipo text,
  leitos_total integer,
  leitos_sus integer,
  leitos_nao_sus integer,
  equipamentos jsonb default '[]',
  habilitacoes jsonb default '[]',
  dados_cnes_raw jsonb default '{}',

  -- Dados comerciais (preenchidos manualmente ou por IA)
  sistema_gestao text,                -- Tasy, MV, Philips, etc.
  decisor_nome text,
  decisor_cargo text,
  decisor_linkedin text,
  stakeholders jsonb default '[]',     -- [{nome, cargo, papel_miller_heiman, linkedin}]
  
  -- IA e análise
  briefing_ai text,
  briefing_generated_at timestamptz,
  dores_identificadas jsonb default '[]',
  score integer default 0,             -- 0-100, calculado pelo sistema
  priority prospect_priority default 'media',
  
  -- Status e organização
  status prospect_status default 'novo',
  tags text[] default '{}',
  notas text,
  proximo_contato date,
  motivo_perda text,

  -- Dados brutos para debug/reprocessamento
  enrichment_raw jsonb default '{}',

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  constraint unique_cnpj_per_user unique(user_id, cnpj)
);

-- 6. Tabela de interações
create table interactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  prospect_id uuid references prospects(id) on delete cascade not null,
  
  tipo interaction_type not null,
  resumo text not null,
  detalhes text,
  resultado text,
  
  -- IA
  proximos_passos_ai text,
  sentimento text,  -- positivo, neutro, negativo (análise da IA)
  
  data_interacao timestamptz default now(),
  created_at timestamptz default now()
);

-- 7. Tabela de briefings (histórico)
create table briefings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  prospect_id uuid references prospects(id) on delete cascade not null,
  
  conteudo text not null,
  contexto_usado jsonb default '{}',   -- snapshot dos dados usados
  modelo_ai text,                      -- qual modelo gerou
  
  created_at timestamptz default now()
);

-- 8. Índices para performance
create index idx_prospects_user_id on prospects(user_id);
create index idx_prospects_status on prospects(user_id, status);
create index idx_prospects_priority on prospects(user_id, priority);
create index idx_prospects_cnpj on prospects(cnpj);
create index idx_prospects_proximo_contato on prospects(user_id, proximo_contato);
create index idx_interactions_prospect on interactions(prospect_id);
create index idx_interactions_user on interactions(user_id);
create index idx_briefings_prospect on briefings(prospect_id);

-- 9. Row Level Security (RLS)
alter table prospects enable row level security;
alter table interactions enable row level security;
alter table briefings enable row level security;

-- Políticas: cada usuário só vê seus próprios dados
create policy "Users can view own prospects"
  on prospects for select
  using (auth.uid() = user_id);

create policy "Users can insert own prospects"
  on prospects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own prospects"
  on prospects for update
  using (auth.uid() = user_id);

create policy "Users can delete own prospects"
  on prospects for delete
  using (auth.uid() = user_id);

create policy "Users can view own interactions"
  on interactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own interactions"
  on interactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own interactions"
  on interactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own interactions"
  on interactions for delete
  using (auth.uid() = user_id);

create policy "Users can view own briefings"
  on briefings for select
  using (auth.uid() = user_id);

create policy "Users can insert own briefings"
  on briefings for insert
  with check (auth.uid() = user_id);

-- 10. Trigger para atualizar updated_at automaticamente
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prospects_updated_at
  before update on prospects
  for each row
  execute function update_updated_at();

-- 11. View útil: prospects com contagem de interações
create or replace view prospects_with_stats as
select
  p.*,
  coalesce(i.interaction_count, 0) as total_interacoes,
  i.ultima_interacao
from prospects p
left join (
  select
    prospect_id,
    count(*) as interaction_count,
    max(data_interacao) as ultima_interacao
  from interactions
  group by prospect_id
) i on i.prospect_id = p.id;
