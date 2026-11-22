// 데모 로그인 계정 4종 (11/20 계정별 권한 확정). 프론트에서만 쓰는 시연용 계정이다
// 실제 백엔드 계정·권한이 생기면 로그인 응답의 역할로 바꾼다
import type { DemoAccount } from '@/types/user'

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { loginId: 'plant', password: '1234', name: '정연창', role: 'PLANT_HEAD', lines: [] },
  { loginId: 'lead', password: '1234', name: '윤은빈', role: 'PROD_LEAD', lines: [] },
  { loginId: 'lineA', password: '1234', name: '김유석', role: 'LINE_WORKER', lines: ['A', 'B'] },
  { loginId: 'lineC', password: '1234', name: '홍인기', role: 'LINE_WORKER', lines: ['C', 'D'] },
  { loginId: 'campus', password: '1234', name: '최나연', role: 'CAMPUS', lines: [] },
]

export const findAccount = (loginId: string) => DEMO_ACCOUNTS.find((a) => a.loginId.toLowerCase() === loginId.trim().toLowerCase()) ?? null
