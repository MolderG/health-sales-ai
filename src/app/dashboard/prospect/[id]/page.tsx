'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
} from '@/types/prospect';
import type {
  Prospect,
  Interaction,
  ProspectStatus,
  InteractionType,
  Endereco,
  Socio,
  AtividadeEconomica,
  Stakeholder,
} from '@/types/prospect';

const INTERACTION_LABELS: Record<InteractionType, string> = {
  ligacao: 'Ligação',
  email: 'Email',
  reuniao: 'Reunião',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  visita: 'Visita',
  evento: 'Evento',
  outro: 'Outro',
};

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, '');
  return c.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

function formatCurrency(value: number | null) {
  if (value == null) return 'N/A';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Tab = 'briefing' | 'dados' | 'interacoes';

export default function ProspectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('briefing');

  // Briefing state
  const [generatingBriefing, setGeneratingBriefing] = useState(false);

  // CNES state
  const [refreshingCnes, setRefreshingCnes] = useState(false);
  const [cnesError, setCnesError] = useState('');

  // Notes state
  const [notas, setNotas] = useState('');

  // New interaction form
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [newInteractionType, setNewInteractionType] =
    useState<InteractionType>('ligacao');
  const [newInteractionResumo, setNewInteractionResumo] = useState('');
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [analyzingInteraction, setAnalyzingInteraction] = useState(false);
  const [lastAnalise, setLastAnalise] = useState<{
    proximos_passos: string;
    sentimento: string;
  } | null>(null);
  const [showProximoContatoPicker, setShowProximoContatoPicker] = useState(false);
  const [proximoContatoDate, setProximoContatoDate] = useState('');

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [{ data: prospectData }, { data: interactionsData }] =
      await Promise.all([
        supabase.from('prospects').select('*').eq('id', id).single(),
        supabase
          .from('interactions')
          .select('*')
          .eq('prospect_id', id)
          .order('data_interacao', { ascending: false }),
      ]);

    if (prospectData) {
      setProspect(prospectData as Prospect);
      setNotas((prospectData as Prospect).notas || '');
    }
    setInteractions((interactionsData as Interaction[]) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStatusChange(newStatus: ProspectStatus) {
    if (!prospect) return;
    const supabase = createClient();
    await supabase
      .from('prospects')
      .update({ status: newStatus })
      .eq('id', prospect.id);
    setProspect({ ...prospect, status: newStatus });
  }

  const [briefingError, setBriefingError] = useState('');

  async function handleGenerateBriefing() {
    setGeneratingBriefing(true);
    setBriefingError('');
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBriefingError(data.error || 'Erro ao gerar briefing.');
      } else if (data.success && prospect) {
        setProspect({
          ...prospect,
          briefing_ai: data.briefing,
          briefing_generated_at: new Date().toISOString(),
        });
      }
    } catch {
      setBriefingError('Erro de conexão ao gerar briefing.');
    }
    setGeneratingBriefing(false);
  }

  async function handleRefreshCnes() {
    setRefreshingCnes(true);
    setCnesError('');
    try {
      const res = await fetch('/api/enrich/cnes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCnesError(data.error || 'Erro ao buscar dados CNES.');
      } else if (data.success && prospect) {
        setProspect({ ...prospect, ...data.prospect });
      }
    } catch {
      setCnesError('Erro de conexão ao buscar dados CNES.');
    }
    setRefreshingCnes(false);
  }

  async function handleSaveNotas() {
    if (!prospect) return;
    const supabase = createClient();
    await supabase
      .from('prospects')
      .update({ notas })
      .eq('id', prospect.id);
  }

  async function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!prospect) return;
    setSavingInteraction(true);
    setAnalyzingInteraction(true);
    setLastAnalise(null);

    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: prospect.id,
          tipo: newInteractionType,
          resumo: newInteractionResumo,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setInteractions([data.interaction as Interaction, ...interactions]);
        if (data.analise) {
          setLastAnalise(data.analise);
        }
      }
    } catch {
      // Silently handle - interaction may have been saved without analysis
    }

    setNewInteractionResumo('');
    setShowInteractionForm(false);
    setSavingInteraction(false);
    setAnalyzingInteraction(false);
  }

  async function handleSetProximoContato() {
    if (!prospect || !proximoContatoDate) return;
    const supabase = createClient();
    await supabase
      .from('prospects')
      .update({ proximo_contato: proximoContatoDate })
      .eq('id', prospect.id);
    setProspect({ ...prospect, proximo_contato: proximoContatoDate });
    setShowProximoContatoPicker(false);
    setProximoContatoDate('');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-60 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-6 h-64 animate-pulse rounded-lg border border-zinc-200 bg-white" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-zinc-500">Prospect não encontrado.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-sm text-zinc-900 underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  const endereco = prospect.endereco as Endereco | null;
  const socios = prospect.socios as Socio[] | null;
  const atividadePrincipal =
    prospect.atividade_principal as AtividadeEconomica | null;
  const stakeholders = prospect.stakeholders as Stakeholder[] | null;
  const statusCfg = STATUS_CONFIG[prospect.status];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            &larr; Voltar
          </button>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">
            {prospect.nome_fantasia || prospect.razao_social || 'Sem nome'}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
            <span>{formatCnpj(prospect.cnpj)}</span>
            {endereco?.municipio && (
              <span>
                {endereco.municipio}
                {endereco.uf ? `/${endereco.uf}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={prospect.status}
            onChange={(e) =>
              handleStatusChange(e.target.value as ProspectStatus)
            }
            className={`rounded-full border-0 px-3 py-1 text-xs font-medium ${statusCfg.color} cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-300`}
          >
            {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>
                {cfg.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerateBriefing}
            disabled={generatingBriefing}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {generatingBriefing ? 'Gerando...' : 'Gerar Briefing'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {([
          ['briefing', 'Briefing IA'],
          ['dados', 'Dados da Empresa'],
          ['interacoes', 'Interações'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-b-2 border-zinc-900 text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* --- Briefing IA --- */}
        {tab === 'briefing' && (
          <div>
            {prospect.briefing_ai ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    Gerado em{' '}
                    {formatDate(prospect.briefing_generated_at)}
                  </p>
                </div>
                <div className="prose prose-sm prose-zinc max-w-none whitespace-pre-wrap text-sm text-zinc-700">
                  {prospect.briefing_ai}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center">
                <p className="text-sm text-zinc-500">
                  Nenhum briefing gerado ainda.
                </p>
                <button
                  onClick={handleGenerateBriefing}
                  disabled={generatingBriefing}
                  className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {generatingBriefing
                    ? 'Gerando...'
                    : 'Gerar Primeiro Briefing'}
                </button>
              </div>
            )}

            {briefingError && (
              <p className="mt-4 text-sm text-red-600">{briefingError}</p>
            )}
          </div>
        )}

        {/* --- Dados da Empresa --- */}
        {tab === 'dados' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Informações Gerais
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['Razão Social', prospect.razao_social],
                  ['Nome Fantasia', prospect.nome_fantasia],
                  ['Porte', prospect.porte],
                  ['Capital Social', formatCurrency(prospect.capital_social)],
                  ['Natureza Jurídica', prospect.natureza_juridica],
                  ['Situação Cadastral', prospect.situacao_cadastral],
                  [
                    'Atividade Principal',
                    atividadePrincipal
                      ? `${atividadePrincipal.codigo} - ${atividadePrincipal.descricao}`
                      : null,
                  ],
                  ['Telefone', prospect.telefone],
                ] as [string, string | null][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="mt-0.5 text-sm text-zinc-900">
                      {value || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dados Hospitalares (CNES) */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Dados Hospitalares (CNES)
                </h3>
                <button
                  onClick={handleRefreshCnes}
                  disabled={refreshingCnes}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                >
                  {refreshingCnes ? 'Buscando...' : 'Atualizar dados CNES'}
                </button>
              </div>

              {cnesError && (
                <p className="mb-4 text-sm text-red-600">{cnesError}</p>
              )}

              {prospect.cnes_codigo ||
              prospect.tipo_estabelecimento ||
              prospect.leitos_total != null ? (
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      ['Código CNES', prospect.cnes_codigo],
                      ['Tipo de Estabelecimento', prospect.tipo_estabelecimento],
                      ['Subtipo', prospect.subtipo],
                    ] as [string, string | null][]).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-zinc-500">{label}</p>
                        <p className="mt-0.5 text-sm text-zinc-900">
                          {value || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-zinc-50 p-3 text-center">
                      <p className="text-xs text-zinc-500">Total de Leitos</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900">
                        {prospect.leitos_total ?? 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                      <p className="text-xs text-blue-600">Leitos SUS</p>
                      <p className="mt-1 text-lg font-semibold text-blue-700">
                        {prospect.leitos_sus ?? 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <p className="text-xs text-amber-600">Leitos Não-SUS</p>
                      <p className="mt-1 text-lg font-semibold text-amber-700">
                        {prospect.leitos_nao_sus ?? 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    Dados CNES não disponíveis para este estabelecimento
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Clique em &quot;Atualizar dados CNES&quot; para tentar novamente
                  </p>
                </div>
              )}
            </div>

            {endereco && (
              <div className="rounded-lg border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                  Endereço
                </h3>
                <p className="text-sm text-zinc-700">
                  {[
                    endereco.logradouro,
                    endereco.numero,
                    endereco.complemento,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="text-sm text-zinc-700">
                  {[endereco.bairro, endereco.municipio, endereco.uf]
                    .filter(Boolean)
                    .join(' - ')}
                  {endereco.cep ? ` — CEP ${endereco.cep}` : ''}
                </p>
              </div>
            )}

            {socios && socios.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                  Sócios
                </h3>
                <ul className="space-y-2">
                  {socios.map((s, i) => (
                    <li key={i} className="text-sm text-zinc-700">
                      <span className="font-medium">{s.nome}</span>
                      {s.qualificacao && (
                        <span className="text-zinc-500">
                          {' '}
                          — {s.qualificacao}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stakeholders && stakeholders.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                  Stakeholders
                </h3>
                <ul className="space-y-2">
                  {stakeholders.map((s, i) => (
                    <li key={i} className="text-sm text-zinc-700">
                      <span className="font-medium">{s.nome}</span>
                      <span className="text-zinc-500">
                        {' '}
                        — {s.cargo} ({s.papel_miller_heiman})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Notas
              </h3>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                onBlur={handleSaveNotas}
                rows={4}
                placeholder="Adicione notas sobre este prospect..."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>
        )}

        {/* --- Interações --- */}
        {tab === 'interacoes' && (
          <div>
            <div className="mb-4">
              {!showInteractionForm ? (
                <button
                  onClick={() => setShowInteractionForm(true)}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  + Registrar Interação
                </button>
              ) : (
                <form
                  onSubmit={handleAddInteraction}
                  className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3"
                >
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Tipo
                    </label>
                    <select
                      value={newInteractionType}
                      onChange={(e) =>
                        setNewInteractionType(
                          e.target.value as InteractionType
                        )
                      }
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    >
                      {Object.entries(INTERACTION_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Resumo
                    </label>
                    <textarea
                      required
                      value={newInteractionResumo}
                      onChange={(e) =>
                        setNewInteractionResumo(e.target.value)
                      }
                      rows={3}
                      placeholder="Descreva o que aconteceu..."
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInteractionForm(false)}
                      className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingInteraction}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {savingInteraction ? 'Salvando e analisando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {analyzingInteraction && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <svg
                  className="h-5 w-5 animate-spin text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-sm font-medium text-blue-700">
                  Analisando interação com IA...
                </span>
              </div>
            )}

            {lastAnalise && !analyzingInteraction && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-blue-900">
                    Análise da IA
                  </h4>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      lastAnalise.sentimento === 'positivo'
                        ? 'bg-green-100 text-green-800'
                        : lastAnalise.sentimento === 'negativo'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {lastAnalise.sentimento === 'positivo'
                      ? 'Positivo'
                      : lastAnalise.sentimento === 'negativo'
                        ? 'Negativo'
                        : 'Neutro'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-blue-800">
                  {lastAnalise.proximos_passos}
                </p>
                <div className="mt-3">
                  {!showProximoContatoPicker ? (
                    <button
                      onClick={() => setShowProximoContatoPicker(true)}
                      className="rounded-md bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      Definir próximo contato
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={proximoContatoDate}
                        onChange={(e) => setProximoContatoDate(e.target.value)}
                        className="rounded-md border border-blue-300 px-2 py-1 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleSetProximoContato}
                        disabled={!proximoContatoDate}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setShowProximoContatoPicker(false)}
                        className="rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {interactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center">
                <p className="text-sm text-zinc-500">
                  Nenhuma interação registrada.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {interactions.map((interaction) => (
                  <div
                    key={interaction.id}
                    className="rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {INTERACTION_LABELS[interaction.tipo]}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatDate(interaction.data_interacao)}
                      </span>
                      {interaction.sentimento && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            interaction.sentimento === 'positivo'
                              ? 'bg-green-100 text-green-800'
                              : interaction.sentimento === 'negativo'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {interaction.sentimento === 'positivo'
                            ? 'Positivo'
                            : interaction.sentimento === 'negativo'
                              ? 'Negativo'
                              : 'Neutro'}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">
                      {interaction.resumo}
                    </p>
                    {interaction.proximos_passos_ai && (
                      <div className="mt-3 rounded-md bg-blue-50 p-3">
                        <p className="text-xs font-medium text-blue-800">
                          Próximos passos (IA)
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                          {interaction.proximos_passos_ai}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
