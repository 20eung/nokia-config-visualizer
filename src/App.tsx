import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// bundle-dynamic-imports: Route-level Code Splitting
const V3Page = lazy(() => import('./pages/V3Page').then(m => ({ default: m.V3Page })));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading...</div>}>
        <Routes>
          {/* v3 - 메인 경로 (Default) */}
          <Route path="/" element={<V3Page />} />

          {/* 404 처리 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
