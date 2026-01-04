import React from 'react';
import { useApp } from '@/contexts/AppContext';
import ApiKeyInput from '@/components/ApiKeyInput';
import FileUpload from '@/components/FileUpload';
import VoiceSelector from '@/components/VoiceSelector';
import { Play, Sparkles } from 'lucide-react';

interface SetupViewProps {
    onStart: () => void;
    projectName: string;
    onProjectNameChange: (name: string) => void;
}

export default function SetupView({ onStart, projectName, onProjectNameChange }: SetupViewProps) {
    const { hasApiKeys, sourceFile, stage } = useApp();

    const canStart = hasApiKeys && sourceFile && stage === 'setup' && projectName.trim().length > 0;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Config */}
                <div className="lg:col-span-1 space-y-6">
                    <ApiKeyInput />
                    <VoiceSelector />
                </div>

                {/* Center Column - File & Action */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Project Name Input */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Nome do Projeto *
                        </label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => onProjectNameChange(e.target.value)}
                            placeholder="Ex: Meu Vídeo Dublado"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transpare nt outline-none transition-all"
                        />
                    </div>

                    <FileUpload />

                    {canStart && (
                        <button
                            onClick={onStart}
                            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                        >
                            <Play className="w-6 h-6" />
                            Iniciar Projeto
                        </button>
                    )}

                    {!hasApiKeys && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-200 text-center">
                            Configure suas chaves de API para continuar.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
