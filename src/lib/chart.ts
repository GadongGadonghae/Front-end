// 그래프 눈금 계산 순수 함수
const pad = (n: number) => String(n).padStart(2, '0')

/** 보기 좋은 y 눈금: 1·2·5 단위로 count개 안팎 */
export function niceTicks(min: number, max: number, count = 4): { domain: [number, number]; ticks: number[]; digits: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1], digits: 0 }
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step)
  const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (step / mag === 2.5 ? 1 : 0))
  return { domain: [lo, hi], ticks, digits }
}

/** 시각 축 눈금 (ms). 간격(분)에 맞춰 HH:mm */
export function timeTicks(from: number, to: number, everyMin: number): { value: number; label: string }[] {
  const step = everyMin * 60_000
  const out: { value: number; label: string }[] = []
  const d0 = new Date(from)
  const base = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime()
  for (let t = base + Math.ceil((from - base) / step) * step; t <= to; t += step) {
    const d = new Date(t)
    out.push({ value: t, label: `${pad(d.getHours())}:${pad(d.getMinutes())}` })
  }
  return out
}
