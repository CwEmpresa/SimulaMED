import type { Metadata } from 'next'
import { Figtree, Geist, Geist_Mono } from 'next/font/google'

import { DESCRICAO_PRODUTO, NOME_PRODUTO, SITE_URL } from '@/lib/site'

import './globals.css'

// Figtree carrega os títulos e os números: humanista o bastante para não soar
// corporativo genérico, e com números bem desenhados — que aqui aparecem em
// nota, cronômetro e percentuais o tempo todo.
const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  display: 'swap',
})

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${NOME_PRODUTO} · Treino para o ENAMED/ENARE`,
    template: `%s · ${NOME_PRODUTO}`,
  },
  description: DESCRICAO_PRODUTO,
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: NOME_PRODUTO,
    title: `${NOME_PRODUTO} · Treino para o ENAMED/ENARE`,
    description: DESCRICAO_PRODUTO,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${NOME_PRODUTO} · Treino para o ENAMED/ENARE`,
    description: DESCRICAO_PRODUTO,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
