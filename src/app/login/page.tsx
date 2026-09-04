'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { IconeAlerta, IconeSeta } from '@/components/ui/icones'
import { botaoPrimario } from '@/components/ui/primitivos'
import { createClient } from '@/lib/supabase/client'

const MENSAGENS_ERRO: Record<string, string> = {
  link_invalido: 'Esse link não é válido. Peça um novo abaixo.',
  link_expirado: 'Esse link expirou. Peça um novo abaixo.',
}

function FormularioLogin() {
  const searchParams = useSearchParams()
  const erroUrl = searchParams.get('erro')
  const destino = searchParams.get('redirect') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [erro, setErro] = useState<string | null>(erroUrl ? MENSAGENS_ERRO[erroUrl] ?? null : null)
  const reduzir = useReducedMotion()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEstado('enviando')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
      },
    })

    if (error) {
      setErro('Não conseguimos enviar o link agora. Tente de novo em alguns segundos.')
      setEstado('parado')
      return
    }

    setEstado('enviado')
  }

  if (estado === 'enviado') {
    return (
      <motion.div
        initial={reduzir ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-2)]"
      >
        <h2 className="font-display text-lg font-semibold tracking-tight">Verifique seu e-mail</h2>
        <p className="mt-2 text-sm leading-relaxed text-texto-suave">
          Enviamos um link de acesso para <strong className="text-texto">{email}</strong>. Abra o
          e-mail e clique no link para entrar. Ele vale por uma hora.
        </p>
        <button
          type="button"
          onClick={() => setEstado('parado')}
          className="mt-4 cursor-pointer text-sm font-medium text-acento underline underline-offset-4"
        >
          Usar outro e-mail
        </button>
      </motion.div>
    )
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-2)]"
    >
      <label htmlFor="email" className="block text-sm font-medium">
        Seu e-mail
      </label>
      <p className="mt-1 text-sm text-texto-suave">Use o mesmo e-mail da sua compra.</p>

      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@exemplo.com"
        aria-describedby={erro ? 'erro-login' : undefined}
        aria-invalid={erro ? true : undefined}
        className="mt-3 w-full rounded-xl border border-borda bg-fundo px-3.5 py-3 text-sm
                   transition-colors placeholder:text-texto-fraco hover:border-borda-forte
                   focus:border-acento focus:outline-none"
      />

      {erro && (
        <p id="erro-login" role="alert" className="mt-2 flex items-center gap-2 text-sm text-erro">
          <IconeAlerta className="size-4 shrink-0" />
          {erro}
        </p>
      )}

      <button type="submit" disabled={estado === 'enviando'} className={`${botaoPrimario} mt-4 w-full`}>
        {estado === 'enviando' ? 'Enviando link...' : 'Entrar'}
        {estado !== 'enviando' && <IconeSeta className="size-4" />}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-12">
      <header className="text-center">
        <h1 className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-simulamed.png" alt="SimulaMed" className="h-8 w-auto" />
        </h1>
        <p className="mt-3 text-sm text-texto-suave">
          ENAMED/ENARE · Faça a prova antes da prova.
        </p>
      </header>

      <Suspense
        fallback={<div className="h-64 rounded-2xl border border-borda bg-superficie" />}
      >
        <FormularioLogin />
      </Suspense>

      <AvisoConteudo className="text-center" />

      <p className="text-center text-xs text-texto-fraco">
        <Link href="/termos" className="underline underline-offset-4 hover:text-texto-suave">
          Termos de Uso
        </Link>
        {' · '}
        <Link href="/privacidade" className="underline underline-offset-4 hover:text-texto-suave">
          Política de Privacidade
        </Link>
      </p>
    </main>
  )
}
