import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Library from './routes/Library';
import Reader from './routes/Reader';
import Settings from './routes/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/reader/:bookId" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
