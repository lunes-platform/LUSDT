import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertOctagon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toast: {
        success: (title: string, message?: string, duration?: number) => void;
        error: (title: string, message?: string, duration?: number) => void;
        warning: (title: string, message?: string, duration?: number) => void;
        info: (title: string, message?: string, duration?: number) => void;
    };
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback(({ type, title, message, duration = 5000 }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, title, message, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const toast = {
        success: (title: string, message?: string, duration?: number) => addToast({ type: 'success', title, message, duration }),
        error: (title: string, message?: string, duration?: number) => addToast({ type: 'error', title, message, duration }),
        warning: (title: string, message?: string, duration?: number) => addToast({ type: 'warning', title, message, duration }),
        info: (title: string, message?: string, duration?: number) => addToast({ type: 'info', title, message, duration }),
    };

    return (
        <ToastContext.Provider value={{ toast, addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const { type, title, message } = toast;

    const styles = {
        success: 'border-green-500 bg-green-950/90 text-green-400 shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]',
        error: 'border-red-500 bg-red-950/90 text-red-400 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]',
        warning: 'border-yellow-500 bg-yellow-950/90 text-yellow-400 shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]',
        info: 'border-blue-500 bg-blue-950/90 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]',
    };

    const icons = {
        success: <CheckCircle className="w-5 h-5" />,
        error: <AlertOctagon className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />,
        info: <Info className="w-5 h-5" />,
    };

    return (
        <div className={`pointer-events-auto flex items-start gap-3 p-4 rounded-sm border-l-4 backdrop-blur-md animate-in slide-in-from-right-full fade-in duration-300 font-mono ${styles[type]}`}>
            <div className="mt-0.5 shrink-0 animate-pulse">{icons[type]}</div>
            <div className="flex-1">
                <h3 className="font-bold text-sm tracking-wider uppercase">{title}</h3>
                {message && <p className="text-xs mt-1 opacity-90 leading-relaxed font-sans">{message}</p>}
            </div>
            <button onClick={onClose} className="shrink-0 hover:opacity-70 transition-opacity">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
