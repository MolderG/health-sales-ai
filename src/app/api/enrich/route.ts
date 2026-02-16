import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enrichProspect } from '@/lib/enrichment';
import { cleanCnpj } from '@/lib/enrichment';

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { cnpj } = body as { cnpj?: string };

  if (!cnpj) {
    return NextResponse.json({ error: 'CNPJ é obrigatório' }, { status: 400 });
  }

  const cleaned = cleanCnpj(cnpj);

  // Verificar se prospect já existe para esse usuário
  const { data: existing } = await supabase
    .from('prospects')
    .select('id')
    .eq('user_id', user.id)
    .eq('cnpj', cleaned)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'Prospect já cadastrado', existing_id: existing.id },
      { status: 409 }
    );
  }

  // Enriquecer via BrasilAPI
  const result = await enrichProspect(cnpj);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Inserir no Supabase
  const { data: prospect, error } = await supabase
    .from('prospects')
    .insert({ ...result.prospect, user_id: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, prospect });
}
