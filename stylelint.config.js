// Stylelint 설정. 색값은 src/styles/tokens.css에만 둔다 (CLAUDE.md 토큰 규칙, FRONTEND.md 7장)
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],
  ignoreFiles: ['dist/**', 'docs/**', 'node_modules/**'],
  rules: {
    // 컴포넌트는 var(--…)만 쓴다: hex·이름 색·색 함수 금지
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
    // 이름 규칙은 BEM 같은 특정 형식을 강제하지 않는다
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'keyframes-name-pattern': null,
  },
  overrides: [
    {
      files: ['src/styles/tokens.css'],
      rules: { 'color-no-hex': null, 'function-disallowed-list': null },
    },
  ],
}
