// esbuild.config.js
import esbuild from 'esbuild';
import inlineImportPlugin from 'esbuild-plugin-inline-import'; // 설치한 플러그인 가져오기

esbuild.build({
  entryPoints: ['index.js'], // 진입점 파일
  bundle: true,
  outfile: 'dist/worker.js', // 번들 결과 파일
  format: 'esm',             // ES 모듈 형식
  target: 'esnext',          // 최신 JS 문법 사용
  platform: 'neutral',       // 특정 플랫폼 종속성 최소화
  plugins: [
    inlineImportPlugin()     // 인라인 임포트 플러그인 사용
  ],
  // loader:.json=json 옵션은 플러그인이 처리하므로 제거 가능
}).catch(() => process.exit(1));