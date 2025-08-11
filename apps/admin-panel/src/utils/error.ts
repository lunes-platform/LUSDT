/**
 * Utilitário para tratar erros de forma consistente
 */

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return 'Erro desconhecido';
}

export function logError(context: string, error: unknown): void {
  console.error(`❌ ${context}:`, error);
}

export function handleAsyncError(context: string) {
  return (error: unknown): string => {
    logError(context, error);
    return getErrorMessage(error);
  };
}