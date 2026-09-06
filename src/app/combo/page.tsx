import Link from 'next/link'
import { redirect } from 'next/navigation'

import type { QuestaoBanco } from '@/components/banco/praticar-banco'
import { CascaApp } from '@/components/casca-app'
import { JogoCombo } from '@/components/combo/jogo-combo'
import { IconeEmProducao } from '@/components/ui/icones'
import { EstadoVazio, botaoPrimario } from '@/components/ui/primitivos'
import { COLUNAS_SEGURAS_BANCO, STATUS_APROVADA } from '@/lib/questoes'
import { createClient } from '@/lib/supabase/server'

export default async function ComboPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: perfil }, { data: questoes }] = await Promise.all([
    supabase.from('usuarios').select('recorde_combo').eq('id', user.id).maybeSingle(),
    // Mesmas colunas seguras do Banco (ver AGENTS.md: nunca select('*') em
    // `questoes` — resposta_correta e comentários não têm grant de coluna
    // para `authenticated`, e select('*') falharia em silêncio, não com erro).
    supabase
      .from('questoes')
      .select(COLUNAS_SEGURAS_BANCO)
      .eq('tipo', 'banco')
      .eq('status', STATUS_APROVADA),
  ])

  const acervo = (questoes ?? []) as QuestaoBanco[]

  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Modo Combo
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-texto-suave">
            Uma questão de cada vez, contra o relógio. Erre ou deixe o tempo acabar e o combo
            zera, mas você pode tentar de novo quantas vezes quiser.
          </p>
        </header>

        {acervo.length === 0 ? (
          <EstadoVazio
            icone={<IconeEmProducao className="size-7" />}
            titulo="Banco de questões em produção"
            descricao="O Modo Combo puxa questões do banco, que ainda está sendo escrito e revisado. Assim que houver questões publicadas, o combo libera automaticamente."
            acoes={
              <Link href="/simulados" className={botaoPrimario}>
                Fazer um simulado
              </Link>
            }
          />
        ) : (
          <JogoCombo questoes={acervo} recordeInicial={perfil?.recorde_combo ?? 0} />
        )}
      </main>
    </CascaApp>
  )
}
