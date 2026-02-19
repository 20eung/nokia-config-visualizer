import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ES module에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// package.json에서 버전 정보 읽기
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // 빌드 시점에 환경변수로 주입
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
})
