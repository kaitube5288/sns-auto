'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Link2, Settings2, PenSquare,
  CalendarDays, BarChart2, Zap, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const nav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/connect', label: '계정 연결', icon: Link2 },
  { href: '/setup', label: '업종 분석', icon: Settings2 },
  { href: '/create', label: '콘텐츠 만들기', icon: PenSquare },
  { href: '/calendar', label: '예약 캘린더', icon: CalendarDays },
  { href: '/analytics', label: '성과 분석', icon: BarChart2 },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabase()

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-white border-r border-gray-100 flex flex-col z-20">
      {/* 로고 */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">SNS 자동화</span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
