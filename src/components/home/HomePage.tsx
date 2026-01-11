import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Video, Settings, Lock, Sparkles, ChevronRight, FolderOpen, Zap } from 'lucide-react';

interface HomePageProps {
    onBackToProjects: () => void;
}

export default function HomePage({ onBackToProjects }: HomePageProps) {
    const { setCurrentView, hasApiKeys } = useApp();

    const handleStartDubbing = () => {
        if (!hasApiKeys) {
            if (confirm('Você precisa configurar as chaves de API primeiro. Ir para Configurações?')) {
                setCurrentView('settings');
            }
            return;
        }
        setCurrentView('dubbing');
    };

    const handleStartLongDubbing = () => {
        if (!hasApiKeys) {
            if (confirm('Você precisa configurar as chaves de API primeiro. Ir para Configurações?')) {
                setCurrentView('settings');
            }
            return;
        }
        setCurrentView('long-dubbing');
    };

    const handleStartDouyinDubbing = () => {
        if (!hasApiKeys) {
            if (confirm('Você precisa configurar as chaves de API primeiro. Ir para Configurações?')) {
                setCurrentView('settings');
            }
            return;
        }
        setCurrentView('douyin-dubbing');
    };

    const features = [
        {
            id: 'simple-dubbing',
            title: 'Dublagem Simples',
            description: 'Traduza e duble vídeos automaticamente com IA',
            icon: Video,
            gradient: 'from-blue-500 to-cyan-500',
            available: true,
            onClick: handleStartDubbing
        },
        {
            id: 'long-dubbing',
            title: 'Long Dubbed',
            description: 'TTS paralelo otimizado para vídeos longos (~10x mais rápido)',
            icon: Zap,
            gradient: 'from-purple-500 to-indigo-500',
            available: true,
            onClick: handleStartLongDubbing
        },
        {
            id: 'douyin-dubbing',
            title: 'Douyin Dub Slow',
            description: 'Slow motion (0.8x), cliffhangers e divisão automática em partes',
            icon: Sparkles,
            gradient: 'from-purple-600 to-pink-600',
            available: true,
            onClick: handleStartDouyinDubbing
        },
        {
            id: 'advanced-dubbing',
            title: 'Dublagem Avançada',
            description: 'Controle fino sobre timing e múltiplas vozes',
            icon: Sparkles,
            gradient: 'from-pink-500 to-rose-500',
            available: false,
            comingSoon: true
        },
        {
            id: 'batch-processing',
            title: 'Processamento em Lote',
            description: 'Processe múltiplos vídeos simultaneamente',
            icon: Video,
            gradient: 'from-orange-500 to-red-500',
            available: false,
            comingSoon: true
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* Header */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                DubAI
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Inteligência Artificial para Dublagem de Vídeos
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onBackToProjects}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                <FolderOpen className="w-5 h-5" />
                                <span className="font-medium">Meus Projetos</span>
                            </button>
                            <button
                                onClick={() => setCurrentView('settings')}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                <Settings className="w-5 h-5" />
                                <span className="font-medium">Configurações</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-12">
                {/* Welcome Section */}
                <div className="mb-12 text-center">
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        Escolha uma Funcionalidade
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Selecione uma das opções abaixo para começar a trabalhar com dublagem de vídeos
                    </p>
                </div>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature) => {
                        const Icon = feature.icon;
                        const isDisabled = !feature.available;

                        return (
                            <button
                                key={feature.id}
                                onClick={feature.onClick}
                                disabled={isDisabled}
                                className={`group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 transition-all duration-300 overflow-hidden ${isDisabled
                                    ? 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-2xl hover:scale-105 cursor-pointer'
                                    }`}
                            >
                                {/* Gradient Header */}
                                <div className={`h-32 bg-gradient-to-br ${feature.gradient} relative flex items-center justify-center`}>
                                    {isDisabled && (
                                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
                                    )}
                                    <Icon className="w-16 h-16 text-white drop-shadow-lg" />

                                    {/* Coming Soon Badge */}
                                    {feature.comingSoon && (
                                        <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 px-3 py-1 rounded-full flex items-center gap-1">
                                            <Lock className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Em Breve</span>
                                        </div>
                                    )}

                                    {/* Available Badge */}
                                    {feature.available && (
                                        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full">
                                            <span className="text-xs font-bold">Disponível</span>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                        {feature.title}
                                        {!isDisabled && (
                                            <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>

                                {/* Hover Effect Border */}
                                {!isDisabled && (
                                    <div className={`absolute inset-0 border-2 border-transparent bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity rounded-2xl pointer-events-none`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Configuration Warning */}
                {!hasApiKeys && (
                    <div className="mt-12 max-w-2xl mx-auto">
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg">
                                    <Settings className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                                        Configuração Necessária
                                    </h4>
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                                        Você precisa configurar suas chaves de API antes de usar as funcionalidades de dublagem.
                                    </p>
                                    <button
                                        onClick={() => setCurrentView('settings')}
                                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors text-sm"
                                    >
                                        Ir para Configurações
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
