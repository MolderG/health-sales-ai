import type {
  BrasilApiResponse,
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

  // TODO: Integrar dados do CNES (Cadastro Nacional de Estabelecimentos de Saúde)
  // para enriquecer com tipo_estabelecimento, leitos, equipamentos, habilitações.

  return {
    success: true,
    prospect: prospectData as Prospect,
    brasil_api_raw: raw,
  };
}
