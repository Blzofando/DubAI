'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import type { ProcessingStage } from '@/types';

interface StageInfo {
    id: ProcessingStage;
    title: string;
    description: string;
}

const STAGES: StageInfo[] = [
    {
        id: 'transcription',
        title: 'Transcrição',
        description: 'Extraindo e transcrevendo áudio com Gemini',
    },
    {
        id: 'translation',
        title: 'Tradução',
        description: 'Traduzindo com sincronização labial',
    },
    {
        id: 'dubbing',
        title: 'Dublagem',
        description: 'Gerando áudio com OpenAI TTS',
    },
    {
        id: 'assembly',
        title: 'Montagem',
        description: 'Ajustando e montando áudio final',
    },
];

export default function ProgressIndicator() {
    const { stage, progress } = useApp();

    if (stage === 'idle' || stage === 'completed') {
        return null;
    }

    const currentStageIndex = STAGES.findIndex(s => s.id === stage);

    return (
        <div className="bg-white dark:bg-gray-900 border-2 border-primary-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg transition-colors duration-300">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Processando...</h3>
                    {progress && (
                        <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                            {progress.progress}%
                        </span>
                    )}
                </div>
                {progress && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-primary-500 to-accent-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progress.progress}%` }}
                        />
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {STAGES.map((stageInfo, index) => {
                    const isCompleted = index < currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    const isPending = index > currentStageIndex;

                    return (
                        <div
                            key={stageInfo.id}
                            className={`flex items-start gap-4 p-4 rounded-xl transition-all ${isCurrent
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-300 dark:border-primary-700'
                                : isCompleted
                                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
                                    : 'bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <div className="flex-shrink-0 mt-1">
                                {isCompleted && (
                                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
                                )}
                                {isCurrent && (
                                    <Loader2 className="w-6 h-6 text-primary-600 dark:text-primary-400 animate-spin" />
                                )}
                                {isPending && (
                                    <Circle className="w-6 h-6 text-gray-400 dark:text-gray-600" />
                                )}
                            </div>

                            <div className="flex-1">
                                <h4
                                    className={`font-semibold ${isCurrent
                                        ? 'text-primary-700 dark:text-primary-300'
                                        : isCompleted
                                            ? 'text-green-700 dark:text-green-400'
                                            : 'text-gray-500 dark:text-gray-500'
                                        }`}
                                >
                                    {index + 1}. {stageInfo.title}
                                </h4>
                                <p
                                    className={`text-sm ${isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-500'
                                        }`}
                                >
                                    {isCurrent && progress
                                        ? progress.message
                                        : stageInfo.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
