import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';

// Register service worker for PWA — with automatic update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none', // always fetch sw.js from network
      });
      // Check for updates periodically
      setInterval(() => reg.update(), 60 * 60 * 1000); // every hour
    } catch {
      // SW registration failed, app still works
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
