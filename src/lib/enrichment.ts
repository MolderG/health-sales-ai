import type {
  BrasilApiResponse,
  CnesSearchContext,
  DataSusCnesResponse,
  EnrichmentResult,
  Prospect,
} from '@/types/prospect';

export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

export function isValidCnpj(cnpj: string): boolean {
  return cleanCnpj(cnpj).length === 14;
}

export async function fetchCnpjData(cnpj: string): Promise<BrasilApiResponse> {
  const cleaned = cleanCnpj(cnpj);

  const response = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${cleaned}`,
    {
      next: { revalidate: 86400 },
      headers: { 'User-Agent': 'HealthSalesAI/1.0' },
    }
  );

  if (!response.ok) {
    throw new Error(`BrasilAPI retornou status ${response.status} para CNPJ ${cleaned}`);
  }

  return response.json() as Promise<BrasilApiResponse>;
}

const CNES_API_BASE = 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos';
const CNES_TIMEOUT_MS = 10_000;
const CNES_REVALIDATE_S = 604_800; // 7 days

export async function fetchCnesData(
  cnpj: string,
  context?: CnesSearchContext
): Promise<DataSusCnesResponse | null> {
  const cleaned = cleanCnpj(cnpj);

  // Strategy 1: search by CNPJ
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CNES_TIMEOUT_MS);

    const res = await fetch(`${CNES_API_BASE}?cnpj=${cleaned}`, {
      signal: controller.signal,
      next: { revalidate: CNES_REVALIDATE_S },
      headers: { 'User-Agent': 'HealthSalesAI/1.0' },
    });
    clearTimeout(timer);

    if (res.ok) {
      const body = await res.json();
      const items: DataSusCnesResponse[] = Array.isArray(body)
        ? body
        : body?.estabelecimentos ?? [];
      if (items.length > 0) return items[0];
    }
  } catch (err) {
    console.warn('[CNES] Busca por CNPJ falhou:', err);
  }

  // Strategy 2: search by nome_fantasia (fallback)
  if (context?.nome_fantasia) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CNES_TIMEOUT_MS);

      const params = new URLSearchParams({
        nome_fantasia: context.nome_fantasia,
      });
      if (context.uf) params.set('uf', context.uf);

      const res = await fetch(`${CNES_API_BASE}?${params}`, {
        signal: controller.signal,
        next: { revalidate: CNES_REVALIDATE_S },
        headers: { 'User-Agent': 'HealthSalesAI/1.0' },
      });
      clearTimeout(timer);

      if (res.ok) {
        const body = await res.json();
        const items: DataSusCnesResponse[] = Array.isArray(body)
          ? body
          : body?.estabelecimentos ?? [];
        if (items.length > 0) return items[0];
      }
    } catch (err) {
      console.warn('[CNES] Busca por nome falhou:', err);
    }
  }

  return null;
}

export function transformCnesData(raw: DataSusCnesResponse): Partial<Prospect> {
  const cnes_codigo = String(
    raw.codigo_cnes ?? raw.codCnes ?? raw.cod_cnes ?? ''
  ) || null;

  const tipo_estabelecimento =
    raw.descricao_tipo_unidade ??
    raw.tipoUnidadeCnes ??
    raw.tipoUnidade ??
    (raw.tipo_unidade != null ? String(raw.tipo_unidade) : null);

  const subtipo = raw.categoria_unidade ?? raw.categoriaUnidade ?? null;

  let leitos_sus =
    raw.qt_leitos_sus ?? raw.leitos_sus ?? null;
  let leitos_nao_sus =
    raw.qt_leitos_nao_sus ?? raw.leitos_nao_sus ?? raw.numero_leitos_particular ?? null;
  let leitos_total =
    raw.numero_leitos_total ?? raw.qt_leitos_total ?? raw.numero_leitos ?? null;

  // Calculate total from parts if missing
  if (leitos_total == null && leitos_sus != null && leitos_nao_sus != null) {
    leitos_total = leitos_sus + leitos_nao_sus;
  }

  const equipamentos = Array.isArray(raw.equipamentos) ? raw.equipamentos : [];
  const habilitacoes = Array.isArray(raw.habilitacoes) ? raw.habilitacoes : [];

  return {
    cnes_codigo,
    tipo_estabelecimento: tipo_estabelecimento ?? null,
    subtipo: subtipo ?? null,
    leitos_total: leitos_total != null ? Number(leitos_total) : null,
    leitos_sus: leitos_sus != null ? Number(leitos_sus) : null,
    leitos_nao_sus: leitos_nao_sus != null ? Number(leitos_nao_sus) : null,
    equipamentos,
    habilitacoes,
    dados_cnes_raw: raw as Record<string, unknown>,
  };
}

export function transformCnpjData(raw: BrasilApiResponse): Partial<Prospect> {
  return {
    cnpj: cleanCnpj(raw.cnpj),
    razao_social: raw.razao_social,
    nome_fantasia: raw.nome_fantasia || null,
    porte: raw.porte,
    capital_social: raw.capital_social,
    natureza_juridica: raw.natureza_juridica,
    situacao_cadastral: raw.descricao_situacao_cadastral,
    data_abertura: raw.data_inicio_atividade,

    atividade_principal: {
      codigo: String(raw.cnae_fiscal),
      descricao: raw.cnae_fiscal_descricao,
    },

    atividades_secundarias: raw.cnaes_secundarios?.map((cnae) => ({
      codigo: String(cnae.codigo),
      descricao: cnae.descricao,
    })) || [],

    endereco: {
      logradouro: raw.logradouro,
      numero: raw.numero,
      complemento: raw.complemento,
      bairro: raw.bairro,
      municipio: raw.municipio,
      uf: raw.uf,
      cep: raw.cep,
    },

    telefone: raw.ddd_telefone_1 || null,
    email: raw.email || null,

    socios: raw.qsa?.map((socio) => ({
      nome: socio.nome_socio,
      qualificacao: socio.qualificacao_socio,
      faixa_etaria: socio.faixa_etaria,
      data_entrada_sociedade: socio.data_entrada_sociedade,
    })) || [],

    enrichment_raw: raw as unknown as Record<string, unknown>,
  };
}

export async function enrichProspect(cnpj: string): Promise<EnrichmentResult> {
  if (!isValidCnpj(cnpj)) {
    return {
      success: false,
      prospect: null,
      brasil_api_raw: null,
      error: `CNPJ inválido: ${cnpj}. Deve conter 14 dígitos.`,
    };
  }

  let raw: BrasilApiResponse;
  try {
    raw = await fetchCnpjData(cnpj);
  } catch (err) {
    return {
      success: false,
      prospect: null,
      brasil_api_raw: null,
      error: err instanceof Error ? err.message : 'Erro ao consultar BrasilAPI',
    };
  }

  if (raw.descricao_situacao_cadastral !== 'ATIVA') {
    return {
      success: false,
      prospect: null,
      brasil_api_raw: raw,
      error: `CNPJ com situação cadastral "${raw.descricao_situacao_cadastral}". Apenas CNPJs ativos são aceitos.`,
    };
  }

  const prospectData = transformCnpjData(raw);

  // Enriquecer com dados CNES (DataSUS)
  try {
    const cnesRaw = await fetchCnesData(cnpj, {
      nome_fantasia: raw.nome_fantasia,
      municipio: raw.municipio,
      uf: raw.uf,
    });
    if (cnesRaw) {
      Object.assign(prospectData, transformCnesData(cnesRaw));
    }
  } catch (err) {
    console.warn('[CNES] Enrichment failed, continuing without CNES data:', err);
  }

  return {
    success: true,
    prospect: prospectData as Prospect,
    brasil_api_raw: raw,
  };
}
