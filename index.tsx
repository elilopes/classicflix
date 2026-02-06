import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 1. Polyfill process for browser environments (Prevents "process is not defined" crash)
// @ts-ignore
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  // @ts-ignore
  window.process = { env: {} };
}

// 2. Global Error Handler for crashes outside React
window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="background:#141414;color:#fff;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20px;font-family:sans-serif;">
        <h2 style="color:#e50914;">Critical Load Error</h2>
        <p>The application encountered a critical error during startup.</p>
        <div style="background:#333;padding:15px;border-radius:5px;max-width:800px;overflow:auto;margin:20px 0;text-align:left;">
          <code style="color:#ff6b6b;">${error?.toString() || message}</code>
        </div>
        <button onclick="window.location.reload()" style="padding:10px 20px;background:#e50914;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Reload Page</button>
      </div>
    `;
  }
};

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          width: '100vw', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: '#141414', 
          color: '#fff',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <h1 style={{ color: '#e50914', marginBottom: '1rem' }}>Ops! Algo deu errado.</h1>
          <p style={{ maxWidth: '600px', marginBottom: '2rem', color: '#999' }}>
            A aplicação encontrou um erro inesperado.
          </p>
          <div style={{ 
            background: '#333', 
            padding: '1rem', 
            borderRadius: '4px', 
            marginBottom: '2rem',
            textAlign: 'left',
            maxWidth: '800px',
            overflow: 'auto',
            border: '1px solid #555'
          }}>
            <code style={{ color: '#ff4444', display: 'block', marginBottom: '10px' }}>{this.state.error?.toString()}</code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '10px 20px',
              backgroundColor: '#e50914',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    // Fix: Explicitly cast 'this' to avoid "Property 'props' does not exist" TS error
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

try {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (e) {
  console.error("Root Render Error:", e);
}