import Link from 'next/link'
import { MessageSquare, Image, Video, ChevronRight } from 'lucide-react'

const TYPES = [
  {
    href: '/create/threads',
    icon: MessageSquare,
    title: 'Threads 글',
    desc: '공감형·밈형·감성형 등 5가지 톤으로 Threads 게시물을 AI가 작성합니다.',
    badge: 'Threads',
    badgeColor: 'bg-gray-900 text-white',
    gradient: 'from-gray-800 to-gray-600',
  },
  {
    href: '/create/feed',
    icon: Image,
    title: '인스타 피드',
    desc: '사진을 올리면 AI가 캡션·해시태그·슬라이드 순서를 자동으로 제안합니다.',
    badge: 'Instagram',
    badgeColor: 'bg-pink-500 text-white',
    gradient: 'from-pink-500 to-orange-400',
  },
  {
    href: '/create/reels',
    icon: Video,
    title: '릴스 기획',
    desc: '영상을 올리면 AI가 컷 구성·자막·BGM·Hook 문구를 기획해드립니다.',
    badge: 'Reels',
    badgeColor: 'bg-purple-500 text-white',
    gradient: 'from-purple-500 to-indigo-500',
  },
]

export default function CreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠 만들기</h1>
        <p className="text-gray-500 mt-1">어떤 콘텐츠를 만들까요?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TYPES.map(({ href, icon: Icon, title, desc, badge, badgeColor, gradient }) => (
          <Link
            key={href}
            href={href}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <Icon className="w-10 h-10 text-white/80" />
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
              </div>
              <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              <div className="flex items-center gap-1 text-indigo-500 text-sm font-medium mt-4">
                시작하기 <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
