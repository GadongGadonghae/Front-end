// 목표 생산량 변동 카드 (11/20): 공장장이 오늘 목표를 바꾸면 생산관리팀장 화면 오른쪽 위에 작게 알려요.
// X로 닫으면 그 변동은 다시 안 떠요 (계정마다 브라우저에 "마지막으로 본 목표"를 기억). 10초마다 확인.
// 목표는 공장장만 바꿀 수 있어서(lib/permissions.ts) "다른 사람이 바꾼 오늘 목표" = 공장장 변경이에요.
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { source } from '@/data'
import { useAuth } from '@/composables/useAuth'
import { toDateStr } from '@/lib/format'

const EVERY_MS = 10_000

interface Seen { date: string; quantity: number | null; updatedAt: string | null }
export interface TargetChange { date: string; before: number | null; after: number | null; by: string | null; at: string | null }

const keyOf = (loginId: string) => `sfaas.targetSeen.${loginId}`
function readSeen(loginId: string): Seen | null {
  try {
    const raw = localStorage.getItem(keyOf(loginId))
    return raw ? (JSON.parse(raw) as Seen) : null
  } catch {
    return null
  }
}
function writeSeen(loginId: string, s: Seen) {
  try {
    localStorage.setItem(keyOf(loginId), JSON.stringify(s))
  } catch {
    // 저장소를 못 쓰면 이번 창 동안만 기억
  }
}

export function useTargetChange() {
  const { role, userName, loginId } = useAuth()
  const change = shallowRef<TargetChange | null>(null)
  let memory: Seen | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  async function check() {
    const id = loginId.value
    if (!id) return
    const today = toDateStr(Date.now())
    const row = (await source.q.getTargets(today, today).catch(() => []))[0]
    const now: Seen = { date: today, quantity: row?.quantity ?? null, updatedAt: row?.updatedAt ?? null }
    const seen = readSeen(id) ?? memory
    // 처음 보거나 날짜가 바뀌면 조용히 기억만 (로그인 전 변경까지 알리지 않음)
    if (!seen || seen.date !== today) {
      memory = now
      writeSeen(id, now)
      return
    }
    // 공장 목표 합이 바뀔 때만 (보고서 승인으로 라인 사이 계획만 옮겨진 것은 알리지 않음, 11/20)
    const changed = seen.quantity !== now.quantity
    if (changed && row?.updatedBy !== userName.value) {
      change.value = { date: today, before: seen.quantity, after: now.quantity, by: row?.updatedBy ?? null, at: now.updatedAt }
    }
  }

  /** X: 이 변동은 봤다고 기억 */
  function dismiss() {
    const c = change.value
    const id = loginId.value
    if (c && id) {
      memory = { date: c.date, quantity: c.after, updatedAt: c.at }
      writeSeen(id, memory)
    }
    change.value = null
  }

  const active = computed(() => role.value === 'PRODUCTION_MANAGER')
  watch(active, (on) => {
    if (timer) clearInterval(timer)
    timer = null
    change.value = null
    if (!on) return
    check()
    timer = setInterval(check, EVERY_MS)
  }, { immediate: true })
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return { change, dismiss }
}
