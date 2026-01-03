'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { VOICE_OPTIONS } from '@/types';
import { Volume2 } from 'lucide-react';

export default function VoiceSelector() {
    const { selectedVoice, setSelectedVoice, stage } = useApp();

    const isDisabled = stage !== 'idle' && stage !== 'translation';

    return (
        <div className="bg-white dark:bg-gray-900 border-2 border-accent-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-accent-500 rounded-lg">
                    <Volume2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Seleção de Voz</h3>
            </div>

            <div className="space-y-3">
                {VOICE_OPTIONS.map((voice) => (
                    <label
                        key={voice.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedVoice === voice.id
                            ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20 dark:border-accent-500'
                            : 'border-gray-200 dark:border-gray-700 hover:border-accent-300 dark:hover:border-accent-500 bg-white dark:bg-gray-800'
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <input
                            type="radio"
                            name="voice"
                            value={voice.id}
                            checked={selectedVoice === voice.id}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            disabled={isDisabled}
                            className="w-5 h-5 text-accent-600 focus:ring-accent-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-gray-800 dark:text-gray-200">{voice.name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{voice.description}</div>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}
