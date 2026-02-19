# Health Sales AI

Plataforma de inteligência de vendas B2B para o setor healthtech brasileiro, desenvolvida para **Henrique — Parceiro Regional WeKnow HealthTech no Paraná**. A WeKnow é uma plataforma de Business Intelligence que se conecta a sistemas hospitalares (Tasy, MV, Philips) e planilhas Excel para estruturar dados clínicos e operacionais de instituições de saúde.

O objetivo da ferramenta é automatizar a pesquisa, qualificação e geração de conteúdo de vendas para prospecção de hospitais, clínicas e demais estabelecimentos de saúde.

---

## Funcionalidades Implementadas

### Gestão de Prospects
- Cadastro de prospects com enriquecimento automático via CNPJ (BrasilAPI)
- Busca e importação de dados de estabelecimentos de saúde via DataSUS/CNES (leitos, equipamentos, habilitações)
- 9 status de pipeline: `novo → pesquisando → contatado → reunião agendada → proposta enviada → negociando → ganho / perdido / inativo`
- Priorização por nível (alta, média, baixa) e scoring (0–100)
- Agendamento de próximo contato
- Tags, notas livres e mapeamento de stakeholders

### Inteligência Artificial
- **Briefing de vendas**: Geração contextualizada de briefing com perfil da instituição, dores operacionais, perguntas de discovery e argumentos de venda, baseado na metodologia Miller Heiman
- **Mensagens de outreach**: Geração de mensagens personalizadas por canal — LinkedIn (conexão e follow-up), Email (assunto + corpo) e script de ligação — segmentadas por tipo/porte da instituição
- **Análise de interações**: Análise de sentimento (positivo/neutro/negativo) e extração de próximos passos de chamadas e reuniões registradas

### Visualizações
- **Lista de prospects** com filtros e métricas de contatos em atraso e inativos (>14 dias)
- **Pipeline Kanban** com colunas por status, métricas de cada etapa e toggle de colunas

### Histórico de Interações
- Registro de ligações, emails, reuniões, LinkedIn, WhatsApp, visitas e eventos
- Análise automática de sentimento e próximos passos via IA

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 com App Router |
| Linguagem | TypeScript 5 (strict) |
| Estilização | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Banco de dados | Supabase (PostgreSQL) com RLS |
| Autenticação | Supabase Auth (email/senha) |
| IA | OpenRouter API — modelo `openai/gpt-oss-120b` |
| Dados de CNPJ | BrasilAPI |
| Dados hospitalares | DataSUS / CNES |
| Notificações UI | Sonner (toasts) |
| Ícones | Lucide React |

---

## Estrutura do Banco de Dados

### Tabelas principais

**`prospects`** — Registro central de cada prospect
- Dados CNPJ: `cnpj`, `razao_social`, `nome_fantasia`, `porte`, `capital_social`, `natureza_juridica`, `atividade_principal`, `endereco`, `socios`
- Dados CNES: `cnes_codigo`, `tipo_estabelecimento`, `leitos_total`, `leitos_sus`, `leitos_nao_sus`, `equipamentos`, `habilitacoes`
- Dados comerciais: `sistema_gestao`, `decisor_nome`, `decisor_cargo`, `stakeholders`
- Dados IA: `briefing_ai`, `briefing_generated_at`, `dores_identificadas`, `score`, `priority`
- Status: `status`, `tags`, `notas`, `proximo_contato`, `motivo_perda`
- Dados brutos: `enrichment_raw` (JSONB — armazena mensagens de outreach e dados extras)

**`interactions`** — Histórico de interações de vendas
- Tipo, data, responsável, notas, resultado
- Análise de sentimento e próximos passos gerados por IA

**`briefings`** — Histórico de briefings gerados por IA

### Enums
- `prospect_status`: `novo`, `pesquisando`, `contatado`, `reuniao_agendada`, `proposta_enviada`, `negociando`, `ganho`, `perdido`, `inativo`
- `interaction_type`: `ligacao`, `email`, `reuniao`, `linkedin`, `whatsapp`, `visita`, `evento`, `outro`
- `prospect_priority`: `alta`, `media`, `baixa`

Segurança: RLS habilitado — cada usuário acessa apenas seus próprios dados.

---

## Rotas de API

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/enrich` | POST | Enriquece dados via CNPJ (BrasilAPI) e cria prospect |
| `/api/enrich/cnes` | POST | Busca dados do estabelecimento de saúde (DataSUS/CNES) |
| `/api/briefing` | POST | Gera briefing de vendas com IA |
| `/api/messages` | POST | Gera mensagens de outreach multicanal com IA |
| `/api/interactions` | POST | Registra interação com análise de sentimento por IA |
| `/auth/callback` | GET | Callback OAuth do Supabase |

Todas as rotas requerem autenticação (JWT via Supabase).

---

## Páginas

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona para `/dashboard` (logado) ou `/login` |
| `/login` | Autenticação email/senha |
| `/dashboard` | Lista ou pipeline de prospects |
| `/dashboard/prospect/[id]` | Página de detalhe do prospect com abas: Briefing, Mensagens, Dados, Interações |

---

## Rodando o Projeto

### Pré-requisitos
- Node.js 18+
- Conta Supabase com projeto criado
- Chave de API do OpenRouter

### Variáveis de ambiente

Crie um arquivo `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
OPENROUTER_API_KEY=sua_chave_openrouter
```

### Instalação e execução

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## Próximos Passos (Roadmap)

### Alta Prioridade
- [ ] **Analytics e relatórios** — Métricas de pipeline, taxa de conversão por etapa, ranking de prospects quentes e atividade por período
- [ ] **Agenda e lembretes** — Dashboard com agenda do dia, alertas por email/push para contatos vencidos, integração com Google Calendar
- [ ] **Importação em batch** — Upload de planilha CSV/Excel com múltiplos CNPJs e enriquecimento automático em fila

### Média Prioridade
- [ ] **Envio real de mensagens** — Integração com LinkedIn API, Resend/SendGrid (email) e WhatsApp Business API
- [ ] **Gestão de stakeholders aprimorada** — Tela dedicada por contato, histórico por pessoa, mapeamento visual Miller Heiman
- [ ] **Templates customizáveis** — Usuário editar/salvar prompts de briefing e biblioteca de mensagens por segmento

### Menor Prioridade
- [ ] **Multi-usuário e times** — Conceito de `workspace` compartilhado, funções/permissões (admin, vendedor, gestor)
- [ ] **Integrações CRM** — Exportar para HubSpot/Pipedrive, sincronização bidirecional, webhooks para n8n/Zapier
- [ ] **Mobile/PWA** — App responsivo para uso em campo com notificações push

---

## Decisões de Arquitetura

- **Server Components** para layouts protegidos por autenticação
- **Client Components** para dashboards interativos
- **API Routes** para operações de backend (enriquecimento, IA, interações)
- Índices no Supabase em colunas de alta frequência: `user_id`, `status`, `priority`, `cnpj`, `proximo_contato`
- Cache de 24h (BrasilAPI) e 7 dias (CNES) via `next: { revalidate }` do Next.js
- Dados brutos de enriquecimento preservados em JSONB (`enrichment_raw`) para não perder informação
- Segmentação de prospects por tipo/porte de instituição para personalizar conteúdo de IA

---

## Contexto de Negócio

A WeKnow vende uma plataforma de BI para instituições de saúde que ainda gerenciam dados em planilhas ou sistemas legados (Tasy, MV, Philips). O processo de vendas é consultivo, de ciclo longo, com múltiplos stakeholders (diretores administrativos, médicos, TI). Esta ferramenta foi construída para dar ao Henrique vantagem competitiva na prospecção — pesquisando, qualificando e criando argumentos de venda personalizados para cada instituição antes do primeiro contato.
