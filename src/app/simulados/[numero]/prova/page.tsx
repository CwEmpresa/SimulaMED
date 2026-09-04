import { notFound, redirect } from 'next/navigation'

import { TelaProva } from '@/components/prova/tela-prova'
import { SIMULADOS, type ImagemApoio, type TabelaDados } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

export default async function ProvaPage({ params }: PageProps<'/simulados/[numero]/prova'>) {
  const { numero } = await params
  const simuladoNumero = Number(numero)
  if (!SIMULADOS.includes(simuladoNumero as (typeof SIMULADOS)[number])) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `prazo_vencido` vem calculado com o relógio do Postgres, a mesma fonte que
  // a política de RLS e finalizar_tentativa usam. Ler Date.now() aqui criaria
  // uma segunda autoridade de tempo — e seria leitura impura no render.
  const { data: tentativa } = await supabase
    .from('tentativas_com_prazo')
    .select('id, iniciado_em, status, prazo_vencido')
    .eq('usuario_id', user.id)
    .eq('simulado_numero', simuladoNumero)
    .eq('status', 'em_andamento')
    .maybeSingle()

  // Sem tentativa aberta, o aluno passa pela tela de regras antes de começar.
  if (!tentativa?.id || !tentativa.iniciado_em) redirect('/simulados')

  // Se o prazo venceu enquanto a aba estava fechada, a prova é corrigida agora
  // — nunca se abre uma prova cujo tempo acabou.
  if (tentativa.prazo_vencido) {
    await supabase.rpc('finalizar_tentativa', { p_tentativa_id: tentativa.id })
    redirect(`/simulados/resultado/${tentativa.id}`)
  }

  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    // Seleção explícita: resposta_correta, comentario_correta e comentario_erros
    // ficam de fora de propósito — durante a prova o gabarito não pode trafegar
    // para o browser, onde qualquer aluno leria no devtools.
    supabase
      .from('questoes')
      .select(
        'id, numero_na_prova, area, subtema, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, tabela_dados, grafico_svg, imagens',
      )
      .eq('tipo', 'simulado')
      .eq('simulado_numero', simuladoNumero)
      .order('numero_na_prova'),
    supabase
      .from('respostas_simulado')
      .select('questao_id, alternativa_escolhida, marcada_para_revisao')
      .eq('tentativa_id', tentativa.id),
  ])

  if (!questoes?.length) redirect('/simulados')

  return (
    <TelaProva
      tentativaId={tentativa.id}
      iniciadoEm={tentativa.iniciado_em}
      simuladoNumero={simuladoNumero}
      questoes={questoes.map((q) => ({
        ...q,
        numero_na_prova: q.numero_na_prova!,
        tabela_dados: q.tabela_dados as TabelaDados | null,
        imagens: q.imagens as ImagemApoio[] | null,
      }))}
      respostasIniciais={respostas ?? []}
    />
  )
}
