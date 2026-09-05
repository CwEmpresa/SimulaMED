import { redirect } from 'next/navigation'

import { salvarNome } from '@/app/actions/perfil'
import { CascaApp } from '@/components/casca-app'
import { IconeSair } from '@/components/ui/icones'
import { botaoPrimario, botaoSecundario } from '@/components/ui/primitivos'
import { createClient } from '@/lib/supabase/server'

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nome, email, criado_em')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <CascaApp>
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Sua conta
        </h1>
      </header>

      <section className="mt-6 rounded-2xl border border-borda bg-superficie p-6
                          shadow-[var(--sombra-1)]">
        <form action={salvarNome}>
          <label htmlFor="nome" className="block text-sm font-medium">
            Nome
          </label>
          <p className="mt-1 text-sm text-texto-suave">Como você prefere ser chamado.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              id="nome"
              name="nome"
              type="text"
              maxLength={120}
              defaultValue={perfil?.nome ?? ''}
              placeholder="Seu nome"
              className="min-w-0 flex-1 rounded-xl border border-borda bg-fundo px-3.5 py-2.5 text-sm
                         transition-colors placeholder:text-texto-fraco hover:border-borda-forte
                         focus:border-acento focus:outline-none"
            />
            <button type="submit" className={botaoPrimario}>
              Salvar
            </button>
          </div>
        </form>

        <dl className="mt-6 flex flex-col gap-4 border-t border-borda pt-6">
          <div>
            <dt className="text-sm font-medium">E-mail</dt>
            <dd className="mt-1 text-sm text-texto-suave">{perfil?.email ?? user.email}</dd>
            <p className="mt-1 text-xs text-texto-fraco">
              É o e-mail da sua compra e não pode ser alterado por aqui. Se precisar trocar,
              fale com o suporte.
            </p>
          </div>

          <div>
            <dt className="text-sm font-medium">Acesso desde</dt>
            <dd className="mt-1 text-sm text-texto-suave">
              {perfil?.criado_em ? formatarData(perfil.criado_em) : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <form action="/auth/signout" method="post" className="mt-6">
        <button type="submit" className={botaoSecundario}>
          <IconeSair className="size-4" />
          Sair da conta
        </button>
      </form>
    </main>
    </CascaApp>
  )
}
