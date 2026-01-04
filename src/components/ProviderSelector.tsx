'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Settings, Cpu, Languages } from 'lucide-react';
import type { TranscriptionProvider, TranslationProvider } from '@/types';

export default function ProviderSelector() {
    const {
        transcriptionProvider,
        setTranscriptionProvider,
        translationProvider,
        setTranslationProvider,
        stage
    } = useApp();

    const isDisabled = stage !== 'setup';

    return (
        <div className="bg-white dark:bg-gray-900 border-2 border-primary-100 dark:border-gray-700 rounded-2xl p-6 shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-500 rounded-lg">
                    <Settings className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Motores de IA</h3>
            </div>

            <div className="space-y-6">
                {/* Transcription Provider */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
                        <ProcessIcon className="w-4 h-4" /> Transcrição
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <ProviderOption
                            id="whisper"
                            label="Whisper (OpenAI)"
                            selected={transcriptionProvider === 'whisper'}
                            onClick={() => setTranscriptionProvider('whisper')}
                            disabled={isDisabled}
                        />
                        <ProviderOption
                            id="gemini"
                            label="Gemini Flash"
                            selected={transcriptionProvider === 'gemini'}
                            onClick={() => setTranscriptionProvider('gemini')}
                            disabled={isDisabled}
                        />
                    </div>
                </div>

                {/* Translation Provider */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
                        <Languages className="w-4 h-4" /> Tradução
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <ProviderOption
                            id="gemini"
                            label="Gemini Flash"
                            selected={translationProvider === 'gemini'}
                            onClick={() => setTranslationProvider('gemini')}
                            disabled={isDisabled}
                        />
                        <ProviderOption
                            id="openai"
                            label="GPT-4o"
                            selected={translationProvider === 'openai'}
                            onClick={() => setTranslationProvider('openai')}
                            disabled={isDisabled}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProviderOption({ id, label, selected, onClick, disabled }: {
    id: string;
    label: string;
    selected: boolean;
    onClick: () => void;
    disabled: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all
                ${selected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            {label}
        </button>
    );
}

function ProcessIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
    )
}
