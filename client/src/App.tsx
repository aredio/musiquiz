import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PlayPage from './pages/PlayPage';
import HostPage from './pages/HostPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/play" element={<PlayPage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/" element={<Navigate to="/host" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

