'use client';

import { useEffect, useMemo, useState } from 'react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types/prospect';
import type {
  ProspectWithStats,
  ProspectStatus,
  ProspectPriority,
} from '@/types/prospect';

const PIPELINE_ORDER: ProspectStatus[] = [
  'novo',
  'pesquisando',
  'contatado',
  'reuniao_agendada',
  'proposta_enviada',
  'negociando',
  'ganho',
  'perdido',
  'inativo',
];

const COLUMN_HEADER_COLORS: Record<ProspectStatus, string> = {
  novo: 'bg-blue-100 border-blue-300',
  pesquisando: 'bg-cyan-100 border-cyan-300',
  contatado: 'bg-yellow-100 border-yellow-300',
  reuniao_agendada: 'bg-purple-100 border-purple-300',
  proposta_enviada: 'bg-orange-100 border-orange-300',
  negociando: 'bg-amber-100 border-amber-300',
  ganho: 'bg-green-100 border-green-300',
  perdido: 'bg-red-100 border-red-300',
  inativo: 'bg-gray-100 border-gray-300',
};

const PRIORITY_BORDER_COLORS: Record<ProspectPriority, string> = {
  alta: 'border-l-red-400',
  media: 'border-l-yellow-400',
  baixa: 'border-l-green-400',
};

interface PipelineViewProps {
  prospects: ProspectWithStats[];
}

const TERMINAL_STATUSES: ProspectStatus[] = ['ganho', 'perdido', 'inativo'];

export default function PipelineView({ prospects }: PipelineViewProps) {
  const [collapsedColumns, setCollapsedColumns] = useState<Set<ProspectStatus>>(
    () => new Set(['perdido', 'inativo'])
  );
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    setIsMobile(mql.matches);
    function handler(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const grouped = useMemo(() => {
    const map: Record<ProspectStatus, ProspectWithStats[]> = {} as Record<
      ProspectStatus,
      ProspectWithStats[]
    >;
    for (const s of PIPELINE_ORDER) map[s] = [];
    for (const p of prospects) {
      if (map[p.status]) map[p.status].push(p);
    }
    return map;
  }, [prospects]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const fourteenDays = 14 * 86400000;

    let contatoVencido = 0;
    let semInteracao14d = 0;
    let ganhos = 0;
    let perdidos = 0;

    for (const p of prospects) {
      const isTerminal = TERMINAL_STATUSES.includes(p.status);

      if (p.status === 'ganho') ganhos++;
      if (p.status === 'perdido') perdidos++;

      if (
        !isTerminal &&
        p.proximo_contato &&
        new Date(p.proximo_contato).getTime() < now
      ) {
        contatoVencido++;
      }

      if (!isTerminal) {
        if (
          !p.ultima_interacao ||
          now - new Date(p.ultima_interacao).getTime() > fourteenDays
        ) {
          semInteracao14d++;
        }
      }
    }

    const total = ganhos + perdidos;
    const winRate =
      total > 0 ? ((ganhos / total) * 100).toFixed(1) + '%' : 'N/A';

    return { contatoVencido, semInteracao14d, winRate };
  }, [prospects]);

  function toggleColumn(status: ProspectStatus) {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="text-lg font-semibold text-zinc-900">
            {prospects.length}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">Contato vencido</p>
          <p className="text-lg font-semibold text-red-700">
            {metrics.contatoVencido}
          </p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-xs text-yellow-700">Sem interação 14d</p>
          <p className="text-lg font-semibold text-yellow-700">
            {metrics.semInteracao14d}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs text-zinc-500">Win rate</p>
          <p className="text-lg font-semibold text-zinc-900">
            {metrics.winRate}
          </p>
        </div>
      </div>

      {/* Pipeline columns */}
      <div
        className={
          isMobile
            ? 'flex flex-col gap-4'
            : 'flex gap-4 overflow-x-auto pb-4'
        }
      >
        {PIPELINE_ORDER.map((status) => {
          const items = grouped[status];
          const collapsed = collapsedColumns.has(status);
          const cfg = STATUS_CONFIG[status];

          return (
            <div
              key={status}
              className={
                isMobile
                  ? 'w-full'
                  : 'min-w-[280px] w-[280px] flex-shrink-0'
              }
            >
              {/* Column header */}
              <button
                type="button"
                onClick={() => toggleColumn(status)}
                className={`flex w-full items-center justify-between rounded-t-lg border px-3 py-2 text-left ${COLUMN_HEADER_COLORS[status]}`}
              >
                <span className="text-sm font-medium">
                  {cfg.label} ({items.length})
                </span>
                <span className="text-xs text-zinc-500">
                  {collapsed ? '▸' : '▾'}
                </span>
              </button>

              {/* Column body */}
              {!collapsed && (
                <div className="space-y-2 rounded-b-lg border border-t-0 border-zinc-200 bg-zinc-50 p-2">
                  {items.length === 0 ? (
                    <p className="py-4 text-center text-xs text-zinc-400">
                      Nenhum prospect
                    </p>
                  ) : (
                    items.map((p) => (
                      <ProspectCard key={p.id} prospect={p} />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProspectCard({ prospect: p }: { prospect: ProspectWithStats }) {
  const endereco = p.endereco as
    | { municipio?: string; uf?: string }
    | null;

  const priorityCfg = PRIORITY_CONFIG[p.priority];

  let diasLabel: string;
  let diasColor: string;

  if (!p.ultima_interacao) {
    diasLabel = 'Sem interação';
    diasColor = 'text-zinc-400';
  } else {
    const dias = Math.floor(
      (Date.now() - new Date(p.ultima_interacao).getTime()) / 86400000
    );
    diasLabel = `${dias}d atrás`;
    diasColor = dias > 14 ? 'text-amber-600' : 'text-zinc-500';
  }

  const localidade = endereco?.municipio
    ? `${endereco.municipio}${endereco.uf ? `/${endereco.uf}` : ''}`
    : null;

  const info = p.leitos_total
    ? `${p.leitos_total} leitos`
    : p.porte || null;

  return (
    <a
      href={`/dashboard/prospect/${p.id}`}
      className={`block rounded-lg border border-zinc-200 border-l-4 bg-white p-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 ${PRIORITY_BORDER_COLORS[p.priority]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-900">
          {p.nome_fantasia || p.razao_social || 'Sem nome'}
        </span>
        <span
          className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priorityCfg.color}`}
        >
          {priorityCfg.label}
        </span>
      </div>

      {localidade && (
        <p className="mt-1 text-xs text-zinc-500">{localidade}</p>
      )}

      <div className="mt-1 flex items-center justify-between">
        {info && <span className="text-xs text-zinc-500">{info}</span>}
        <span className={`ml-auto text-xs ${diasColor}`}>{diasLabel}</span>
      </div>
    </a>
  );
}
