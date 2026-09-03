'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  IconeBanco,
  IconeCaderno,
  IconeDiagnostico,
  IconeSimulado,
  IconeUsuario,
} from '@/components/ui/icones'

const SECOES = [
  { href: '/simulados', rotulo: 'Simulados', Icone: IconeSimulado },
  { href: '/banco', rotulo: 'Banco', Icone: IconeBanco },
  { href: '/cadernos', rotulo: 'Cadernos', Icone: IconeCaderno },
  { href: '/diagnostico', rotulo: 'Diagnóstico', Icone: IconeDiagnostico },
] as const

/**
 * Casca da área logada: barra superior no desktop, barra inferior no celular.
 *
 * Não é aplicada no Modo Prova de propósito — durante as 5 horas a tela precisa
 * ser um ambiente fechado, sem atalhos para sair sem querer.
 *
 * No celular a navegação vai para baixo porque é onde o polegar alcança, e cada
 * alvo tem 44px de altura mínima.
 */
export function CascaApp({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-borda bg-superficie/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-3">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 font-display text-sm font-semibold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-acento text-acento-texto shadow-[var(--sombra-acento)]"
            >
              <IconeSimulado className="size-[18px]" />
            </span>
            <span className="hidden sm:inline">Reta Final</span>
          </Link>

          <nav aria-label="Seções" className="hidden flex-1 items-center gap-1 md:flex">
            {SECOES.map(({ href, rotulo, Icone }) => (
              <Link
                key={href}
                href={href}
                aria-current={ativo(href) ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
                            ${
                              ativo(href)
                                ? 'bg-acento-suave font-medium text-acento'
                                : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'
                            }`}
              >
                <Icone className="size-[18px]" />
                {rotulo}
              </Link>
            ))}
          </nav>

          <Link
            href="/perfil"
            aria-current={ativo('/perfil') ? 'page' : undefined}
            aria-label="Sua conta"
            className={`ml-auto flex size-9 items-center justify-center rounded-full border transition-colors
                        ${
                          ativo('/perfil')
                            ? 'border-acento bg-acento-suave text-acento'
                            : 'border-borda text-texto-suave hover:bg-superficie-2 hover:text-texto'
                        }`}
          >
            <IconeUsuario className="size-[18px]" />
          </Link>
        </div>
      </header>

      {/* pb no celular reserva o espaço da barra inferior fixa */}
      <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>

      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95
                   backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {SECOES.map(({ href, rotulo, Icone }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo(href) ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2
                            text-[11px] transition-colors ${
                              ativo(href) ? 'text-acento' : 'text-texto-fraco'
                            }`}
              >
                <Icone className="size-5" />
                {rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
