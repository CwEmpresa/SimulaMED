import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { NOME_PRODUTO } from '@/lib/site'

export const alt = `${NOME_PRODUTO} · Treino para o ENAMED/ENARE`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Logo em 1469×200 (~7,35:1) — largura calculada a partir da altura para não
// distorcer o wordmark.
const ALTURA_LOGO = 56
const LARGURA_LOGO = Math.round(ALTURA_LOGO * (1469 / 200))

const logoData = await readFile(join(process.cwd(), 'public/logo-simulamed.png'), 'base64')
const logoSrc = `data:image/png;base64,${logoData}`

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#101b2b',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={LARGURA_LOGO} height={ALTURA_LOGO} alt={NOME_PRODUTO} />
        <div
          style={{
            marginTop: 40,
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#ffffff',
            maxWidth: 980,
          }}
        >
          Faça a prova antes da prova.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            color: '#9fb3c8',
            maxWidth: 860,
          }}
        >
          Simulados cronometrados, banco de questões e cadernos de erro para o ENAMED/ENARE.
        </div>
      </div>
    ),
    { ...size },
  )
}
