import { Navigate, Route, Routes } from 'react-router-dom';
import FeedInput from './pages/FeedInput.tsx';
import Login from './pages/Login.tsx';
import Watch from './pages/Watch.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<FeedInput />} />
      <Route path="/watch" element={<Watch />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
