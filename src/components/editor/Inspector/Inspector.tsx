'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { generateSpeech } from '@/services/tts';
import { getAudioDuration } from '@/services/ffmpeg';
import { RefreshCw, Play, Volume2, Clock, ListPlus } from 'lucide-react';

interface InspectorProps {
    selectedSegmentId: string | null;
    ttsQueue: Set<string>;
    setTtsQueue: React.Dispatch<React.SetStateAction<Set<string>>>;
    speedQueue: Set<string>;
    setSpeedQueue: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function Inspector({
    selectedSegmentId,
    ttsQueue,
    setTtsQueue,
    speedQueue,
    setSpeedQueue
}: InspectorProps) {
    const {
        translatedSegments,
        setTranslatedSegments,
        audioSegments,
        updateAudioSegmentTiming,
        // updateAudioSegmentBlob, // Not used directly here anymore (batch only)
    } = useApp();

    const [text, setText] = useState('');

    // Find current segment data
    const segment = translatedSegments.find(s => s.id === selectedSegmentId);
    const audioSeg = audioSegments.find(s => s.id === selectedSegmentId);

    // Sync local state when selection changes
    useEffect(() => {
        if (segment) {
            setText(segment.translatedText);
        }
    }, [selectedSegmentId, segment]); // Re-sync if segment/id changes

    const handleTextChange = (newText: string) => {
        if (!segment) return;
        setText(newText);

        // 1. Auto-save to global state immediately (so switching blocks won't lose data)
        const newSegments = translatedSegments.map(s =>
            s.id === segment.id ? { ...s, translatedText: newText } : s
        );
        setTranslatedSegments(newSegments);

        // 2. Auto-queue for TTS generation
        setTtsQueue(prev => new Set(prev).add(segment.id));
    };

    const handleDurationChange = (newDuration: number) => {
        if (!segment || isNaN(newDuration) || newDuration <= 0) return;

        const newEnd = segment.start + newDuration;
        const newSegments = translatedSegments.map(s =>
            s.id === segment.id ? { ...s, end: newEnd } : s
        );
        setTranslatedSegments(newSegments);

        // Optimization: If text changed too (in TTS queue), speed will happen after TTS anyway.
        // But explicit speed queue is good for time-stretching existing audio.
        setSpeedQueue(prev => new Set(prev).add(segment.id));
    };

    if (!segment) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-6 text-center">
                <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <Volume2 className="w-8 h-8 opacity-50" />
                </div>
                <p>Selecione um bloco na timeline para editar.</p>
            </div>
        );
    }

    const isInTtsQueue = ttsQueue.has(segment.id);
    const isInSpeedQueue = speedQueue.has(segment.id);

    return (
        <div className="flex flex-col h-full">
            <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                Inspetor
            </h3>

            <div className="space-y-6 flex-1 overflow-y-auto">
                {/* Time Info (Editable) */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Início (s)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={segment.start.toFixed(2)}
                            onChange={(e) => {
                                const newStart = parseFloat(e.target.value);
                                if (!isNaN(newStart)) {
                                    const duration = segment.end - segment.start;
                                    const newSegments = translatedSegments.map(s =>
                                        s.id === segment.id ? { ...s, start: newStart, end: newStart + duration } : s
                                    );
                                    setTranslatedSegments(newSegments);
                                    updateAudioSegmentTiming(segment.id, newStart);
                                }
                            }}
                            className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-primary-500 outline-none font-mono text-sm"
                        />
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Duração (s)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={(segment.end - segment.start).toFixed(2)}
                            onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                            className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-primary-500 outline-none font-mono text-sm"
                        />
                    </div>
                </div>

                {/* Original Text */}
                <div>
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Original</label>
                    <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400 italic">
                        "{segment.text}"
                    </div>
                </div>

                {/* Translated Text (Editable) */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-primary-600 dark:text-primary-400 uppercase font-bold">Dublagem (Editável)</label>
                        {isInTtsQueue && <span className="text-xs text-amber-500 font-bold flex items-center gap-1"><Clock size={12} /> Pendente</span>}
                    </div>
                    <textarea
                        value={text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        className={`w-full h-32 p-3 bg-white dark:bg-gray-800 border-2 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none resize-none text-sm
                            ${isInTtsQueue ? 'border-amber-400 dark:border-amber-600' : 'border-gray-200 dark:border-gray-700'}
                        `}
                    />
                </div>

                {/* Audio Info */}
                {audioSeg && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Áudio Atual: {audioSeg.duration.toFixed(2)}s</span>
                            {(() => {
                                const targetDuration = segment.end - segment.start;
                                const speedFactor = audioSeg.duration / targetDuration;
                                const needsAdjustment = Math.abs(speedFactor - 1.0) > 0.05;

                                if (needsAdjustment) {
                                    return (
                                        <span className={`font-bold ${speedFactor > 1.2 ? 'text-amber-500' : 'text-blue-500'}`}>
                                            Velocidade: {speedFactor.toFixed(2)}x
                                        </span>
                                    );
                                }
                                return <span className="text-green-500 font-bold">✓ {speedFactor.toFixed(2)}x</span>;
                            })()}
                        </div>
                        {isInSpeedQueue && !isInTtsQueue && (
                            <div className="text-xs text-blue-500 font-bold flex items-center gap-1">
                                <Clock size={12} /> Ajuste de velocidade pendente
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Status Panel - Replaces old button */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-400 text-center mb-2">
                    Alterações são salvas e entram na fila automaticamente.
                </div>

                {isInTtsQueue ? (
                    <div className="w-full py-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold text-center text-sm border border-amber-200 dark:border-amber-700">
                        ⏳ Aguardando geração...
                    </div>
                ) : isInSpeedQueue ? (
                    <div className="w-full py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-center text-sm border border-blue-200 dark:border-blue-700">
                        ⏳ Aguardando ajuste de tempo...
                    </div>
                ) : (
                    <div className="w-full py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold text-center text-sm border border-green-200 dark:border-green-800">
                        ✅ Sincronizado
                    </div>
                )}
            </div>
        </div>
    );
}
