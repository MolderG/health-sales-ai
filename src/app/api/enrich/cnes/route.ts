import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCnesData, transformCnesData, cleanCnpj } from '@/lib/enrichment';

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { prospect_id } = body as { prospect_id?: string };

  if (!prospect_id) {
    return NextResponse.json(
      { error: 'prospect_id é obrigatório' },
      { status: 400 }
    );
  }

  // Fetch prospect from DB
  const { data: prospect, error: fetchError } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', prospect_id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !prospect) {
    return NextResponse.json(
      { error: 'Prospect não encontrado' },
      { status: 404 }
    );
  }

  const cnpj = prospect.cnpj as string;
  if (!cnpj) {
    return NextResponse.json(
      { error: 'Prospect não possui CNPJ' },
      { status: 422 }
    );
  }

  // Fetch CNES data
  const cnesRaw = await fetchCnesData(cleanCnpj(cnpj), {
    nome_fantasia: prospect.nome_fantasia as string | null,
    municipio: (prospect.endereco as Record<string, unknown>)?.municipio as string | undefined,
    uf: (prospect.endereco as Record<string, unknown>)?.uf as string | undefined,
  });

  if (!cnesRaw) {
    return NextResponse.json(
      {
        error:
          'Não foi possível encontrar dados CNES para este estabelecimento. A API do DataSUS pode estar indisponível — tente novamente mais tarde.',
      },
      { status: 502 }
    );
  }

  const cnesData = transformCnesData(cnesRaw);

  // Update only CNES fields
  const { data: updated, error: updateError } = await supabase
    .from('prospects')
    .update(cnesData)
    .eq('id', prospect_id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, prospect: updated });
}
