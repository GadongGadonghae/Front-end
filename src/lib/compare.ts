// 기준 대비 차이를 색으로 (D-108 가동률, D-107 생산): 앞서면 강조 파랑, 뒤지면 먹색, 차이가 클수록 진하게.
// 빨강·노랑은 고장·대기 뜻이라 비교에 쓰지 않는다. 순수 함수
/** 차이의 세기 0~1 (span = 이만큼 차이 나면 가장 진하게) */
export function strength(diff: number, span: number): number {
  return Math.min(1, Math.abs(diff) / span)
}

/** 차이 색: 토큰 색을 투명도로 섞는다. min = 차이가 0일 때 진하기(%) */
export function compareColor(diff: number, span: number, min = 30, max = 100): string {
  const pct = Math.round(min + strength(diff, span) * (max - min))
  return `color-mix(in srgb, ${diff >= 0 ? 'var(--c-accent)' : 'var(--c-ink)'} ${pct}%, transparent)`
}

/** 가동률 비교 막대: ±15%p면 칸 절반을 다 채운다 (시안 G) */
export const OEE_SPAN = 15
