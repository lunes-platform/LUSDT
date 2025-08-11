// Utilitário de Monitoramento de Erros (no-op se não configurado)
// Pensado para integração futura com Sentry/Rollbar

interface Monitoring {
  initialized: boolean;
  provider: 'sentry' | 'none';
  init: () => void;
  captureException: (error: unknown, context?: Record<string, any>) => void;
  setUser: (user?: { id?: string; address?: string }) => void;
}

const monitoring: Monitoring = {
  initialized: false,
  provider: 'none',
  init: () => {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    if (sentryDsn) {
      monitoring.provider = 'sentry';
      monitoring.initialized = true;
      console.info('[monitoring] Sentry habilitado');
      // Integração real do Sentry pode ser adicionada quando a lib for instalada.
    } else {
      monitoring.provider = 'none';
      monitoring.initialized = false;
      console.info('[monitoring] Desabilitado (sem configuração)');
    }
  },
  captureException: (error, context = {}) => {
    try {
      if (!monitoring.initialized) {
        console.warn('[monitoring:noop]', error, context);
        return;
      }
      console.debug('[monitoring] captureException', error, context);
    } catch (_) {
      // swallow
    }
  },
  setUser: (user) => {
    try {
      if (!monitoring.initialized) return;
      console.debug('[monitoring] setUser', user);
    } catch (_) {
      // swallow
    }
  }
};

export default monitoring;
export const initMonitoring = () => monitoring.init();
export const captureException = monitoring.captureException;
export const setMonitoringUser = monitoring.setUser;
