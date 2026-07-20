import { useState } from 'react'
import { Card } from '../../shared/components/ui'
import { useAuth } from '../auth/useAuth'

// Dados de recebimento da sociedade (Passo 2 do plano de vendas)
const PIX_KEY = '4c5f6cb5-8e40-4c9b-84a2-6108fb2c42f9'
const WHATSAPP = '5564984294413' // (64) 98429-4413

/** Instruções de ativação por PIX + comprovante no WhatsApp. */
export function ActivationCard() {
  const { session } = useAuth()
  const [copied, setCopied] = useState(false)

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(PIX_KEY)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      /* navegadores antigos: usuário copia manualmente */
    }
  }

  const email = session?.user.email ?? ''
  const msg =
    `Olá! Acabei de pagar o PIX da assinatura do EmprestaJá (R$ 10,00). ` +
    `Segue o comprovante. Meu e-mail de cadastro: ${email}`
  const waLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`

  return (
    <Card className="!bg-brand-50">
      <p className="font-bold">Como ativar (leva 2 minutos)</p>

      <div className="mt-3 flex flex-col gap-3 text-sm">
        <div>
          <p className="font-semibold">1️⃣ Pague R$ 10,00 no PIX</p>
          <button
            onClick={copyPix}
            className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2.5 text-left active:bg-brand-100"
          >
            <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink/70">
              {PIX_KEY}
            </span>
            <span className="shrink-0 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white">
              {copied ? '✓ Copiada!' : 'Copiar'}
            </span>
          </button>
          <p className="mt-1 text-xs text-ink/50">Chave aleatória — cole no seu banco</p>
        </div>

        <div>
          <p className="font-semibold">2️⃣ Envie o comprovante no WhatsApp</p>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-2.5 font-semibold text-white active:opacity-90"
          >
            💬 Enviar comprovante — (64) 98429-4413
          </a>
        </div>

        <p className="text-xs text-ink/60">
          3️⃣ <strong>Ativamos na hora</strong> — você recebe a confirmação no próprio
          WhatsApp e o app libera em seguida.
        </p>
      </div>
    </Card>
  )
}
