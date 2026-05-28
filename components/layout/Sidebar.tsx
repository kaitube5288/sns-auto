'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Link2, Settings2, PenSquare,
  CalendarDays, BarChart2, Zap, LogOut,
  ChevronDown, MessageSquare, Image, Film, Activity, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const CREATE_SUB = [
  { href: '/create/threads', label: '스레드', icon: MessageSquare },
  { href: '/create/feed',    label: '피드',   icon: Image },
  { href: '/create/reels',   label: '릴스',   icon: Film },
]

const NAV_TOP = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/connect',   label: '계정 연결', icon: Link2 },
  { href: '/setup',     label: '업종 분석', icon: Settings2 },
]

const NAV_BOTTOM = [
  { href: '/calendar',  label: '예약 캘린더', icon: CalendarDays },
  { href: '/analytics', label: '성과 분석',   icon: BarChart2 },
  { href: '/activity',  label: '활동',        icon: Activity },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabase()

  const isCreateActive = pathname.startsWith('/create')
  const [createOpen, setCreateOpen] = useState(isCreateActive)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function closeMobile() { setMobileOpen(false) }

  return (
    <>
      {/* 모바일 전용 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center px-4 z-30 md:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="메뉴 열기" className="p-1">
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">SNS 자동화</span>
        </div>
      </header>

      {/* 모바일 백드롭 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeMobile}
        />
      )}

    <aside className={cn(
      "fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-white border-r border-gray-100 flex flex-col z-40",
      "transition-transform duration-200 ease-in-out",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
      "md:translate-x-0"
    )}>
      {/* 로고 */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">SNS 자동화</span>
        {/* 모바일에서 닫기 버튼 */}
        <button onClick={closeMobile} aria-label="메뉴 닫기" className="ml-auto md:hidden p-1">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {/* 상단 메뉴 */}
        {NAV_TOP.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={closeMobile}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}

        {/* 콘텐츠 만들기 (아코디언) */}
        <button
          onClick={() => setCreateOpen(v => !v)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            isCreateActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <PenSquare className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">콘텐츠 만들기</span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', createOpen ? 'rotate-180' : '')} />
        </button>

        {/* 하위 메뉴 */}
        {createOpen && (
          <div className="ml-3 pl-3 border-l border-gray-100 space-y-0.5">
            {CREATE_SUB.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        )}

        {/* 하단 메뉴 */}
        {NAV_BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={closeMobile}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
    </>
  )
}
