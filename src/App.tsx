import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { V1Page } from './pages/V1Page';
import { V2Page } from './pages/V2Page';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* v1 - 기본 경로 */}
        <Route path="/" element={<V1Page />} />

        {/* v2 - 새로운 경로 */}
        <Route path="/v2" element={<V2Page />} />

        {/* 404 처리 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
