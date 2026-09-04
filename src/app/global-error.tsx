'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Erro não tratado que escapou até o layout raiz. `global-error` renderiza o
 * próprio `<html>/<body>` e não herda globals.css nem os tokens de tema (ver
 * docs do Next) — por isso todo o estilo aqui é inline, nada de classes do
 * design system (Tailwind não teria o CSS carregado neste documento).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Algo deu errado.</h1>
        <p style={{ color: '#52627a', maxWidth: 420 }}>
          O erro já foi registrado. Tente novamente — se persistir, recarregue a página.
        </p>
        <button
          onClick={() => retry()}
          style={{
            cursor: 'pointer',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#ffffff',
            background: '#0e7490',
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  )
}
