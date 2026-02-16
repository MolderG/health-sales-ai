import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateBriefing, AI_MODEL } from '@/lib/ai';
import type { Interaction, Prospect, Stakeholder } from '@/types/prospect';

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
    return NextResponse.json({ error: 'prospect_id é obrigatório' }, { status: 400 });
  }

  // Buscar prospect completo
  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', prospect_id)
    .single();

  if (prospectError || !prospect) {
    return NextResponse.json({ error: 'Prospect não encontrado' }, { status: 404 });
  }

  const p = prospect as Prospect;

  // Buscar últimas 5 interações
  const { data: interactions } = await supabase
    .from('interactions')
    .select('*')
    .eq('prospect_id', prospect_id)
    .order('data_interacao', { ascending: false })
    .limit(5);

  const interacoes = (interactions as Interaction[] | null) || [];

  // Gerar briefing via IA
  let briefing: string;
  try {
    briefing = await generateBriefing({
      nome_fantasia: p.nome_fantasia,
      razao_social: p.razao_social,
      porte: p.porte,
      capital_social: p.capital_social,
      atividade_principal: p.atividade_principal,
      endereco: p.endereco,
      socios: p.socios,
      tipo_estabelecimento: p.tipo_estabelecimento,
      leitos_total: p.leitos_total,
      leitos_sus: p.leitos_sus,
      leitos_nao_sus: p.leitos_nao_sus,
      sistema_gestao: p.sistema_gestao,
      decisor_nome: p.decisor_nome,
      decisor_cargo: p.decisor_cargo,
      stakeholders: p.stakeholders as Stakeholder[] | null,
      interacoes_anteriores: interacoes.map(
        (i) => `[${i.tipo}] ${i.resumo}`
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar briefing';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const now = new Date().toISOString();

  // Atualizar prospect com briefing
  await supabase
    .from('prospects')
    .update({ briefing_ai: briefing, briefing_generated_at: now })
    .eq('id', prospect_id);

  // Salvar no histórico de briefings
  const contexto = {
    nome_fantasia: p.nome_fantasia,
    tipo_estabelecimento: p.tipo_estabelecimento,
    leitos_total: p.leitos_total,
    sistema_gestao: p.sistema_gestao,
    total_interacoes: interacoes.length,
  };

  await supabase.from('briefings').insert({
    user_id: user.id,
    prospect_id,
    conteudo: briefing,
    contexto_usado: contexto,
    modelo_ai: AI_MODEL,
  });

  return NextResponse.json({ success: true, briefing });
}
