// 실시간 웹소켓 (STOMP, W-01 ~ W-05). 연결 하나를 모든 화면이 같이 쓴다 (11/22)
// - 같은 주소를 여러 곳이 구독해도 서버 구독은 하나 (마지막 구독이 끊기면 서버 구독도 끊음)
// - 끊기면 자동으로 다시 붙고, 붙으면 모든 주소를 다시 구독한다
// - 붙음/끊김을 알려 주면 source.ts가 끊긴 동안 원래 주기 조회로 돌아간다 (백엔드가 꺼져 있거나 허용 주소가 아니어도 화면은 그대로 돈다)
import { Client, type StompSubscription } from '@stomp/stompjs'
import type { Unsubscribe } from '@/data/contracts'

const WS_PATH = import.meta.env.VITE_WS_URL ?? '/ws'
/** 다시 붙기 간격 */
const RECONNECT_MS = 3000
/** 구독이 모두 끊긴 뒤 연결을 닫기까지 기다리는 시간 (화면을 옮기는 틈에 끊었다 다시 붙지 않게) */
const IDLE_CLOSE_MS = 5000

/** 상대 경로면 지금 화면 주소 기준 ws(s)://호스트/ws (개발 서버 · 미리보기 · nginx가 백엔드로 넘김) */
function brokerUrl(): string {
  if (/^wss?:\/\//.test(WS_PATH)) return WS_PATH
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}${WS_PATH.startsWith('/') ? '' : '/'}${WS_PATH}`
}

type Handler = (body: unknown) => void
interface Topic { handlers: Set<Handler>; sub: StompSubscription | null }

const topics = new Map<string, Topic>()
const connectionListeners = new Set<(connected: boolean) => void>()
let client: Client | null = null
let connected = false
let idleTimer: ReturnType<typeof setTimeout> | null = null

function setConnected(v: boolean) {
  if (connected === v) return
  connected = v
  connectionListeners.forEach((cb) => cb(v))
}

function attach(destination: string, t: Topic) {
  if (!client?.connected || t.sub) return
  t.sub = client.subscribe(destination, (m) => {
    let body: unknown
    try { body = JSON.parse(m.body) } catch { return }
    t.handlers.forEach((h) => h(body))
  })
}

function ensureClient() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  if (client) return
  client = new Client({
    brokerURL: brokerUrl(),
    reconnectDelay: RECONNECT_MS,
    // Spring 단순 브로커는 하트비트를 쓰지 않는다
    heartbeatIncoming: 0,
    heartbeatOutgoing: 0,
    onConnect: () => {
      for (const [destination, t] of topics) { t.sub = null; attach(destination, t) }
      setConnected(true)
    },
    onWebSocketClose: () => {
      for (const t of topics.values()) t.sub = null
      setConnected(false)
    },
    onStompError: () => setConnected(false),
  })
  client.activate()
}

function closeIfIdle() {
  if (topics.size || connectionListeners.size || idleTimer) return
  idleTimer = setTimeout(() => {
    idleTimer = null
    if (topics.size || connectionListeners.size || !client) return
    void client.deactivate()
    client = null
    setConnected(false)
  }, IDLE_CLOSE_MS)
}

/** 주소 하나를 구독한다. 메시지 본문(JSON)을 그대로 넘긴다 */
export function subscribe<T>(destination: string, handler: (body: T) => void): Unsubscribe {
  ensureClient()
  let t = topics.get(destination)
  if (!t) { t = { handlers: new Set(), sub: null }; topics.set(destination, t) }
  const h = handler as Handler
  t.handlers.add(h)
  attach(destination, t)
  return () => {
    const cur = topics.get(destination)
    if (!cur?.handlers.delete(h) || cur.handlers.size) return
    if (client?.connected) cur.sub?.unsubscribe()
    topics.delete(destination)
    closeIfIdle()
  }
}

/** 붙음/끊김을 알린다. 부르자마자 지금 상태를 한 번 준다. 알림을 받는 동안은 연결을 유지(또는 시도)한다 */
export function onConnection(cb: (connected: boolean) => void): Unsubscribe {
  ensureClient()
  connectionListeners.add(cb)
  cb(connected)
  return () => {
    connectionListeners.delete(cb)
    closeIfIdle()
  }
}
