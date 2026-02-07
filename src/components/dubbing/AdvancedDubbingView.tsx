
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import FileUpload from '@/components/FileUpload';
import { ArrowLeft, Play, Video, AlertCircle, FolderOpen, Zap } from 'lucide-react';

interface AdvancedDubbingViewProps {
    onStart: () => void;
    projectName: string;
    onProjectNameChange: (name: string) => void;
    onBackToProjects: () => void;
}

export default function AdvancedDubbingView({ onStart, projectName, onProjectNameChange, onBackToProjects }: AdvancedDubbingViewProps) {
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
                            <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Dublagem Avançada
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Ajuste fino de velocidade com reescrita iterativa via IA
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
                            placeholder="Ex: Análise Técnica Avançada"
                            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
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
                            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                        >
                            <Play className="w-6 h-6" />
                            Iniciar Processo Avançado
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

                {/* Help Section */}
                <div className="mt-8 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-xl p-6">
                    <h3 className="font-bold text-pink-900 dark:text-pink-100 mb-3">
                        ⚡ Modo de Alta Precisão (0.9x Stretch)
                    </h3>
                    <ol className="text-sm text-pink-800 dark:text-pink-200 space-y-2 list-decimal list-inside">
                        <li>O vídeo será desacelerado para 0.9x (criando mais tempo).</li>
                        <li>A IA transcreve e traduz o conteúdo.</li>
                        <li><strong>Loop de Refinamento:</strong> O sistema gera o áudio e verifica a velocidade.</li>
                        <li>Se a velocidade não estiver entre <strong>1.1x e 1.5x</strong>, a IA reescreve o texto automaticamente.</li>
                        <li>O processo repete até 4 vezes por segmento para garantir a sincronia perfeita.</li>
                    </ol>
                </div>
            </main>
        </div>
    );
}
