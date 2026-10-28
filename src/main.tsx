import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Disable default Chromium browser context menu (Back, Refresh, Save as, Print)
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    // Only allow native context menu on input elements if explicitly requested, otherwise prevent browser menu
    const target = e.target as HTMLElement;
    if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  }, true);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
