'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { generateSpeech } from '@/services/openai';
import { getAudioDuration } from '@/services/ffmpeg';
import { RefreshCw, Play, Volume2 } from 'lucide-react';

interface InspectorProps {
    selectedSegmentId: string | null;
}

export default function Inspector({ selectedSegmentId }: InspectorProps) {
    const {
        translatedSegments,
        setTranslatedSegments,
        audioSegments,
        updateAudioSegmentBlob,
        updateAudioSegmentTiming,
        apiKeys,
        selectedVoice
    } = useApp();

    const [text, setText] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Find current segment data
    const segment = translatedSegments.find(s => s.id === selectedSegmentId);
    const audioSeg = audioSegments.find(s => s.id === selectedSegmentId);

    // Sync local state when selection changes
    useEffect(() => {
        if (segment) {
            setText(segment.translatedText);
        }
    }, [segment]);

    const handleRegenerate = async () => {
        if (!segment || !apiKeys.openai) return;

        try {
            setIsRegenerating(true);

            // 1. Generate new Audio
            const newBlob = await generateSpeech(apiKeys.openai, text, selectedVoice);
            const newDuration = await getAudioDuration(newBlob);

            // 2. Update Audio Segment in Context (Data)
            updateAudioSegmentBlob(segment.id, newBlob, newDuration);

            // 3. Update Translated Segment Text (UI)
            const newSegments = translatedSegments.map(s =>
                s.id === segment.id ? { ...s, translatedText: text } : s
            );
            setTranslatedSegments(newSegments);

            // 4. Update end time of the segment in UI as well? 
            // If duration changed, we might want to update the block width.
            // But we treat 'start' and 'end' as the "Time Slot". 
            // If the new audio is longer than the slot, we might show a warning.

        } catch (error) {
            console.error('Error generating speech:', error);
            alert('Erro ao gerar áudio.');
        } finally {
            setIsRegenerating(false);
        }
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
                            onChange={(e) => {
                                const newDuration = parseFloat(e.target.value);
                                if (!isNaN(newDuration) && newDuration > 0) {
                                    const newEnd = segment.start + newDuration;
                                    const newSegments = translatedSegments.map(s =>
                                        s.id === segment.id ? { ...s, end: newEnd } : s
                                    );
                                    setTranslatedSegments(newSegments);
                                }
                            }}
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
                    <label className="text-xs text-primary-600 dark:text-primary-400 uppercase font-bold mb-1 block">Dublagem (Editável)</label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full h-32 p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none resize-none text-sm"
                    />
                </div>

                {/* Audio Info */}
                {audioSeg && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Áudio Atual: {audioSeg.duration.toFixed(2)}s</span>
                        {audioSeg.duration > (segment.end - segment.start) && (
                            <span className="text-amber-500 font-bold">⚠️ Maior que o slot</span>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || text === segment.translatedText}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${isRegenerating
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                        : text !== segment.translatedText
                            ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default'
                        }`}
                >
                    <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {isRegenerating ? 'Gerando...' : 'Regenerar Áudio'}
                </button>
            </div>
        </div>
    );
}
