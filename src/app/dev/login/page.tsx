import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Login por senha — EXCLUSIVO PARA DESENVOLVIMENTO.
 *
 * Existe só para permitir verificação visual e testes automatizados das telas
 * protegidas sem precisar simular uma compra aprovada na Lowify a cada vez —
 * o acesso real depende do webhook liberar `usuarios.acesso_liberado_em` (ver
 * AGENTS.md, "Acesso por e-mail"); o usuário de dev
 * (scripts/criar-usuario-dev.mjs) já nasce com essa marca simulada. A guarda
 * é repetida em três lugares de propósito (página, action e proxy): se
 * qualquer uma falhar sozinha, esta rota vira um bypass de autenticação em
 * produção.
 */
const HABILITADO = process.env.NODE_ENV !== 'production'

async function entrarComSenha(formData: FormData) {
  'use server'

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Login por senha indisponível em produção.')
  }

  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) redirect('/dev/login?erro=1')
  redirect('/dashboard')
}

export default async function DevLoginPage({ searchParams }: PageProps<'/dev/login'>) {
  if (!HABILITADO) notFound()

  const { erro } = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-12">
      <header>
        <p className="inline-block rounded bg-alerta-suave px-2 py-0.5 text-xs font-semibold text-alerta">
          Somente desenvolvimento
        </p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Entrar com senha</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Atalho para testar telas protegidas sem simular uma compra aprovada. Esta rota retorna 404
          quando <code className="font-mono">NODE_ENV=production</code>.
        </p>
      </header>

      <form action={entrarComSenha} className="rounded-xl border border-borda bg-superficie p-6">
        <label htmlFor="email" className="block text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-2 w-full rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm
                     focus:border-acento focus:outline-none"
        />

        <label htmlFor="senha" className="mt-4 block text-sm font-medium">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm
                     focus:border-acento focus:outline-none"
        />

        {erro && (
          <p role="alert" className="mt-3 text-sm text-erro">
            E-mail ou senha incorretos.
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-acento px-4 py-2.5 text-sm font-semibold text-acento-texto
                     transition-colors hover:bg-acento-forte"
        >
          Entrar
        </button>
      </form>
    </main>
  )
}
