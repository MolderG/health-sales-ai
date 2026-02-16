'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types/prospect';
import type { ProspectWithStats } from '@/types/prospect';

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, '');
  return c.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<ProspectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchProspects();
  }, []);

  async function fetchProspects() {
    const supabase = createClient();
    const { data } = await supabase
      .from('prospects_with_stats')
      .select('*')
      .order('updated_at', { ascending: false });

    setProspects((data as ProspectWithStats[]) || []);
    setLoading(false);
  }

  async function handleAddProspect(e: React.FormEvent) {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    const res = await fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj: cnpjInput }),
    });

    const data = await res.json();

    if (res.status === 409) {
      router.push(`/dashboard/prospect/${data.existing_id}`);
      return;
    }

    if (!res.ok) {
      setModalError(data.error || 'Erro ao adicionar prospect.');
      setSubmitting(false);
      return;
    }

    router.push(`/dashboard/prospect/${data.prospect.id}`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-9 w-44 animate-pulse rounded bg-zinc-200" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-white"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Prospects</h1>
          <p className="text-sm text-zinc-500">
            {prospects.length}{' '}
            {prospects.length === 1 ? 'prospect' : 'prospects'}
          </p>
        </div>
        <button
          onClick={() => {
            setModalOpen(true);
            setCnpjInput('');
            setModalError('');
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Adicionar Prospect
        </button>
      </div>

      {prospects.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-500">
            Nenhum prospect cadastrado ainda.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Adicionar primeiro prospect
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {prospects.map((p) => {
            const statusCfg = STATUS_CONFIG[p.status];
            const priorityCfg = PRIORITY_CONFIG[p.priority];
            const endereco = p.endereco as
              | { municipio?: string; uf?: string }
              | null;

            return (
              <a
                key={p.id}
                href={`/dashboard/prospect/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900">
                      {p.nome_fantasia || p.razao_social || 'Sem nome'}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityCfg.color}`}
                    >
                      {priorityCfg.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{formatCnpj(p.cnpj)}</span>
                    {endereco?.municipio && (
                      <span>
                        {endereco.municipio}
                        {endereco.uf ? `/${endereco.uf}` : ''}
                      </span>
                    )}
                    {p.porte && <span>{p.porte}</span>}
                    <span>
                      {p.total_interacoes}{' '}
                      {p.total_interacoes === 1 ? 'interação' : 'interações'}
                    </span>
                  </div>
                </div>
                {p.score > 0 && (
                  <div className="ml-4 flex-shrink-0 text-right">
                    <span className="text-lg font-semibold text-zinc-900">
                      {p.score}
                    </span>
                    <p className="text-xs text-zinc-500">score</p>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}

      {/* Modal Adicionar Prospect */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-zinc-900">
              Adicionar Prospect
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Informe o CNPJ para buscar dados automaticamente.
            </p>

            <form onSubmit={handleAddProspect} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="cnpj"
                  className="block text-sm font-medium text-zinc-700"
                >
                  CNPJ
                </label>
                <input
                  id="cnpj"
                  type="text"
                  required
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {modalError && (
                <p className="text-sm text-red-600">{modalError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? 'Buscando...' : 'Buscar CNPJ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
