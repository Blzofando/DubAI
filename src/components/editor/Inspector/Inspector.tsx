'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { generateSpeech } from '@/services/tts';
import { getAudioDuration } from '@/services/ffmpeg';
import { RefreshCw, Play, Volume2, Clock, ListPlus, Trash2, Mic, FileText } from 'lucide-react';

interface InspectorProps {
    selectedIds?: Set<string>;
    lastSelectedId?: string | null;
    selectedSegmentId?: string | null;

    ttsQueue: Set<string>;
    setTtsQueue: React.Dispatch<React.SetStateAction<Set<string>>>;
    onDelete?: () => void;
}

export default function Inspector({
    selectedIds,
    lastSelectedId,
    selectedSegmentId,
    ttsQueue,
    setTtsQueue,
    onDelete
}: InspectorProps) {
    const {
        translatedSegments,
        setTranslatedSegments,
        audioSegments,
        updateAudioSegmentTiming,
        speedAdjustmentQueue,
        addToSpeedQueue
    } = useApp();

    const [text, setText] = useState('');

    const effectiveSelectedIds = selectedIds || (selectedSegmentId ? new Set([selectedSegmentId]) : new Set());
    const count = effectiveSelectedIds.size;

    const primaryId = lastSelectedId && effectiveSelectedIds.has(lastSelectedId)
        ? lastSelectedId
        : Array.from(effectiveSelectedIds)[0];

    const segment = translatedSegments.find(s => s.id === primaryId);
    const audioSeg = audioSegments.find(s => s.id === primaryId);

    useEffect(() => {
        if (segment && count === 1) {
            setText(segment.translatedText);
        }
    }, [primaryId, segment, count]);

    const handleTextChange = (newText: string) => {
        if (!segment) return;
        setText(newText);

        const newSegments = translatedSegments.map(s =>
            s.id === segment.id ? { ...s, translatedText: newText } : s
        );
        setTranslatedSegments(newSegments);
        setTtsQueue(prev => new Set(prev).add(segment.id));
    };

    const handleDurationChange = (newDuration: number) => {
        if (!segment || isNaN(newDuration) || newDuration <= 0) return;

        const newEnd = segment.start + newDuration;
        const newSegments = translatedSegments.map(s =>
            s.id === segment.id ? { ...s, end: newEnd } : s
        );
        setTranslatedSegments(newSegments);
        addToSpeedQueue(segment.id);
    };

    // --- RENDER ---

    // 1. EMPTY STATE
    if (count === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-6 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4">
                    <Mic className="w-8 h-8 text-primary-500 opacity-80" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Editor de Áudio IA</h3>
                <p className="max-w-md text-sm">Selecione um segmento na timeline abaixo para editar.</p>
                <div className="mt-6 flex gap-4 text-xs opacity-70">
                    <span className="flex items-center gap-1"><span className="p-1 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">Shift</span> + Click</span>
                    <span className="flex items-center gap-1"><span className="p-1 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">Ctrl</span> + Click</span>
                </div>
            </div>
        );
    }

    // 2. MULTI-SELECT MODE (Expanded)
    if (count > 1) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <ListPlus className="text-primary-600" />
                        Edição em Lote ({count})
                    </h3>
                </div>

                <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto min-h-0">
                    {/* Left: Actions */}
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-3">Ações Rápidas</h4>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        setTtsQueue(prev => {
                                            const next = new Set(prev);
                                            effectiveSelectedIds.forEach(id => next.add(id));
                                            return next;
                                        });
                                    }}
                                    className="w-full py-3 px-4 bg-white dark:bg-blue-800/20 hover:bg-blue-50 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                                >
                                    <RefreshCw size={16} /> Regerar Áudios
                                </button>
                                <button
                                    onClick={() => {
                                        effectiveSelectedIds.forEach(id => addToSpeedQueue(id));
                                        alert(`Adicionados ${count} segmentos à fila de velocidade.`);
                                    }}
                                    className="w-full py-3 px-4 bg-white dark:bg-amber-800/20 hover:bg-amber-50 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                                >
                                    <Clock size={16} /> Ajustar Velocidades
                                </button>
                                {onDelete && (
                                    <button
                                        onClick={onDelete}
                                        className="w-full py-3 px-4 bg-white dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all mt-6"
                                    >
                                        <Trash2 size={16} /> Excluir Selecionados
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: List */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col h-full bg-gray-50 dark:bg-gray-800">
                        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-500 shrink-0">
                            Selecionados
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                            {translatedSegments
                                .filter(s => effectiveSelectedIds.has(s.id))
                                .map(s => (
                                    <div key={s.id} className="text-sm p-3 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-700 flex gap-3">
                                        <span className="font-mono text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded self-start">
                                            {s.start.toFixed(1)}s
                                        </span>
                                        <span className="truncate text-gray-600 dark:text-gray-300">{s.translatedText}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 3. SINGLE EDIT MODE (Expanded)
    if (!segment) return null;

    const isInTtsQueue = ttsQueue.has(segment.id);
    const isInSpeedQueue = speedAdjustmentQueue.includes(segment.id);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1 rounded text-xs font-mono font-bold">
                        ID: {segment.id.slice(0, 4)}
                    </span>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Editor</h3>
                </div>

                <div className="flex items-center gap-2">
                    {onDelete && (
                        <button
                            onClick={() => {
                                if (confirm('Excluir este segmento?')) onDelete();
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir Segmento"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {/* Status Badge */}
                    {isInTtsQueue ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold animate-pulse">
                            <RefreshCw size={10} className="animate-spin" /> Gerando...
                        </span>
                    ) : isInSpeedQueue ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full text-[10px] font-bold animate-pulse">
                            <Clock size={10} /> Ajustando...
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold">
                            <Volume2 size={10} /> Pronto
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto min-h-0">
                {/* LEFT COLUMN (Technical & Source) - Spans 5/12 on LG, Full on Mobile */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                    {/* Timings */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <Clock size={12} /> Sincronização
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Início</label>
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
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm font-mono focus:border-primary-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Duração</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={(segment.end - segment.start).toFixed(2)}
                                    onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm font-mono focus:border-primary-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Original Source */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                            <FileText size={12} /> Texto Original
                        </label>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 italic min-h-[60px] max-h-[100px] overflow-y-auto">
                            "{segment.text}"
                        </div>
                    </div>

                    {/* Audio Stats */}
                    {audioSeg && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <div className="flex justify-between items-center text-xs mb-2">
                                <span className="text-gray-500">Duração Áudio</span>
                                <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{audioSeg.duration.toFixed(2)}s</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${audioSeg.duration > (segment.end - segment.start) ? 'bg-amber-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(100, (audioSeg.duration / (segment.end - segment.start)) * 100)}%` }}
                                ></div>
                            </div>
                            <div className="mt-2 text-xs text-right">
                                {(() => {
                                    const targetDuration = segment.end - segment.start;
                                    const speedFactor = audioSeg.duration / targetDuration;
                                    const needsAdjustment = Math.abs(speedFactor - 1.0) > 0.05;
                                    if (needsAdjustment) {
                                        return <span className="text-amber-600 font-bold">Ajuste: {speedFactor.toFixed(2)}x</span>
                                    }
                                    return <span className="text-green-600 font-bold">Tempo Ideal ✓</span>
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Delete removed from here */}
                </div>

                {/* RIGHT COLUMN (Creative - Translation) - Spans 7/12 on LG, Full on Mobile */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-[200px]">
                    <label className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2"><Mic size={14} /> Dublagem (Editável)</span>
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500">
                            {text.length} caracteres
                        </span>
                    </label>

                    <div className="flex-1 relative group">
                        <textarea
                            value={text}
                            onChange={(e) => handleTextChange(e.target.value)}
                            className={`w-full h-full p-4 text-base leading-relaxed bg-white dark:bg-gray-800 border-2 rounded-xl resize-none outline-none transition-all shadow-sm
                                ${isInTtsQueue
                                    ? 'border-amber-300 dark:border-amber-600 ring-4 ring-amber-50 dark:ring-amber-900/10'
                                    : 'border-gray-200 dark:border-gray-700 focus:border-primary-500 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20'
                                }
                            `}
                            placeholder="Digite a tradução aqui..."
                        />
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <span className="text-xs text-gray-400 bg-white dark:bg-gray-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                                Digite para regerar áudio
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 justify-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Auto-save & Auto-TTS ativados
                    </div>
                </div>
            </div>
        </div>
    );
}
