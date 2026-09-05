import Link from 'next/link'

import { entrarComEmail } from '@/app/actions/acesso'
import { IconeAlerta, IconeSeta } from '@/components/ui/icones'
import { botaoPrimario } from '@/components/ui/primitivos'

const MENSAGENS_ERRO: Record<string, string> = {
  email_invalido: 'Digite um e-mail válido.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  sem_acesso:
    'Não conseguimos liberar o acesso com esse e-mail. Confira se é o mesmo e-mail usado na compra.',
}

/**
 * Acesso por e-mail, sem senha e sem link enviado por e-mail — ver
 * src/app/actions/acesso.ts. O formulário funciona sem JavaScript (é uma
 * server action de verdade, não fetch no cliente).
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const erroUrl = typeof params.erro === 'string' ? params.erro : undefined
  const destino = typeof params.redirect === 'string' ? params.redirect : '/dashboard'
  const erro = erroUrl ? (MENSAGENS_ERRO[erroUrl] ?? null) : null

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

      <form
        action={entrarComEmail}
        className="rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-2)]"
      >
        <input type="hidden" name="redirect" value={destino} />

        <label htmlFor="email" className="block text-sm font-medium">
          Seu e-mail
        </label>
        <p className="mt-1 text-sm text-texto-suave">Use o mesmo e-mail da sua compra.</p>

        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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

        <button type="submit" className={`${botaoPrimario} mt-4 w-full`}>
          Entrar
          <IconeSeta className="size-4" />
        </button>
      </form>

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
