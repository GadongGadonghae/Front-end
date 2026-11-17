// 조사 고르기: 이름 끝 글자에 받침이 있는지 보고 이/가, 은/는, 을/를, (으)로를 붙인다 (보고서 문장 틀용)
// 괄호·공백·기호는 건너뛰고, 숫자는 읽는 소리로 본다 (2 이 → 받침 없음, 3 삼 → 받침 있음)

const DIGIT_BATCHIM: Record<string, number> = { 0: 1, 1: 8, 2: 0, 3: 16, 4: 0, 5: 0, 6: 1, 7: 8, 8: 8, 9: 0 }

/** 끝소리 받침 번호. 0 = 받침 없음, 8 = ㄹ. 알 수 없으면 null */
function lastBatchim(word: string): number | null {
  for (let i = word.length - 1; i >= 0; i--) {
    const ch = word[i]
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28
    if (ch in DIGIT_BATCHIM) return DIGIT_BATCHIM[ch]
    if (/[a-z]/i.test(ch)) return /[lmnr]/i.test(ch) ? (/[l]/i.test(ch) ? 8 : 4) : 0
  }
  return null
}

type Pair = '이/가' | '은/는' | '을/를' | '으로/로'

/** 이름 + 조사 (예: josa('B 프레스 3단', '이/가') → 'B 프레스 3단이') */
export function josa(word: string, pair: Pair): string {
  const [withB, without] = pair.split('/')
  const b = lastBatchim(word)
  if (b == null) return `${word}${withB}(${without})`
  // (으)로: 받침 없음·ㄹ 받침이면 '로'
  if (pair === '으로/로') return `${word}${b === 0 || b === 8 ? without : withB}`
  return `${word}${b === 0 ? without : withB}`
}
