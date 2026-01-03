'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Key, Save, Check } from 'lucide-react';

export default function ApiKeyInput() {
    const { apiKeys, saveApiKeys, hasApiKeys } = useApp();
    const [geminiKey, setGeminiKey] = useState(apiKeys.gemini);
    const [openaiKey, setOpenaiKey] = useState(apiKeys.openai);
    const [showKeys, setShowKeys] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    const handleSave = () => {
        saveApiKeys({ gemini: geminiKey, openai: openaiKey });
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };

    const isValid = geminiKey.length > 0 && openaiKey.length > 0;

    return (
        <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-slate-900 border-2 border-primary-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-500 rounded-lg">
                    <Key className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Configuração de API Keys</h2>
                {hasApiKeys && (
                    <div className="ml-auto flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                        <Check className="w-4 h-4" />
                        Salvas no cache
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Gemini API Key
                    </label>
                    <input
                        type={showKeys ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="Digite sua Gemini API Key"
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white transition-all outline-none font-mono text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        OpenAI API Key
                    </label>
                    <input
                        type={showKeys ? 'text' : 'password'}
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        placeholder="Digite sua OpenAI API Key"
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white transition-all outline-none font-mono text-sm"
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showKeys}
                            onChange={(e) => setShowKeys(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Mostrar chaves</span>
                    </label>

                    <button
                        onClick={handleSave}
                        disabled={!isValid}
                        className={`ml-auto flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${isValid
                            ? justSaved
                                ? 'bg-green-500 text-white'
                                : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
                            : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {justSaved ? (
                            <>
                                <Check className="w-5 h-5" />
                                Salvo!
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Salvar
                            </>
                        )}
                    </button>
                </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                ℹ️ As chaves são salvas no cache do navegador (localStorage) e nunca são enviadas para nenhum servidor.
            </p>
        </div>
    );
}
