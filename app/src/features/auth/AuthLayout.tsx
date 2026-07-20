import type { ReactNode } from 'react'
import { Logo } from '../../shared/components/ui'

/** Moldura das telas de login/cadastro/recuperação. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10">
        <div className="flex flex-col items-center gap-3 pb-8 pt-16">
          <Logo size={64} light />
          <h1 className="text-2xl font-extrabold text-white">EmprestaJá</h1>
          <p className="text-sm text-brand-200">Sua carteira de empréstimos, no bolso.</p>
        </div>
        <div className="anim-fade-up rounded-3xl bg-white p-6 shadow-2xl">
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
