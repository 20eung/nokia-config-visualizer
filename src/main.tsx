import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 포털 iframe 인증 복귀 처리:
// 포털에서 Nokia Visualizer iframe 로드 시 Authentik 인증이 필요하면
// nginx가 TOP 프레임을 /?_pr=1 로 리다이렉트함.
// 인증 완료 후 여기서 포털 /visualizer 로 자동 복귀.
const _params = new URLSearchParams(window.location.search)
if (_params.get('_pr') === '1') {
  window.location.replace('https://portal.hub.sk-net.com/visualizer')
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
