import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Add global error handlers to swallow cross-origin "Script error." and benign popup block errors in the iframe environment
if (typeof window !== 'undefined') {
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = String(message || '');
    const srcStr = String(source || '');
    if (
      msgStr.includes('Script error') || 
      !source || 
      srcStr.includes('extensions') || 
      srcStr.includes('chrome-extension')
    ) {
      console.warn('Swallowed window.onerror script error:', message, source);
      return true; // Stop propagation / suppress error report
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };

  window.addEventListener('error', (event) => {
    const msgStr = event.message ? String(event.message) : '';
    const srcStr = event.filename ? String(event.filename) : '';
    // Swallowing generic cross-origin "Script error." and third-party extensions errors
    if (
      msgStr.includes('Script error') || 
      !srcStr || 
      srcStr.includes('extensions') || 
      srcStr.includes('chrome-extension')
    ) {
      console.warn('Swallowed cross-origin/extension script error:', event);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason) {
      // Swallowing benign popup block and auth popup close errors that occur in iframe sandboxes
      const reasonStr = String(reason);
      const isPopupError = 
        reason.code === 'auth/popup-blocked' || 
        reason.code === 'auth/popup-closed-by-user' || 
        reason.code === 'auth/cancelled-popup-request' || 
        reasonStr.includes('popup') || 
        reasonStr.includes('Popup') ||
        reasonStr.includes('Script error');
      
      if (isPopupError) {
        console.warn('Swallowed expected auth/popup restriction exception:', reason);
        event.preventDefault();
        event.stopPropagation();
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

