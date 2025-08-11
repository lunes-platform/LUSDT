import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics, trackPageview } from './utils/analytics'
import { initMonitoring } from './utils/monitoring'

// Inicialização básica de analytics/monitoring fora da árvore React
initAnalytics();
initMonitoring();

function Root() {
  useEffect(() => {
    trackPageview();
  }, []);
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
