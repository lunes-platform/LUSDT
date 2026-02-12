import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-mono text-center">
                    <div className="max-w-md w-full border border-red-900/50 bg-red-950/10 p-8 rounded-sm shadow-[0_0_50px_-10px_rgba(239,68,68,0.2)]">
                        <div className="flex justify-center mb-6">
                            <AlertOctagon className="w-16 h-16 text-red-500 animate-pulse" />
                        </div>

                        <h1 className="text-2xl font-bold text-red-500 mb-2 tracking-widest uppercase">
                            SYSTEM_CRITICAL_FAILURE
                        </h1>

                        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-900 to-transparent my-4" />

                        <p className="text-zinc-400 text-sm mb-6">
                            An unrecoverable error has occurred in the neural interface.
                            <br />
                            <span className="text-red-400/70 text-xs mt-2 block font-sans">
                                {this.state.error?.message || 'Unknown Error'}
                            </span>
                        </p>

                        <button
                            onClick={() => window.location.reload()}
                            className="group relative px-6 py-3 bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-all uppercase text-xs font-bold tracking-widest flex items-center justify-center gap-2 w-full"
                        >
                            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                            Reboot System
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
