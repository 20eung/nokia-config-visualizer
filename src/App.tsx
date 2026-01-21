import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { V1Page } from './pages/V1Page';
import { V2Page } from './pages/V2Page'; // Keep V2 available if needed
import { V3Page } from './pages/V3Page';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* v3 - 메인 경로 (New Default) */}
        <Route path="/" element={<V3Page />} />

        {/* v2 - 레거시 경로 */}
        <Route path="/v2" element={<V2Page />} />

        {/* v1 - 레거시 경로 */}
        <Route path="/v1" element={<V1Page />} />

        {/* 404 처리 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
