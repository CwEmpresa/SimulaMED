import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CascaApp } from '@/components/casca-app'
import { GabaritoSimulado, type QuestaoGabarito } from '@/components/resultado/gabarito-simulado'
import type { Alternativa, ImagemApoio, TabelaDados } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

export default async function GabaritoPage({
  params,
}: PageProps<'/simulados/resultado/[id]/gabarito'>) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // O RLS já impede ler a tentativa de outro usuário; aqui só tratamos o "não existe".
  const { data: tentativa } = await supabase
    .from('tentativas_simulado')
    .select('id, simulado_numero, status')
    .eq('id', id)
    .maybeSingle()

  if (!tentativa) notFound()
  // O gabarito só é liberado (pela view gabaritos_liberados) depois de
  // finalizada — antes disso não há o que mostrar aqui.
  if (tentativa.status !== 'finalizado') {
    redirect(`/simulados/${tentativa.simulado_numero}/prova`)
  }

  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    supabase
      .from('questoes')
      .select(
        'id, numero_na_prova, area, subtema, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, tabela_dados, grafico_svg, imagens',
      )
      .eq('tipo', 'simulado')
      .eq('simulado_numero', tentativa.simulado_numero)
      .order('numero_na_prova'),
    supabase
      .from('respostas_simulado')
      .select('questao_id, alternativa_escolhida')
      .eq('tentativa_id', tentativa.id),
  ])

  if (!questoes?.length) notFound()

  const idsQuestoes = questoes.map((q) => q.id)
  const { data: gabaritos } = await supabase
    .from('gabaritos_liberados')
    .select('questao_id, resposta_correta, comentario_correta, comentario_erros')
    .in('questao_id', idsQuestoes)

  const gabaritoPorQuestao = new Map((gabaritos ?? []).map((g) => [g.questao_id, g]))
  const respostaPorQuestao = new Map(
    (respostas ?? []).map((r) => [r.questao_id, r.alternativa_escolhida]),
  )

  // Se a tentativa está finalizada, gabaritos_liberados garante o gabarito das
  // 100 questões — mas nunca inventamos uma resposta correta pra questão sem
  // gabarito resolvido. Nesta tela o propósito inteiro é mostrar o resultado
  // certo; errar "quieto" (ex.: assumir 'A') seria pior que simplesmente
  // deixar a questão de fora e ter um contador que não bate com 100.
  const questoesGabarito: QuestaoGabarito[] = questoes
    .map((q) => {
      const gabarito = gabaritoPorQuestao.get(q.id)
      if (!gabarito?.resposta_correta) return null
      return {
        ...q,
        numero_na_prova: q.numero_na_prova!,
        tabela_dados: q.tabela_dados as TabelaDados | null,
        imagens: q.imagens as ImagemApoio[] | null,
        resposta_correta: gabarito.resposta_correta as Alternativa,
        comentario_correta: gabarito.comentario_correta ?? null,
        comentario_erros: gabarito.comentario_erros ?? null,
        respostaEscolhida: (respostaPorQuestao.get(q.id) as Alternativa | null) ?? null,
      }
    })
    .filter((q): q is QuestaoGabarito => q !== null)

  if (questoesGabarito.length === 0) notFound()

  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        <nav className="mb-6">
          <Link
            href={`/simulados/resultado/${tentativa.id}`}
            className="text-sm text-texto-suave hover:text-texto"
          >
            ← Voltar ao resultado
          </Link>
        </nav>

        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Gabarito — Simulado {tentativa.simulado_numero}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-texto-suave">
            Todas as 100 questões, com sua resposta, a resposta correta e o porquê de cada uma.
          </p>
        </header>

        <GabaritoSimulado questoes={questoesGabarito} />
      </main>
    </CascaApp>
  )
}
