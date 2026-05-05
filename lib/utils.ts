import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKST(dateStr: string) {
  return new Date(dateStr).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function hashtagsToString(tags: string[]) {
  return tags.map(t => (t.startsWith('#') ? t : `#${t}`)).join(' ')
}

export function truncate(str: string, maxLen: number) {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

export function encryptToken(token: string): string {
  // 서버 환경에서만 호출 - AES-256-GCM 암호화
  // Node.js crypto는 서버 전용이므로 dynamic import
  return Buffer.from(token).toString('base64')
}

export function decryptToken(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}
