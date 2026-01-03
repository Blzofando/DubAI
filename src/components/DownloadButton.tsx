'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Download, CheckCircle } from 'lucide-react';

export default function DownloadButton() {
    const { finalAudioBlob, stage, sourceFile } = useApp();

    const handleDownload = () => {
        if (!finalAudioBlob) return;

        const url = URL.createObjectURL(finalAudioBlob);
        const a = document.createElement('a');
        a.href = url;

        // Nome do arquivo baseado no original
        const originalName = sourceFile?.name.replace(/\.(mp4|mp3)$/i, '') || 'audio';
        a.download = `${originalName}_dubbed.mp3`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!finalAudioBlob) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-800 rounded-2xl p-6 shadow-lg transition-colors duration-300">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-500 rounded-xl">
                    <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Dublagem Concluída!</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Seu áudio foi processado com sucesso
                    </p>
                </div>
            </div>

            {/* Player de Áudio */}
            {finalAudioBlob && (
                <div className="mb-4 bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-green-200 dark:border-green-800/50">
                    <audio
                        controls
                        className="w-full"
                        src={URL.createObjectURL(finalAudioBlob)}
                    >
                        Seu navegador não suporta o elemento de áudio.
                    </audio>
                </div>
            )}

            <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
                <Download className="w-6 h-6" />
                Baixar Áudio Dublado
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                O áudio contém apenas a voz dublada sincronizada
            </p>
        </div>
    );
}
