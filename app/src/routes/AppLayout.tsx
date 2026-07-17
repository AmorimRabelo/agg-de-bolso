import { Outlet } from 'react-router-dom'
import { BottomNav } from '../shared/components/BottomNav'

export function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      <main className="pb-nav">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
