import * as Sentry from '@sentry/nextjs'

/**
 * Monitoramento de erros em produção (servidor). Sem `NEXT_PUBLIC_SENTRY_DSN`
 * configurado, `Sentry.init` fica em no-op — não precisa desligar isto em
 * desenvolvimento nem em preview sem a variável.
 */
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  })
}

export const onRequestError = Sentry.captureRequestError
