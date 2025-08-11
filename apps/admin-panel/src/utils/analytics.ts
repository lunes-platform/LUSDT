// Utilitário de Analytics (no-op se não configurado)
// Suporta provedores simples via env flags para futura expansão

interface Analytics {
  initialized: boolean;
  provider: 'plausible' | 'posthog' | 'none';
  init: () => void;
  track: (event: string, props?: Record<string, any>) => void;
  pageview: (path?: string) => void;
}

const analytics: Analytics = {
  initialized: false,
  provider: 'none',
  init: () => {
    const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

    if (plausibleDomain) {
      analytics.provider = 'plausible';
      analytics.initialized = true;
      console.info('[analytics] Plausible habilitado para domínio', plausibleDomain);
      // Nota: script do Plausible deve estar em public/index.html para pageview automático.
    } else if (posthogKey) {
      analytics.provider = 'posthog';
      analytics.initialized = true;
      console.info('[analytics] PostHog habilitado');
      // Integração real do PostHog pode ser adicionada aqui quando a lib for instalada.
    } else {
      analytics.provider = 'none';
      analytics.initialized = false;
      console.info('[analytics] Desabilitado (sem configuração)');
    }
  },
  track: (event, props = {}) => {
    try {
      if (!analytics.initialized) return;
      // Placeholder: apenas loga. Substituir por chamadas aos SDKs quando adicionados.
      console.debug(`[analytics] event: ${event}`, props);
    } catch (e) {
      // swallow
    }
  },
  pageview: (path) => {
    try {
      if (!analytics.initialized) return;
      const p = path || (typeof window !== 'undefined' ? window.location.pathname : '/');
      console.debug('[analytics] pageview', p);
    } catch (e) {
      // swallow
    }
  }
};

export default analytics;
export const initAnalytics = () => analytics.init();
export const trackEvent = analytics.track;
export const trackPageview = analytics.pageview;
