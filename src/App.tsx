import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// bundle-dynamic-imports: Route-level Code Splitting
// 각 페이지가 별도 청크로 분리 → 초기 번들 ~420KB 절감
const V3Page = lazy(() => import('./pages/V3Page').then(m => ({ default: m.V3Page })));
const V1Page = lazy(() => import('./pages/V1Page').then(m => ({ default: m.V1Page })));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
        <Routes>
          {/* v3 - 메인 경로 (Default) */}
          <Route path="/" element={<V3Page />} />

          {/* v1 - 레거시 경로 */}
          <Route path="/v1" element={<V1Page />} />

          {/* 404 처리 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
