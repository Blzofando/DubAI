import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import FileUpload from '@/components/FileUpload';
import { ArrowLeft, Play, AlertCircle, FolderOpen, Zap, Clock } from 'lucide-react';

interface DouyinDubbingViewProps {
    onStart: (skipSlow: boolean) => void;
    projectName: string;
    onProjectNameChange: (name: string) => void;
    onBackToProjects: () => void;
}

export default function DouyinDubbingView({ onStart, projectName, onProjectNameChange, onBackToProjects }: DouyinDubbingViewProps) {
    const { setCurrentView, hasApiKeys, sourceFile, stage } = useApp();
    const [skipSlow, setSkipSlow] = useState(false);

    const canStart = hasApiKeys && sourceFile && stage === 'setup' && projectName.trim().length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-purple-900/20">
            {/* Header */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setCurrentView('home')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Douyin Dub Slow
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Modo especial com Slow Motion e Cliffhangers
                                </p>
                            </div>
                        </div>
                        <div className="ml-auto">
                            <button
                                onClick={onBackToProjects}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                <FolderOpen className="w-5 h-5" />
                                <span className="font-medium">Meus Projetos</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Configuration Warning */}
                {!hasApiKeys && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="font-bold text-red-900 dark:text-red-100 mb-2">
                                    Configuração Incompleta
                                </h3>
                                <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                                    Você precisa configurar suas chaves de API antes de iniciar um projeto de dublagem.
                                </p>
                                <button
                                    onClick={() => setCurrentView('settings')}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
                                >
                                    Ir para Configurações
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Project Setup */}
                <div className="space-y-6">
                    {/* Project Name */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            📝 Nome do Projeto *
                        </label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => onProjectNameChange(e.target.value)}
                            placeholder="Ex: Curiosidade Douyin Parte 1"
                            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    {/* File Upload */}
                    <FileUpload />

                    {/* Options */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-purple-500" />
                            Configurações de Velocidade
                        </h3>

                        <div className="flex items-center gap-3">
                            <div className="relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out border-2 border-transparent rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700">
                                <input
                                    type="checkbox"
                                    id="skipSlow"
                                    className="absolute w-0 h-0 opacity-0"
                                    checked={skipSlow}
                                    onChange={(e) => setSkipSlow(e.target.checked)}
                                />
                                <label
                                    htmlFor="skipSlow"
                                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${skipSlow ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span
                                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${skipSlow ? 'translate-x-6' : 'translate-x-0'}`}
                                    />
                                </label>
                            </div>
                            <label htmlFor="skipSlow" className="cursor-pointer text-gray-700 dark:text-gray-300">
                                Meu vídeo já está acelerado/lento (Pular processamento de 0.8x)
                            </label>
                        </div>
                        <p className="mt-2 text-xs text-gray-500 ml-16">
                            Marque se você já aplicou o efeito de slow motion externamente. Isso economizará tempo de processamento.
                        </p>
                    </div>

                    {/* Action Button */}
                    {canStart ? (
                        <button
                            onClick={() => onStart(skipSlow)}
                            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                        >
                            <Play className="w-6 h-6" />
                            Iniciar Douyin Dub
                        </button>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6">
                            <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                                    Preencha todos os campos para continuar
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Help Section */}
                <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                    <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-3">
                        ⚡ Modo Douyin Dub Slow
                    </h3>
                    <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2 list-disc list-inside">
                        <li>Aplica efeito Slow Motion (0.8x) automaticamente</li>
                        <li>Divide vídeos longos em partes (2 ou 3)</li>
                        <li>Cria cliffhangers (ganchos) com IA no final de cada parte</li>
                        <li>Exporta áudios separados para cada parte</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
