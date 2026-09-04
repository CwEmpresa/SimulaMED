import type { Metadata } from 'next'
import { Figtree, Geist, Geist_Mono } from 'next/font/google'

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
  title: 'SimulaMed ENAMED/ENARE',
  description: 'Faça a prova antes da prova. Simulados cronometrados, banco de questões e cadernos de erro para o ENAMED/ENARE.',
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
