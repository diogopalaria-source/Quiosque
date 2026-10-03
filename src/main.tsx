import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
              !
            </div>
            <h2 className="text-lg font-black text-slate-900">Falha ao inicializar tela</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ocorreu um erro ao carregar os dados. Clique no botão abaixo para recarregar ou limpar o cache local.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] bg-slate-100 text-slate-600 p-2.5 rounded-xl font-mono break-all text-left">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-200 cursor-pointer"
              >
                Recarregar Sistema
              </button>
              <button
                onClick={this.handleReset}
                className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                title="Limpar rascunhos locais e recarregar"
              >
                Limpar Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

