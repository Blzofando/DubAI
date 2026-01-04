import React, { useState } from 'react';
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

    // State for Export
    const [isExporting, setIsExporting] = useState(false);
    const {
        audioSegments,
        setFinalAudioBlob
    } = useApp();

    const handleExport = async () => {
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
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
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
                <div className="col-span-2 bg-black rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group p-4 border border-gray-800 shadow-2xl">
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
                    <Inspector selectedSegmentId={selectedSegmentId} />

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
