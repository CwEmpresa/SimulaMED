import * as Sentry from '@sentry/nextjs'

/**
 * Monitoramento de erros em produção (browser). Mesma observação do
 * instrumentation.ts: sem DSN configurado, isto é um no-op.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
