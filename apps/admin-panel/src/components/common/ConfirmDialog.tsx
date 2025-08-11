import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from './Loading';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  isLoading = false
}: ConfirmDialogProps) {
  const variants = {
    danger: {
      icon: ExclamationTriangleIcon,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    },
    warning: {
      icon: ExclamationTriangleIcon,
      iconColor: 'text-yellow-600',
      iconBg: 'bg-yellow-100',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    info: {
      icon: InformationCircleIcon,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    },
    success: {
      icon: CheckCircleIcon,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    }
  };

  const config = variants[variant];
  const IconComponent = config.icon;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Erro na confirmação:', error);
      // O erro será tratado pelo componente pai
    }
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center">
                  <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${config.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
                    <IconComponent 
                      className={`h-6 w-6 ${config.iconColor}`} 
                      aria-hidden="true" 
                    />
                  </div>
                  
                  <div className="ml-4">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      {title}
                    </Dialog.Title>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    {message}
                  </p>
                </div>

                <div className="mt-6 flex space-x-3 justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    {cancelText}
                  </button>
                  
                  <button
                    type="button"
                    className={`inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${config.button}`}
                    onClick={handleConfirm}
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                    )}
                    {confirmText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Hook para usar o diálogo de confirmação
type ShowConfirmOptions = Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'> & {
  onConfirm?: () => void | Promise<void>;
};

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<Omit<ConfirmDialogProps, 'isOpen' | 'onClose'>>({
    onConfirm: () => {},
    title: '',
    message: ''
  });
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const showConfirm = (props: ShowConfirmOptions): Promise<boolean> => {
    setConfig({
      ...props,
      onConfirm: async () => {
        try {
          if (props.onConfirm) {
            await props.onConfirm();
          }
        } finally {
          resolverRef.current?.(true);
          setIsOpen(false);
        }
      }
    });
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const hideConfirm = () => {
    setIsOpen(false);
    resolverRef.current?.(false);
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      {...config}
      isOpen={isOpen}
      onClose={hideConfirm}
    />
  );

  return {
    showConfirm,
    hideConfirm,
    ConfirmDialog: ConfirmDialogComponent,
    ConfirmDialogComponent
  };
}