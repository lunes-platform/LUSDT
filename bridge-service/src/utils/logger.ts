export interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

export interface LogData {
  [key: string]: any;
}

class Logger {
  private logLevel: string;

  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  private formatMessage(level: string, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${logData}`;
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message: string, data?: LogData): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  warn(message: string, data?: LogData): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  info(message: string, data?: LogData): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  debug(message: string, data?: LogData): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }
}

export const logger = new Logger(); 