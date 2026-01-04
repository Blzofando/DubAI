import React, { useState, useEffect } from 'react';
import { RotateCcw, Play, Pause, SkipBack, SkipForward, Upload, FileVideo } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import TimelineContainer from './Timeline/TimelineContainer';
import Inspector from './Inspector/Inspector';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { assembleAudio } from '@/services/ffmpeg';

export default function EditorView() {
    const { resetAll, sourceFile, setSourceFile } = useApp();
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

    const {
        videoRef,
        isPlaying,
        togglePlay,
        currentTime,
        duration,
        seek,
        isOriginalMuted, setIsOriginalMuted,
        isDubbingMuted, setIsDubbingMuted
    } = useAudioPlayback(selectedSegmentId);
    const formatTime = (time: number) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Queues for batch processing
    const [ttsQueue, setTtsQueue] = useState<Set<string>>(new Set());
    const [speedQueue, setSpeedQueue] = useState<Set<string>>(new Set());
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    // State for Export
    const [isExporting, setIsExporting] = useState(false);
    const {
        audioSegments,
        translatedSegments,
        setFinalAudioBlob,
        updateAudioSegmentBlob,
        selectedVoice
    } = useApp();

    // --- EXIT CONFIRMATION ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (ttsQueue.size > 0 || speedQueue.size > 0 || audioSegments.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [ttsQueue, speedQueue, audioSegments]);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            // Basic protection for back button
            // Note: heavily browser dependent, next.js navigation might bypass this
            if (ttsQueue.size > 0 || speedQueue.size > 0) {
                if (!confirm('Existem alterações pendentes. Deseja realmente sair?')) {
                    history.pushState(null, '', window.location.href);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [ttsQueue, speedQueue]);


    // --- BATCH PROCESSING ---
    const processTTSQueue = async () => {
        if (ttsQueue.size === 0) return;
        setIsProcessingQueue(true);

        try {
            const { generateSpeech } = await import('@/services/tts');
            const { getAudioDuration } = await import('@/services/ffmpeg');

            const queueArray = Array.from(ttsQueue);
            let processedCount = 0;

            for (const id of queueArray) {
                const seg = translatedSegments.find(s => s.id === id);
                if (!seg) continue;

                // Generate
                const newBlob = await generateSpeech(seg.translatedText, selectedVoice);
                const newDuration = await getAudioDuration(newBlob);

                updateAudioSegmentBlob(id, newBlob, newDuration);

                processedCount++;
                // Update queue UI progress optionally? for now just remove from set
                setTtsQueue(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });

                // Small delay to be nice to API
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (error) {
            console.error('Batch TTS Error:', error);
            alert('Erro ao processar fila de áudio.');
        } finally {
            setIsProcessingQueue(false);
        }
    };

    const processSpeedQueue = async () => {
        if (speedQueue.size === 0) return;
        setIsProcessingQueue(true);

        try {
            const { adjustAudioSpeed, loadFFmpeg } = await import('@/services/ffmpeg');

            await loadFFmpeg();

            const queueArray = Array.from(speedQueue);

            for (const id of queueArray) {
                const audioSeg = audioSegments.find(s => s.id === id);
                const textSeg = translatedSegments.find(s => s.id === id);

                if (!audioSeg || !textSeg) continue;

                const targetDuration = textSeg.end - textSeg.start;
                const currentDuration = audioSeg.duration;

                // If duration is already close, skip? No, user explicitly asked.
                const speedFactor = currentDuration / targetDuration;

                const newBlob = await adjustAudioSpeed(audioSeg.audioBlob, speedFactor);

                updateAudioSegmentBlob(id, newBlob, targetDuration);

                setSpeedQueue(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }

        } catch (error) {
            console.error('Batch Speed Error:', error);
            alert('Erro ao processar velocidades.');
        } finally {
            setIsProcessingQueue(false);
        }
    };

    const handleExport = async () => {
        if (ttsQueue.size > 0 || speedQueue.size > 0) {
            if (!confirm('Existem itens na fila de processamento. Exportar assim mesmo (usando versões antigas)?')) {
                return;
            }
        }

        if (audioSegments.length === 0) {
            alert('Não há áudio para exportar');
            return;
        }
        setIsExporting(true);
        try {
            // Recalculate duration based on latest segments
            const maxDuration = Math.max(duration, ...audioSegments.map(s => s.startTime + s.duration));

            // Convert audioSegments to format needed
            const dubbedSegments = audioSegments.map(seg => ({
                blob: seg.audioBlob,
                start: seg.startTime
            }));

            // Assemble ONLY dubbing (without original audio)
            const { assembleDubbingOnly } = await import('@/services/ffmpeg');
            const finalBlob = await assembleDubbingOnly(dubbedSegments, maxDuration);
            setFinalAudioBlob(finalBlob);

            // Trigger Download
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dubai-pro-export.mp3';
            a.click();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error(error);
            alert('Erro na exportação');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Toolbar Header (New) */}
            <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500">Editor</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Projeto Sem Título</span>

                    {/* QUEUE STATUS */}
                    <div className="flex items-center gap-2 ml-4">
                        {ttsQueue.size > 0 && (
                            <button
                                onClick={processTTSQueue}
                                disabled={isProcessingQueue}
                                className="flex items-center gap-2 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors animate-pulse"
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                                Gerar {ttsQueue.size} áudios pendentes
                            </button>
                        )}
                        {speedQueue.size > 0 && (
                            <button
                                onClick={processSpeedQueue}
                                disabled={isProcessingQueue}
                                className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-colors animate-pulse"
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                Ajustar {speedQueue.size} velocidades
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting || isProcessingQueue}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${isExporting
                            ? 'bg-gray-100 text-gray-400 cursor-wait'
                            : 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg'
                            }`}
                    >
                        {isExporting ? 'Renderizando...' : 'Exportar Áudio'}
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-4 p-4">
                {/* Left: Video Preview */}
                <div className="col-span-2 bg-black rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group p-4 border border-gray-800 shadow-2xl max-h-[400px]">
                    {sourceFile ? (
                        <>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-contain rounded-lg shadow-2xl"
                                onClick={togglePlay}
                                playsInline
                            />

                            {/* Overlay Controls */}
                            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full transition-all duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                                <button onClick={() => seek(Math.max(0, currentTime - 5))} className="text-white hover:text-accent-400 transition-colors">
                                    <SkipBack className="w-5 h-5" />
                                </button>
                                <button onClick={togglePlay} className="text-white hover:text-accent-400 transform hover:scale-110 transition-transform">
                                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                                </button>
                                <button onClick={() => seek(Math.min(duration, currentTime + 5))} className="text-white hover:text-accent-400 transition-colors">
                                    <SkipForward className="w-5 h-5" />
                                </button>
                                <span className="text-white font-mono text-sm ml-4 border-l border-gray-600 pl-4">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-8 z-10 w-full">
                            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <FileVideo className="text-gray-400" size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Vídeo Original Necessário</h3>
                            <p className="text-gray-400 mb-6 max-w-md mx-auto">
                                Como não usamos armazenamento em nuvem para arquivos grandes,
                                selecione o vídeo original do seu computador para continuar editando.
                            </p>
                            <label className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl cursor-pointer transition-all transform hover:scale-105 shadow-lg hover:shadow-primary-600/20">
                                <Upload size={20} />
                                Selecionar Arquivo
                                <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setSourceFile(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    )}
                </div>

                {/* Right: Inspector */}
                <div className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700 shadow-sm">
                    <Inspector
                        selectedSegmentId={selectedSegmentId}
                        ttsQueue={ttsQueue}
                        setTtsQueue={setTtsQueue}
                        speedQueue={speedQueue}
                        setSpeedQueue={setSpeedQueue}
                    />

                    <button onClick={resetAll} className="w-full mt-4 text-xs text-red-400 hover:text-red-500 underline">
                        Resetar Projeto (Debug)
                    </button>
                </div>
            </div>

            {/* Bottom: Timeline */}
            <div className="h-72 bg-gray-900 border-t border-gray-800">
                <TimelineContainer
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={seek}
                    selectedSegmentId={selectedSegmentId}
                    onSelectSegment={setSelectedSegmentId}
                    isTotalOriginalMuted={isOriginalMuted}
                    onToggleMuteOriginal={() => setIsOriginalMuted(!isOriginalMuted)}
                    isTotalDubbingMuted={isDubbingMuted}
                    onToggleMuteDubbing={() => setIsDubbingMuted(!isDubbingMuted)}
                />
            </div>
        </div>
    );
}
