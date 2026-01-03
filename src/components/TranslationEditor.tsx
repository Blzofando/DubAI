'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Edit2, Save, Clock, Type, Play, Pause, Sparkles } from 'lucide-react';
import AiAssistantModal from './AiAssistantModal';

export default function TranslationEditor() {
    const { translatedSegments, setTranslatedSegments, stage, sourceFile } = useApp();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editStart, setEditStart] = useState<number>(0);
    const [editEnd, setEditEnd] = useState<number>(0);

    // Audio Player State
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlayingId, setIsPlayingId] = useState<string | null>(null);
    const [playingSegmentEndDate, setPlayingSegmentEndDate] = useState<number>(0);

    // AI Modal State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

    // Setup source audio URL
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    useEffect(() => {
        if (sourceFile) {
            const url = URL.createObjectURL(sourceFile);
            setSourceUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [sourceFile]);

    // Monitor playback to stop at segment end
    useEffect(() => {
        const checkTime = () => {
            if (audioRef.current && isPlayingId && playingSegmentEndDate > 0) {
                if (audioRef.current.currentTime >= playingSegmentEndDate) {
                    audioRef.current.pause();
                    setIsPlayingId(null);
                    setPlayingSegmentEndDate(0);
                }
            }
        };

        const audio = audioRef.current;
        if (audio) {
            audio.addEventListener('timeupdate', checkTime);
            return () => audio.removeEventListener('timeupdate', checkTime);
        }
    }, [isPlayingId, playingSegmentEndDate]);

    if (translatedSegments.length === 0) {
        return null;
    }

    const handleEdit = (id: string, currentText: string, start: number, end: number) => {
        setEditingId(id);
        setEditText(currentText);
        setEditStart(start);
        setEditEnd(end);
    };

    const handleSave = (id: string) => {
        setTranslatedSegments(
            translatedSegments.map((seg) => {
                if (seg.id === id) {
                    const newDuration = editEnd - editStart;
                    // Recalcula targetCharCount se a duração mudar drasticamente,
                    // mas por enquanto mantemos a lógica original de usar o exactCharCount do original
                    // como referência. O importante aqui é corrigir o tempo para o FFmpeg.
                    return {
                        ...seg,
                        translatedText: editText,
                        actualCharCount: editText.length,
                        start: editStart,
                        end: editEnd
                    };
                }
                return seg;
            })
        );
        setEditingId(null);
        setEditText('');
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditText('');
    };

    const handlePlaySegment = (id: string, start: number, end: number) => {
        if (audioRef.current) {
            // Se já estiver tocando esse, pausa
            if (isPlayingId === id) {
                audioRef.current.pause();
                setIsPlayingId(null);
                setPlayingSegmentEndDate(0);
                return;
            }

            audioRef.current.currentTime = start;
            setPlayingSegmentEndDate(end);
            setIsPlayingId(id);
            audioRef.current.play().catch(e => console.error("Erro ao tocar:", e));
        }
    };

    const handleAiApply = (text: string) => {
        // Implementar lógica de aplicar (talvez inserir no textarea?)
        // Como o modal é chat, o usuário copia e cola, ou poderíamos ter um botão "Usar esta".
        // O modal atual não tem "onApply" chamado pelos botões de chat, mas vamos simplificar:
        // O usuário copia do chat. Ou podemos fazer o modal retornar texto.
        // Vamos deixar o usuário copiar por enquanto ou adicionar lógica futura.
    };

    const isDisabled = stage !== 'translation';

    // Encontrar segmento atual para contexto da IA
    const currentSegment = translatedSegments.find(s => s.id === editingId);

    return (
        <div className="bg-white dark:bg-gray-900 border-2 border-primary-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg relative transition-colors duration-300">
            {/* Hidden Audio Player for Source */}
            {sourceUrl && <audio ref={audioRef} src={sourceUrl} />}

            <AiAssistantModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                onApply={(text) => setEditText(text)}
                originalText={currentSegment?.text || ''}
                currentTranslation={editText}
                context="Usuário está editando este segmento."
            />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-500 rounded-lg">
                    <Edit2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Editor de Tradução</h3>
                <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    {translatedSegments.length} segmentos
                </span>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {translatedSegments.map((segment, index) => {
                    const isEditing = editingId === segment.id;
                    const duration = segment.end - segment.start;
                    const charDiff = segment.actualCharCount - segment.targetCharCount;
                    const isOverTarget = charDiff > 10;
                    const isUnderTarget = charDiff < -10;
                    const isPlaying = isPlayingId === segment.id;

                    return (
                        <div
                            key={segment.id}
                            className={`border-2 rounded-xl p-4 transition-all ${isEditing ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700 dark:bg-gray-800/30 hover:border-primary-300 dark:hover:border-primary-600'}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">#{index + 1}</span>

                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={editStart}
                                                onChange={(e) => setEditStart(Number(e.target.value))}
                                                className="w-16 px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                            />
                                            <span className="dark:text-gray-400">-</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={editEnd}
                                                onChange={(e) => setEditEnd(Number(e.target.value))}
                                                className="w-16 px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                                            onClick={() => handlePlaySegment(segment.id, segment.start, segment.end)}
                                            title="Toque para ouvir original">
                                            {isPlaying ? <Pause className="w-3 h-3 text-primary-600 dark:text-primary-400 animate-pulse" /> : <Play className="w-3 h-3" />}
                                            <span className="text-xs">{segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 bg-primary-50 dark:bg-primary-900/40 px-2 py-0.5 rounded-md text-primary-700 dark:text-primary-300 font-medium" title="Duração Total">
                                        <span className="text-xs">{isEditing ? (editEnd - editStart).toFixed(1) : duration.toFixed(1)}s</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Type className="w-4 h-4 dark:text-gray-400" />
                                        <span
                                            className={`font-semibold ${isOverTarget
                                                ? 'text-red-600 dark:text-red-400'
                                                : isUnderTarget
                                                    ? 'text-orange-600 dark:text-orange-400'
                                                    : 'text-green-600 dark:text-green-400'
                                                }`}
                                        >
                                            {isEditing ? editText.length : segment.actualCharCount}
                                        </span>
                                        <span className="text-gray-400 dark:text-gray-600">/ {segment.targetCharCount}</span>
                                    </div>
                                </div>

                                {!isDisabled && !isEditing && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handlePlaySegment(segment.id, segment.start, segment.end)}
                                            className={`p-1.5 rounded-lg transition-colors ${isPlaying ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                                            title="Ouvir original"
                                        >
                                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(segment.id, segment.translatedText, segment.start, segment.end)}
                                            className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors text-primary-600 dark:text-primary-400"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-semibold">Original:</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">{segment.text}</p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-semibold">Tradução:</p>
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                className="w-full px-3 py-2 border-2 border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none pr-10 bg-white dark:bg-gray-800 dark:text-white"
                                                rows={3}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => setIsAiModalOpen(true)}
                                                className="absolute top-2 right-2 p-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg text-white hover:shadow-lg transition-all transform hover:scale-110"
                                                title="Melhorar com IA"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSave(segment.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                Salvar
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium p-1">
                                        {segment.translatedText}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {!isDisabled && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                    💡 Dica: Use o botão <Play className="w-3 h-3 inline" /> para ouvir o trecho original e confirmar o sincronismo.
                </p>
            )}
        </div>
    );
}
