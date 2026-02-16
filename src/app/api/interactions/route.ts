import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeInteraction } from '@/lib/ai';
import type { Interaction, InteractionType, Prospect } from '@/types/prospect';

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { prospect_id, tipo, resumo, detalhes } = body as {
    prospect_id?: string;
    tipo?: InteractionType;
    resumo?: string;
    detalhes?: string;
  };

  if (!prospect_id || !tipo || !resumo) {
    return NextResponse.json(
      { error: 'prospect_id, tipo e resumo são obrigatórios' },
      { status: 400 }
    );
  }

  // Inserir interação
  const { data: newInteraction, error: insertError } = await supabase
    .from('interactions')
    .insert({
      user_id: user.id,
      prospect_id,
      tipo,
      resumo,
      detalhes: detalhes || null,
    })
    .select()
    .single();

  if (insertError || !newInteraction) {
    return NextResponse.json(
      { error: 'Erro ao salvar interação' },
      { status: 500 }
    );
  }

  // Buscar prospect para contexto da IA
  const { data: prospect } = await supabase
    .from('prospects')
    .select('nome_fantasia, razao_social, porte, tipo_estabelecimento, status')
    .eq('id', prospect_id)
    .single();

  const p = prospect as Pick<
    Prospect,
    'nome_fantasia' | 'razao_social' | 'porte' | 'tipo_estabelecimento' | 'status'
  > | null;

  // Buscar últimas 5 interações anteriores (excluindo a recém-criada)
  const { data: previousInteractions } = await supabase
    .from('interactions')
    .select('tipo, resumo')
    .eq('prospect_id', prospect_id)
    .neq('id', newInteraction.id)
    .order('data_interacao', { ascending: false })
    .limit(5);

  const historico = (previousInteractions as Pick<Interaction, 'tipo' | 'resumo'>[] | null) || [];

  // Analisar com IA
  let analise: { proximos_passos: string; sentimento: string };
  try {
    analise = await analyzeInteraction({
      prospect_nome: p?.nome_fantasia || p?.razao_social || 'Prospect',
      prospect_porte: p?.porte,
      prospect_tipo: p?.tipo_estabelecimento,
      prospect_status: p?.status,
      tipo_interacao: tipo,
      resumo,
      detalhes,
      historico: historico.map((i) => `[${i.tipo}] ${i.resumo}`),
    });
  } catch {
    // Se a IA falhar, retornamos a interação sem análise
    return NextResponse.json({
      success: true,
      interaction: newInteraction,
      analise: null,
    });
  }

  // Atualizar interação com resultado da IA
  const { data: updatedInteraction } = await supabase
    .from('interactions')
    .update({
      proximos_passos_ai: analise.proximos_passos,
      sentimento: analise.sentimento,
    })
    .eq('id', newInteraction.id)
    .select()
    .single();

  return NextResponse.json({
    success: true,
    interaction: updatedInteraction || newInteraction,
    analise: {
      proximos_passos: analise.proximos_passos,
      sentimento: analise.sentimento,
    },
  });
}
