import { redirect } from 'next/navigation'

import { CascaApp } from '@/components/casca-app'
import { CartaoSimulado } from '@/components/simulados/cartao-simulado'
import { STATUS_APROVADA } from '@/lib/questoes'
import { SIMULADOS, instanteDeLiberacao, simuladoLiberado } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

export default async function SimuladosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: questoes }, { data: tentativas }, { data: perfil }] = await Promise.all([
    supabase
      .from('questoes')
      .select('simulado_numero')
      .eq('tipo', 'simulado')
      .eq('status', STATUS_APROVADA),
    supabase
      .from('tentativas_simulado')
      .select('simulado_numero, status, nota')
      .eq('usuario_id', user.id),
    supabase.from('usuarios').select('primeiro_login_em').eq('id', user.id).maybeSingle(),
  ])

  const totalPorSimulado = new Map<number, number>()
  for (const q of questoes ?? []) {
    if (q.simulado_numero == null) continue
    totalPorSimulado.set(q.simulado_numero, (totalPorSimulado.get(q.simulado_numero) ?? 0) + 1)
  }

  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Simulados
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-texto-suave">
            Três provas completas, no mesmo formato e no mesmo tempo do exame. A ideia é você já
            ter passado por isso quando o dia chegar.
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SIMULADOS.map((numero, i) => {
            const doSimulado = (tentativas ?? []).filter((t) => t.simulado_numero === numero)
            const finalizadas = doSimulado.filter((t) => t.status === 'finalizado')
            const melhorNota = finalizadas.length
              ? Math.max(...finalizadas.map((t) => Number(t.nota ?? 0)))
              : null
            const alvoLiberacao = instanteDeLiberacao(numero, perfil?.primeiro_login_em ?? null)
            // Decidido aqui (Server Component) via helper puro, não com um
            // Date.now() direto no corpo do componente — o React Compiler proíbe
            // chamar função impura durante o render, mesmo em Server Component.
            const bloqueadoPorTempo = !simuladoLiberado(numero, perfil?.primeiro_login_em ?? null)

            return (
              <CartaoSimulado
                key={numero}
                indice={i}
                numero={numero}
                totalQuestoes={totalPorSimulado.get(numero) ?? 0}
                emAndamento={doSimulado.some((t) => t.status === 'em_andamento')}
                melhorNota={melhorNota}
                bloqueadoPorTempo={bloqueadoPorTempo}
                liberaEm={alvoLiberacao ? alvoLiberacao.toISOString() : null}
              />
            )
          })}
        </section>
      </main>
    </CascaApp>
  )
}
