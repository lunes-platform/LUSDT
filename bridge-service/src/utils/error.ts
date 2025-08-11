/**
 * Utility functions for error handling in TypeScript
 */

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function createErrorObject(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }
  return {
    message: String(error)
  };
}