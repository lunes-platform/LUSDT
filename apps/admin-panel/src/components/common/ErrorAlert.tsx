import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onClose?: () => void;
  variant?: 'error' | 'warning' | 'info';
  persistent?: boolean;
}

export default function ErrorAlert({ 
  title = 'Erro',
  message,
  onClose,
  variant = 'error',
  persistent = false
}: ErrorAlertProps) {
  const variants = {
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      message: 'text-red-700',
      button: 'text-red-500 hover:text-red-600'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      button: 'text-yellow-500 hover:text-yellow-600'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      message: 'text-blue-700',
      button: 'text-blue-500 hover:text-blue-600'
    }
  };

  const styles = variants[variant];

  return (
    <div className={`border rounded-lg p-4 ${styles.container}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon 
            className={`h-5 w-5 ${styles.icon}`} 
            aria-hidden="true" 
          />
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${styles.title}`}>
            {title}
          </h3>
          
          <div className={`mt-2 text-sm ${styles.message}`}>
            {typeof message === 'string' ? (
              <p>{message}</p>
            ) : (
              message
            )}
          </div>
        </div>
        
        {onClose && !persistent && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
              >
                <span className="sr-only">Fechar</span>
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para notificações toast
export function ToastNotification({ 
  title,
  message,
  variant = 'error',
  onClose,
  autoClose = true,
  duration = 5000
}: ErrorAlertProps & { autoClose?: boolean; duration?: number }) {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <ErrorAlert
        title={title}
        message={message}
        variant={variant}
        onClose={onClose}
      />
    </div>
  );
}