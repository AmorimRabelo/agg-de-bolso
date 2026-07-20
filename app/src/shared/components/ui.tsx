import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------- Button
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const styles = {
    primary:
      'bg-brand-700 text-white active:bg-brand-800 shadow-lg shadow-brand-700/20',
    ghost: 'bg-transparent text-brand-700 active:bg-brand-50',
    danger: 'bg-red-600 text-white active:bg-red-700 shadow-lg shadow-red-600/20',
  }[variant]
  return (
    <button
      className={`h-13 w-full rounded-2xl px-5 text-base font-semibold transition
        disabled:opacity-50 ${styles} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner className="mx-auto" /> : children}
    </button>
  )
}

// ---------------------------------------------------------------- Input
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = '', ...rest }: InputProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/70">{label}</span>
      <input
        className={`h-13 w-full rounded-2xl border bg-white px-4 text-base outline-none
          transition placeholder:text-ink/30
          ${error ? 'border-red-400 focus:border-red-500' : 'border-ink/10 focus:border-brand-600'}
          ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  )
}

// ---------------------------------------------------------------- Card
export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl bg-white p-5 shadow-sm shadow-ink/5 ${onClick ? 'cursor-pointer active:scale-[0.99] transition' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- Spinner
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`}
    />
  )
}

// ---------------------------------------------------------------- Splash
export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-950">
      <Logo size={72} light />
    </div>
  )
}

// ---------------------------------------------------------------- Logo
export function Logo({ size = 48, light = false }: { size?: number; light?: boolean }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-2xl font-extrabold
        ${light ? 'bg-brand-400/20 text-brand-400' : 'bg-brand-700 text-white'}`}
    >
      <span style={{ fontSize: size * 0.42 }}>E$</span>
    </div>
  )
}

// ---------------------------------------------------------------- Toast (snackbar)
type Toast = { id: number; message: string; kind: 'ok' | 'error' }
const ToastContext = createContext<(message: string, kind?: Toast['kind']) => void>(
  () => {},
)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((message: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-fade-up max-w-sm rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl
              ${t.kind === 'error' ? 'bg-red-600' : 'bg-ink'}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
