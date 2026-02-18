import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', backgroundColor: '#111', color: '#fff', height: '100vh' }}>
                    <h1 style={{ color: '#ff5555' }}>Application Error</h1>
                    <pre style={{ backgroundColor: '#222', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
                        {this.state.error?.toString()}
                    </pre>
                    <p>Please check the console for more details.</p>
                    <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', marginTop: '10px' }}>Reload</button>
                </div>
            );
        }

        return this.props.children;
    }
}

createRoot(document.getElementById('root')!).render(
    // <StrictMode> // Temporarily disabled strict mode for easier debugging
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
    // </StrictMode>,
)
