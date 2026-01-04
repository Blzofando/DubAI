import React from 'react';
import { useApp } from '@/contexts/AppContext';

export default function ProcessingView() {
    const { progress } = useApp();

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="inline-block p-4 rounded-full bg-primary-100 dark:bg-primary-900 mb-4 animate-pulse">
                        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                        Processando seu vídeo...
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        {progress?.message || 'Aguarde um momento'}
                    </p>
                </div>

                {progress && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-primary-500 to-accent-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${progress.progress}%` }}
                        />
                    </div>
                )}

                <div className="text-xs text-center text-gray-400">
                    Etapa: {progress?.stage} | {progress?.progress}%
                </div>
            </div>
        </div>
    );
}
