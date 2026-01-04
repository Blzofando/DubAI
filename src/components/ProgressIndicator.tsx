'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Loader2 } from 'lucide-react';

export default function ProgressIndicator() {
    const { stage, progress } = useApp();

    // Only show if processing
    if (stage !== 'processing' || !progress) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-gray-900 border-2 border-primary-200 dark:border-gray-700 rounded-2xl p-8 shadow-2xl transition-all duration-300 max-w-2xl mx-auto">
            <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6">
                    <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
                </div>

                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Processando seu vídeo</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
                    Isso pode levar alguns minutos, dependendo do tamanho do vídeo. Por favor, não feche a página.
                </p>

                <div className="w-full mb-4">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-primary-600 dark:text-primary-400 animate-pulse">
                            {progress.message}
                        </span>
                        <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                            {progress.progress}%
                        </span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner">
                        <div
                            className="bg-gradient-to-r from-primary-600 to-accent-500 h-full rounded-full transition-all duration-500 ease-out shadow-lg"
                            style={{ width: `${progress.progress}%` }}
                        />
                    </div>
                </div>

                <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
                    DubAI Pro AI Engine
                </p>
            </div>
        </div>
    );
}
