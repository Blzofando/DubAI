import React from 'react';
import { useApp } from '@/contexts/AppContext';
import ApiKeyInput from '@/components/ApiKeyInput';
import VoiceSelector from '@/components/VoiceSelector';
import ProviderSelector from '@/components/ProviderSelector';
import { ArrowLeft, Settings as SettingsIcon, CheckCircle, AlertCircle, FolderOpen } from 'lucide-react';

interface SettingsViewProps {
    onBackToProjects: () => void;
}

export default function SettingsView({ onBackToProjects }: SettingsViewProps) {
    const { setCurrentView, hasApiKeys, selectedVoice, transcriptionProvider, translationProvider } = useApp();

    const settingsSections = [
        {
            id: 'api-keys',
            title: 'Chaves de API',
            description: 'Configure suas chaves para Gemini e OpenAI',
            completed: hasApiKeys,
            component: <ApiKeyInput />
        },
        {
            id: 'providers',
            title: 'Provedores de IA',
            description: 'Escolha os serviços para transcrição e tradução',
            completed: transcriptionProvider && translationProvider,
            component: <ProviderSelector />
        },
        {
            id: 'voice',
            title: 'Configurações de Voz',
            description: 'Selecione a voz para dublagem',
            completed: selectedVoice,
            component: <VoiceSelector />
        }
    ];

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
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                                <SettingsIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Configurações
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Gerencie suas preferências e chaves de API
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
            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Status Overview */}
                <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Status da Configuração
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {settingsSections.map((section) => (
                            <div
                                key={section.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 ${section.completed
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                                    : 'bg-gray-50 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700'
                                    }`}
                            >
                                {section.completed ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        {section.title}
                                    </p>
                                    <p className={`text-xs ${section.completed
                                        ? 'text-green-700 dark:text-green-300'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                        {section.completed ? 'Configurado' : 'Pendente'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Settings Sections */}
                <div className="space-y-6">
                    {settingsSections.map((section) => (
                        <div key={section.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            {/* Section Header */}
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {section.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {section.description}
                                        </p>
                                    </div>
                                    {section.completed && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                                Configurado
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section Content */}
                            <div className="p-6">
                                {section.component}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex items-center justify-between p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Suas configurações são salvas automaticamente
                    </p>
                    <button
                        onClick={() => setCurrentView('home')}
                        className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors shadow-md hover:shadow-lg"
                    >
                        Concluir
                    </button>
                </div>
            </main>
        </div>
    );
}
