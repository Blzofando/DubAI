import React from 'react';
import { useApp } from '@/contexts/AppContext';
import FileUpload from '@/components/FileUpload';
import { ArrowLeft, Play, Zap, AlertCircle, FolderOpen } from 'lucide-react';

interface LongDubbingViewProps {
    onStart: () => void;
    projectName: string;
    onProjectNameChange: (name: string) => void;
    onBackToProjects: () => void;
}

export default function LongDubbingView({ onStart, projectName, onProjectNameChange, onBackToProjects }: LongDubbingViewProps) {
    const { setCurrentView, hasApiKeys, sourceFile, stage } = useApp();

    const canStart = hasApiKeys && sourceFile && stage === 'setup' && projectName.trim().length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
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
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Long Dubbed
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Processamento paralelo otimizado para vídeos longos
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

                {/* Feature Highlights */}
                <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-3">
                                🚀 Otimizado para Vídeos Longos
                            </h3>
                            <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full"></span>
                                    Processa <strong>10 segmentos de áudio por vez</strong> em paralelo
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full"></span>
                                    <strong>~10x mais rápido</strong> que o modo normal
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full"></span>
                                    Ideal para vídeos <strong>&gt;5 minutos</strong>
                                </li>
                            </ul>
                            <div className="mt-4 p-3 bg-white/60 dark:bg-black/20 rounded-lg">
                                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                                    ⏱️ Exemplo: Vídeo de 10 min (~150 segs)
                                </p>
                                <div className="mt-2 flex items-center gap-4 text-xs">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Normal:</span>
                                        <span className="ml-1 font-bold text-gray-900 dark:text-gray-100">~5min 30s</span>
                                    </div>
                                    <span className="text-purple-600 dark:text-purple-400">→</span>
                                    <div>
                                        <span className="text-purple-600 dark:text-purple-400">Long Dubbed:</span>
                                        <span className="ml-1 font-bold text-purple-900 dark:text-purple-100">~38s</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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
                            placeholder="Ex: Vídeo Longo Dublado"
                            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Escolha um nome descritivo para identificar seu projeto
                        </p>
                    </div>

                    {/* File Upload */}
                    <FileUpload />

                    {/* Action Button */}
                    {canStart ? (
                        <button
                            onClick={onStart}
                            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                        >
                            <Zap className="w-6 h-6" />
                            Iniciar Dublagem Rápida
                        </button>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6">
                            <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                                    Preencha todos os campos para continuar
                                </p>
                                <ul className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
                                    {!hasApiKeys && <li>✗ Configure suas chaves de API</li>}
                                    {!projectName.trim() && <li>✗ Defina um nome para o projeto</li>}
                                    {!sourceFile && <li>✗ Faça upload de um vídeo</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3">
                        💡 Como funciona?
                    </h3>
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                        <li>Extração e transcrição do áudio (igual ao modo normal)</li>
                        <li>Tradução automática do texto</li>
                        <li><strong>TTS em batches de 10 segmentos paralelos</strong> ⚡</li>
                        <li>Ajuste automático de velocidade</li>
                        <li>Você poderá editar e exportar o resultado</li>
                    </ol>
                </div>
            </main>
        </div>
    );
}
