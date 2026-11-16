// ESLint 설정. 규칙의 근거는 FRONTEND.md (2장 의존 방향, 7장 코드 규칙)
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

// 층 사이 가져오기 금지 목록을 만든다. 상대 경로로 위 폴더를 거슬러 가는 것('../')도 막아서
// 다른 층은 반드시 '@/…'로 가져오게 한다 → 아래 금지 경로 검사가 빠짐없이 걸린다
const UP = { group: ['../*', '../**'], message: "다른 폴더는 '@/…'로 가져온다 (FRONTEND.md 2장)" }
const ban = (globs, why) => ({ group: globs, message: `${why} (FRONTEND.md 2장 의존 방향)` })
const layer = (files, ...patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [UP, ...patterns] }] },
})

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'wireframes/**', 'public/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'], sourceType: 'module' },
    },
  },
  { languageOptions: { globals: { ...globals.browser } } },

  // 코드 규칙 (FRONTEND.md 7장)
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/no-mutating-props': 'error',
      'vue/require-default-prop': 'off',
      // 줄바꿈·속성 배치 같은 순수 모양 규칙은 끈다 (의미 있는 규칙만 남김)
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
    },
  },

  // 의존 방향: 위 층만 아래 층을 가져온다
  layer(['src/components/base/**'],
    ban(['@/types/*', '@/types/**', '@/data/*', '@/data/**', '@/composables/*', '@/composables/**', '@/components/domain/**', '@/components/charts/**', '@/layouts/**', '@/pages/**', '@/router/**'],
      'base는 업무를 모른다. 값은 props로 받는다')),
  layer(['src/components/charts/**'],
    ban(['@/types/*', '@/types/**', '@/data/*', '@/data/**', '@/composables/*', '@/composables/**', '@/components/domain/**', '@/layouts/**', '@/pages/**', '@/router/**'],
      'charts는 업무를 모른다. 값은 props로 받는다')),
  layer(['src/components/domain/**'],
    ban(['@/data/*', '@/data/**', '@/composables/*', '@/composables/**', '@/layouts/**', '@/pages/**', '@/router/**'],
      'domain은 데이터를 직접 부르지 않는다. 데이터는 props로')),
  layer(['src/composables/**'],
    ban(['@/components/**', '@/layouts/**', '@/pages/**'], 'composable은 화면 부품을 모른다')),
  layer(['src/data/**'],
    ban(['vue', 'vue-router', '@/components/**', '@/composables/*', '@/composables/**', '@/layouts/**', '@/pages/**', '@/router/**', '@/lib/*', '@/lib/**'],
      'data는 Vue·화면을 모르는 순수 TypeScript')),
  layer(['src/lib/**'],
    ban(['vue', 'vue-router', '@/data/*', '@/data/**', '@/components/**', '@/composables/*', '@/composables/**', '@/layouts/**', '@/pages/**', '@/router/**'],
      'lib은 순수 함수만')),
  layer(['src/types/**'],
    ban(['vue', '@/data/*', '@/data/**', '@/lib/*', '@/lib/**', '@/components/**', '@/composables/*', '@/composables/**', '@/layouts/**', '@/pages/**', '@/router/**'],
      'types는 다른 층을 모른다')),
  layer(['src/layouts/**'],
    ban(['@/data/*', '@/data/**', '@/pages/**'], 'layouts는 데이터를 composable로만 받는다')),
  layer(['src/pages/**'],
    ban(['@/data/*', '@/data/**'], '페이지는 composable로 데이터를 받는다')),
)
