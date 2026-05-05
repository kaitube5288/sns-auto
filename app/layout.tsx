import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SNS 자동화 | 소상공인 인스타·스레드 AI 마케팅',
  description: 'Instagram과 Threads에 AI 콘텐츠를 자동 업로드하는 소상공인 전용 SNS 마케팅 도구',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
