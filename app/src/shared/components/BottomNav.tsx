import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Início', icon: HomeIcon },
  { to: '/clientes', label: 'Clientes', icon: UsersIcon },
  { to: '/emprestimos', label: 'Empréstimos', icon: CashIcon },
  { to: '/relatorios', label: 'Relatórios', icon: ChartIcon },
  { to: '/ajustes', label: 'Ajustes', icon: GearIcon },
]

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition
               ${isActive ? 'text-brand-700' : 'text-ink/40'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon filled={isActive} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

type IconProps = { filled?: boolean }
const stroke = (filled?: boolean) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: filled ? 2.4 : 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

function HomeIcon({ filled }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...stroke(filled)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}
function UsersIcon({ filled }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...stroke(filled)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <path d="M16 5a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18.5 15.2c1.6.7 2.7 2 3 4.8" />
    </svg>
  )
}
function CashIcon({ filled }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...stroke(filled)}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 9.5h.01M18 14.5h.01" />
    </svg>
  )
}
function ChartIcon({ filled }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...stroke(filled)}>
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </svg>
  )
}
function GearIcon({ filled }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...stroke(filled)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.39 2.54a7 7 0 0 0-2.42 1.4l-2.35-.95-2 3.46 2 1.55a7.2 7.2 0 0 0 0 2.8l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.42 1.4l.39 2.54h3.4l.39-2.54a7 7 0 0 0 2.42-1.4l2.35.95 2-3.46-2-1.55c.09-.45.14-.92.14-1.4Z" />
    </svg>
  )
}
