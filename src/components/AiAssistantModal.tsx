import React, { useState } from 'react';
import { Send, X, Sparkles, MessageSquare, RefreshCw, Check } from 'lucide-react';
import { chatWithAi } from '@/services/gemini';
import { useApp } from '@/contexts/AppContext';

interface AiAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (text: string) => void;
    originalText: string;
    currentTranslation: string;
    context?: string;
}

export default function AiAssistantModal({
    isOpen,
    onClose,
    onApply,
    originalText,
    currentTranslation,
    context
}: AiAssistantModalProps) {
    const { apiKeys } = useApp();
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', text: string }>>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSend = async (text: string = input) => {
        if (!text.trim() || !apiKeys.gemini) return;

        const userMsg = text;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsLoading(true);

        try {
            const systemPrompt = `
Você é um assistente especializado em tradução e dublagem para PT-BR.
TEXTO ORIGINAL: "${originalText}"
TRADUÇÃO ATUAL: "${currentTranslation}"
CONTEXTO: "${context || 'Sem contexto adicional'}"

O usuário quer melhorar a tradução. Seja direto e sugira ótimas opções.
Mantenha frases curtas para sincronia labial.
`;

            const prompt = `${systemPrompt}\n\nUsuário: ${userMsg}`;
            const response = await chatWithAi(apiKeys.gemini, prompt);

            setMessages(prev => [...prev, { role: 'assistant', text: response }]);
        } catch (error: any) {
            console.error('Erro AI Assistant:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao conectar com a IA.';
            setMessages(prev => [...prev, { role: 'assistant', text: `❌ Erro: ${errorMessage}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl animate-fade-in transition-colors duration-300">
                {/* Header */}
                <div className="p-4 border-b dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        <h3 className="font-bold">IA Assistant</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950/50">
                    {/* Mensagem Inicial */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Original</p>
                        <p className="text-gray-800 dark:text-gray-200">{originalText}</p>
                        <div className="my-2 border-t border-gray-100 dark:border-gray-700" />
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Tradução Atual</p>
                        <p className="text-gray-800 dark:text-gray-200">{currentTranslation}</p>
                    </div>

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user'
                                ? 'bg-purple-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm'
                                }`}>
                                {msg.text}
                                {msg.role === 'assistant' && (
                                    <button
                                        onClick={() => { onApply(msg.text); onClose(); }}
                                        className="mt-2 flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 bg-opacity-50 hover:bg-opacity-100 rounded text-xs font-bold transition-all border border-green-200 dark:border-green-800/50"
                                    >
                                        <Check className="w-3 h-3" />
                                        Usar esta
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-xl rounded-tl-none animate-pulse text-gray-500 dark:text-gray-400">
                                ...
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="p-2 bg-gray-100 dark:bg-gray-800 flex gap-2 overflow-x-auto border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => handleSend("Gere 3 opções de tradução mais curtas")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-500 transition-colors whitespace-nowrap"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Opções mais curtas
                    </button>
                    <button
                        onClick={() => handleSend("Torne mais natural/informal")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-500 transition-colors whitespace-nowrap"
                    >
                        <MessageSquare className="w-3 h-3" />
                        Mais natural
                    </button>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 rounded-b-2xl">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Peça algo para a IA..."
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={isLoading}
                            className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
