'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Play, Pause, SkipBack, SkipForward, Upload, FileVideo, Save, Home, Zap, Volume2, VolumeX, Mic, MonitorPlay } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import TimelineContainer from './Timeline/TimelineContainer';
import Inspector from './Inspector/Inspector';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { assembleAudio } from '@/services/ffmpeg';

export default function EditorView() {
    const {
        resetAll,
        sourceFile,
        setSourceFile,
        setCurrentView,
        translatedSegments,
        setTranslatedSegments,
        selectedVoice,
        speedAdjustmentQueue,
        processSpeedQueue,
        audioSegments,
        setAudioSegments,
        setFinalAudioBlob,
        updateAudioSegmentBlob,
        currentProject
    } = useApp();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const {
        videoRef,
        isPlaying,
        togglePlay,
        currentTime,
        duration,
        seek,
        isOriginalMuted, setIsOriginalMuted,
        isDubbingMuted, setIsDubbingMuted
    } = useAudioPlayback(lastSelectedId);

    const formatTime = (time: number) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Queues for batch processing
    const [ttsQueue, setTtsQueue] = useState<Set<string>>(new Set());
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    // Progress tracking
    const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number } | null>(null);
    const [speedProgress, setSpeedProgress] = useState<{ current: number; total: number } | null>(null);

    // State for Export/Save
    const [isExporting, setIsExporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- EXIT CONFIRMATION ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (ttsQueue.size > 0 || speedAdjustmentQueue.length > 0 || audioSegments.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [ttsQueue, speedAdjustmentQueue, audioSegments]);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (ttsQueue.size > 0 || speedAdjustmentQueue.length > 0) {
                if (!confirm('Existem alterações pendentes. Deseja realmente sair?')) {
                    history.pushState(null, '', window.location.href);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [ttsQueue, speedAdjustmentQueue]);

    // --- AUTO-INITIALIZE AUDIO SEGMENTS ---
    useEffect(() => {
        if (translatedSegments.length > 0 && audioSegments.length === 0) {
            console.log('Auto-initializing audioSegments from translatedSegments...');
            const emptyAudioSegments = translatedSegments.map(seg => ({
                id: seg.id,
                startTime: seg.start,
                duration: seg.end - seg.start,
                targetDuration: seg.end - seg.start,
                audioBlob: new Blob(),
                needsStretch: true
            }));
            setAudioSegments(emptyAudioSegments);
            setTtsQueue(new Set(translatedSegments.map(s => s.id)));
        }
    }, [translatedSegments.length, audioSegments.length]);

    // --- BATCH PROCESSING HANDLERS ---
    const processTTSQueue = async () => {
        if (ttsQueue.size === 0) return;
        setIsProcessingQueue(true);

        try {
            const { generateSpeech } = await import('@/services/tts');
            const { getAudioDuration } = await import('@/services/ffmpeg');

            const queueArray = Array.from(ttsQueue);
            const total = queueArray.length;
            let processedCount = 0;

            for (const id of queueArray) {
                const seg = translatedSegments.find(s => s.id === id);
                if (!seg) continue;

                processedCount++;
                setTtsProgress({ current: processedCount, total });

                const newBlob = await generateSpeech(seg.translatedText, selectedVoice);
                const newDuration = await getAudioDuration(newBlob);

                updateAudioSegmentBlob(id, newBlob, newDuration);

                setTtsQueue(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });

                await new Promise(r => setTimeout(r, 200));
            }
            alert(`✅ ${total} áudios gerados com sucesso!`);
        } catch (error) {
            console.error('Batch TTS Error:', error);
            alert('Erro ao processar fila de áudio.');
        } finally {
            setIsProcessingQueue(false);
            setTtsProgress(null);
        }
    };

    const handleProcessSpeedQueue = async () => {
        if (speedAdjustmentQueue.length === 0) return;
        setIsProcessingQueue(true);
        const total = speedAdjustmentQueue.length;
        try {
            await processSpeedQueue((current, total, msg) => {
                setSpeedProgress({ current, total });
            });
            alert(`✅ ${total} velocidades ajustadas com sucesso!`);
        } catch (error) {
            console.error('Speed Queue Error:', error);
            alert('Erro ao processar fila de velocidades.');
        } finally {
            setIsProcessingQueue(false);
            setSpeedProgress(null);
        }
    };

    const handleExport = async () => {
        if (ttsQueue.size > 0 || speedAdjustmentQueue.length > 0) {
            if (!confirm('Existem itens na fila de processamento. Exportar assim mesmo?')) return;
        }

        if (audioSegments.length === 0) {
            alert('Não há áudio para exportar');
            return;
        }
        setIsExporting(true);
        try {
            const { assembleDubbingOnly, loadFFmpeg } = await import('@/services/ffmpeg');
            await loadFFmpeg();

            const maxDuration = Math.max(duration, ...audioSegments.map(s => s.startTime + s.duration));
            const dubbedSegments = audioSegments.map(seg => ({
                blob: seg.audioBlob,
                start: seg.startTime
            }));

            const finalBlob = await assembleDubbingOnly(dubbedSegments, maxDuration);
            setFinalAudioBlob(finalBlob);

            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = currentProject?.name ? currentProject.name.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '_') : 'dubai-export';
            a.download = `${safeName}.mp3`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert('Erro na exportação');
        } finally {
            setIsExporting(false);
        }
    };

    const handleSave = async () => {
        if (!currentProject) {
            alert('Este projeto não pode ser salvo na nuvem no momento.');
            return;
        }
        setIsSaving(true);
        try {
            const { updateProject } = await import('@/services/projectService');
            await updateProject(currentProject.id, {
                translatedSegments,
            });
            alert('✅ Projeto salvo com sucesso na nuvem!');
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar projeto: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        const confirmMsg = count === 1 ? 'Excluir este segmento?' : `Excluir ${count} segmentos?`;
        if (window.confirm(confirmMsg)) {
            const newSegments = translatedSegments.filter(s => !selectedIds.has(s.id));
            setTranslatedSegments(newSegments);
            const newAudioSegments = audioSegments.filter(s => !selectedIds.has(s.id));
            setAudioSegments(newAudioSegments);
            setTtsQueue(prev => {
                const next = new Set(prev);
                selectedIds.forEach(id => next.delete(id));
                return next;
            });
            setSelectedIds(new Set());
            setLastSelectedId(null);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteSelected();
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, translatedSegments, togglePlay]);

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
            {/* 1. Header with Upload Button and Right Padding for Theme Toggle */}
            <div className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 pr-20 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (confirm('Sair do projeto? Progresso não salvo será perdido.')) {
                                resetAll();
                                setCurrentView('home');
                            }
                        }}
                        className="p-2 -ml-2 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                        title="Voltar"
                    >
                        <Home className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col max-w-[120px] sm:max-w-none">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:block">Projeto</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 leading-tight truncate">{currentProject?.name || 'Sem Título'}</span>
                    </div>

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2 hidden sm:block"></div>

                    {/* Compact Upload Button */}
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg cursor-pointer transition-colors text-sm border border-gray-200 dark:border-gray-700">
                        <Upload size={14} />
                        <span className="font-medium hidden sm:inline">Original</span>
                        <input
                            type="file"
                            accept="video/*" /* Also plays audio files via video tag usually */
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) setSourceFile(e.target.files[0]);
                            }}
                        />
                    </label>

                    {/* Queue Indicators */}
                    {(ttsQueue.size > 0 || speedAdjustmentQueue.length > 0) && (
                        <div className="flex items-center gap-2 ml-2">
                            {ttsQueue.size > 0 && (
                                <button onClick={processTTSQueue} disabled={isProcessingQueue} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                    <span className="hidden sm:inline">{isProcessingQueue ? 'Gerando...' : `Gerar ${ttsQueue.size}`}</span>
                                    <span className="sm:hidden text-[10px]">{ttsQueue.size}</span>
                                </button>
                            )}
                            {speedAdjustmentQueue.length > 0 && (
                                <button onClick={handleProcessSpeedQueue} disabled={isProcessingQueue} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                    <span className="hidden sm:inline">{isProcessingQueue ? 'Ajustando...' : `Ajustar ${speedAdjustmentQueue.length}`}</span>
                                    <span className="sm:hidden text-[10px]">{speedAdjustmentQueue.length}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting || isProcessingQueue}
                        className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                        title="Exportar Áudio"
                    >
                        {isExporting ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                <span className="hidden sm:inline">Renderizando...</span>
                            </>
                        ) : (
                            <>
                                <MonitorPlay className="w-4 h-4 sm:hidden" />
                                <span className="hidden sm:inline">Exportar Áudio</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isProcessingQueue}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all disabled:opacity-50"
                        title="Salvar"
                    >
                        <Save className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 2. Main Content Area (Full Inspector or Zero State) */}
            <div className="flex-1 overflow-hidden p-4 sm:p-6 relative">
                {/* Hidden Video Element for Logic */}
                {sourceFile && (
                    <video
                        ref={videoRef}
                        className="hidden" // Hiding the video element
                        playsInline
                        onLoadedMetadata={() => {/* Duration handled by hook */ }}
                    />
                )}

                {!sourceFile ? (
                    <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <FileVideo className="w-10 h-10 text-gray-400" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">Editor de Áudio IA</h2>
                        <p className="text-sm sm:text-base text-gray-500 max-w-md text-center mb-8">
                            Para começar a editar, carregue o arquivo de vídeo/áudio original.<br />
                            O vídeo não será exibido, apenas o áudio será processado.
                        </p>
                        <label className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer flex items-center gap-3 text-sm sm:text-base">
                            <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                            Carregar Arquivo Original
                            <input
                                type="file"
                                accept="video/*,audio/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) setSourceFile(e.target.files[0]);
                                }}
                            />
                        </label>
                    </div>
                ) : (
                    <Inspector
                        selectedIds={selectedIds}
                        lastSelectedId={lastSelectedId}
                        selectedSegmentId={lastSelectedId}
                        ttsQueue={ttsQueue}
                        setTtsQueue={setTtsQueue}
                        onDelete={handleDeleteSelected}
                    />
                )}
            </div>

            {/* 3. Transport Toolbar (New Location) */}
            <div className="h-14 bg-white dark:bg-gray-800 border-t border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 overflow-x-auto">

                {/* Left: Playback Controls */}
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <button
                        onClick={togglePlay}
                        className="w-10 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all shrink-0"
                    >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>

                    <div className="flex items-center gap-2">
                        <button onClick={() => seek(Math.max(0, currentTime - 5))} className="p-1.5 text-gray-500 hover:text-primary-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <SkipBack className="w-5 h-5" />
                        </button>
                        <button onClick={() => seek(Math.min(duration, currentTime + 5))} className="p-1.5 text-gray-500 hover:text-primary-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <SkipForward className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="font-mono text-base sm:text-lg font-bold text-gray-700 dark:text-gray-200 w-28 sm:w-32">
                        {formatTime(currentTime)} <span className="text-gray-400 text-xs sm:text-sm">/ {formatTime(duration)}</span>
                    </div>
                </div>

                {/* Center: Playback Status Text (Hidden on small) */}
                <div className="hidden md:block shrink-0 px-4">
                    {isPlaying ? (
                        <span className="text-xs font-bold text-green-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Reproduzindo
                        </span>
                    ) : (
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pausado</span>
                    )}
                </div>

                {/* Right: Mute Controls (Compact on small) */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <button
                        onClick={() => setIsOriginalMuted(!isOriginalMuted)}
                        className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isOriginalMuted
                            ? 'bg-red-50 text-red-500 border border-red-100'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                        title="Mutar áudio original"
                    >
                        {isOriginalMuted ? <VolumeX size={14} /> : <FileVideo size={14} />}
                        <span className="hidden sm:inline">Original</span>
                    </button>

                    <button
                        onClick={() => setIsDubbingMuted(!isDubbingMuted)}
                        className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isDubbingMuted
                            ? 'bg-red-50 text-red-500 border border-red-100'
                            : 'bg-primary-50 text-primary-600 border border-primary-100'
                            }`}
                        title="Mutar dublagem"
                    >
                        {isDubbingMuted ? <VolumeX size={14} /> : <Mic size={14} />}
                        <span className="hidden sm:inline">Dublagem</span>
                    </button>
                </div>
            </div>

            {/* 4. Timeline (Bottom) */}
            <div className="h-60 bg-gray-900 border-t border-gray-800 relative z-0 shrink-0">
                <TimelineContainer
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={seek}
                    selectedIds={selectedIds}
                    lastSelectedId={lastSelectedId}
                    onMultiSelect={(ids, lastId) => {
                        setSelectedIds(ids);
                        setLastSelectedId(lastId);
                    }}
                    isTotalOriginalMuted={isOriginalMuted}
                    onToggleMuteOriginal={() => setIsOriginalMuted(!isOriginalMuted)}
                    isTotalDubbingMuted={isDubbingMuted}
                    onToggleMuteDubbing={() => setIsDubbingMuted(!isDubbingMuted)}
                />
            </div>
        </div>
    );
}
