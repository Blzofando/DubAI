import React, { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, Play, Upload, FileText, CheckCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { parseSrt } from '@/utils/srtParser';
import { generateSpeechBatch } from '@/services/batchTTS';
import { adjustSpeed } from '@/services/ffmpeg';
import { rewriteTextForDuration } from '@/services/gemini';
import type { TranslatedSegment, AudioSegment } from '@/types';

interface ProcessingSegment {
    id: string;
    originalText: string;
    currentText: string;
    startTime: number;
    endTime: number;
    status: 'pending' | 'processing' | 'completed' | 'warning' | 'error' | 're-processing';
    attempts: number;
    audioBlob?: Blob;
    duration?: number;
    speedFactor?: number;
    message?: string;
    needsFix?: boolean;
}

export default function SrtDubbingView({ onBack }: { onBack: () => void }) {
    const {
        apiKeys,
        selectedVoice,
        setAudioSegments,
        setTranslatedSegments,
        setStage,
        setCurrentView,
        setTranscriptSegments
    } = useApp();

    const [file, setFile] = useState<File | null>(null);
    const [segments, setSegments] = useState<ProcessingSegment[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const parsed = parseSrt(content);
            setSegments(parsed.map(s => ({
                id: s.id,
                originalText: s.text,
                currentText: s.text,
                startTime: s.startTime,
                endTime: s.endTime,
                status: 'pending',
                attempts: 0
            })));
        };
        reader.readAsText(file);
    };

    const updateSegmentsState = (updates: ProcessingSegment[]) => {
        setSegments(prev => {
            const newSegments = [...prev];
            updates.forEach(update => {
                const index = newSegments.findIndex(s => s.id === update.id);
                if (index !== -1) {
                    newSegments[index] = update;
                }
            });
            return newSegments;
        });
    };

    // Parallel correction for a batch of segments
    const processCorrectionBatch = async (segmentsToFix: ProcessingSegment[]): Promise<ProcessingSegment[]> => {
        const promises = segmentsToFix.map(async (seg) => {
            let currentSeg = { ...seg };

            try {
                const targetDuration = currentSeg.endTime - currentSeg.startTime;

                // If max attempts reached, stop
                if (currentSeg.attempts >= 3) {
                    currentSeg.status = 'warning';
                    currentSeg.message = `Limite (${currentSeg.speedFactor?.toFixed(2)}x)`;
                    // Force adjust existing blob
                    if (currentSeg.audioBlob && currentSeg.speedFactor) {
                        try {
                            currentSeg.audioBlob = await adjustSpeed(currentSeg.audioBlob, currentSeg.speedFactor);
                        } catch (e) {
                            console.error("Failed to force adjust speed", e);
                        }
                    }
                    return currentSeg;
                }

                currentSeg.attempts++;
                currentSeg.status = 'processing';
                currentSeg.message = `Adaptando... (${currentSeg.attempts}/3)`;

                // 1. Rewrite Text
                const newText = await rewriteTextForDuration(
                    apiKeys.gemini,
                    currentSeg.currentText,
                    currentSeg.duration!,
                    targetDuration,
                    currentSeg.speedFactor!,
                    1.2 // Target Speed: 1.2x (to be safe > 1.1)
                );
                currentSeg.currentText = newText;

                // 2. Generate New Audio (Single TTS)
                // Note: We use the single generation here, but we could use batch if we had many
                // For "correction", usually few segments, so parallel single calls are fine via Promise.all
                // But we need to import generateSpeech from tts.ts or use a mini-batch
                // Let's use a mini-batch of size 1 effectively or just reuse logic
                // Importing generateSpeech from tts would differ from batchTTS structure
                // Let's use batchTTS again for these few segments?
                /* @ts-ignore */
                const [result] = await generateSpeechBatch(
                    [{
                        id: currentSeg.id,
                        translatedText: newText,
                        start: currentSeg.startTime,
                        end: currentSeg.endTime,
                        text: newText, // mock
                        targetCharCount: 0, actualCharCount: 0
                    } as TranslatedSegment],
                    selectedVoice || 'pt-BR-AntonioNeural',
                    { batchSize: 1, delayBetweenBatches: 0 }
                );

                if (result) {
                    const speedFactor = result.duration / targetDuration;
                    currentSeg.audioBlob = result.audioBlob;
                    currentSeg.duration = result.duration;
                    currentSeg.speedFactor = speedFactor;

                    // Check if fixed
                    // Changed: Accept ONLY if speedFactor >= 1.1 (and <= 1.5 to avoid too fast)
                    if (speedFactor >= 1.1 && speedFactor <= 1.5) {
                        currentSeg.status = 'completed';
                        currentSeg.message = `Corrigido (${speedFactor.toFixed(2)}x)`;
                        currentSeg.needsFix = false;

                        // Final adjust to fit slot exactly?
                        try {
                            currentSeg.audioBlob = await adjustSpeed(currentSeg.audioBlob, speedFactor);
                        } catch (e) { }
                    } else {
                        currentSeg.status = 're-processing'; // Mark for next loop
                        currentSeg.message = `Ainda fora (${speedFactor.toFixed(2)}x)`;
                        currentSeg.needsFix = true;
                    }
                }
            } catch (error) {
                console.error(`Error fixing segment ${currentSeg.id}`, error);
                currentSeg.status = 'error';
                currentSeg.message = 'Erro na correção';
            }
            return currentSeg;
        });

        return Promise.all(promises);
    }

    const startDubbing = async () => {
        if (!segments.length) return;
        if (!apiKeys.gemini) {
            alert('Configure sua chave API do Gemini nas configurações (ícone de engrenagem) para continuar.');
            return;
        }

        setIsProcessing(true);
        setCurrentStep('Gerando áudio inicial (Batch)...');
        setOverallProgress(5);

        try {
            // 1. Initial Batch Pass (FAST)
            const translatedForBatch: TranslatedSegment[] = segments.map(s => ({
                id: s.id,
                text: s.originalText,
                translatedText: s.originalText, // Initial text
                start: s.startTime,
                end: s.endTime,
                language: 'pt',
                targetCharCount: 0,
                actualCharCount: s.originalText.length
            }));

            const audioResults = await generateSpeechBatch(
                translatedForBatch,
                selectedVoice || 'pt-BR-AntonioNeural',
                { batchSize: 10, delayBetweenBatches: 200 }, // Aggressive batching
                (curr, total, msg) => {
                    setOverallProgress(10 + Math.round((curr / total) * 40)); // 10% -> 50%
                    setCurrentStep(msg);
                }
            );

            // 2. Map results back to segments
            let currentSegments = segments.map(seg => {
                const audio = audioResults.find(a => a.id === seg.id);
                if (!audio) return { ...seg, status: 'error', message: 'Falha no TTS' } as ProcessingSegment;

                const speedFactor = audio.duration / (seg.endTime - seg.startTime);
                // Strict check: < 1.0 or > 1.5
                const needsFix = speedFactor < 1.0 || speedFactor > 1.5;

                return {
                    ...seg,
                    audioBlob: audio.audioBlob,
                    duration: audio.duration,
                    speedFactor,
                    status: needsFix ? 'pending' : 'completed', // pending means needs fix check
                    needsFix,
                    message: needsFix ? `Fora do padrão (${speedFactor.toFixed(2)}x)` : `OK (${speedFactor.toFixed(2)}x)`
                } as ProcessingSegment;
            });

            setSegments(currentSegments);
            setCurrentStep('Analisando correções necessárias...');
            setOverallProgress(50);

            // 3. Correction Loop
            let segmentsToFix = currentSegments.filter(s => s.needsFix && s.status !== 'error');
            let loopCount = 0;

            while (segmentsToFix.length > 0 && loopCount < 3) {
                loopCount++;
                setCurrentStep(`Aplicando correções com IA (Ciclo ${loopCount})... ${segmentsToFix.length} segmentos.`);

                // Update UI to show they are processing
                updateSegmentsState(segmentsToFix.map(s => ({ ...s, status: 'processing' } as ProcessingSegment)));

                // Process in parallel
                const fixedResults = await processCorrectionBatch(segmentsToFix);

                // Update main state
                updateSegmentsState(fixedResults);

                // Refresh list for next loop
                // We need to adhere to the latest state
                // Since updateSegmentsState is async in React state, we should use the results return
                // Merge results back into a master list for the next iteration check
                currentSegments = currentSegments.map(s => {
                    const fixed = fixedResults.find(f => f.id === s.id);
                    return fixed || s;
                });

                segmentsToFix = currentSegments.filter(s => s.needsFix && s.status !== 'error' && s.status !== 'warning');
                setOverallProgress(50 + (loopCount * 15)); // Increment progress
            }

            // 4. Finalizing
            setCurrentStep('Finalizando e preparando editor...');
            setOverallProgress(95);

            // Final pass: Adjust speed for any remaining "Good" or "Warning" segments to fit exact slot?
            // Optional, but sticking to user flow: "não baixou nem nada" -> Send to Editor.

            // Prepare data for Context
            const finalTranslatedSegments: TranslatedSegment[] = currentSegments.map(s => ({
                id: s.id,
                start: s.startTime,
                end: s.endTime,
                text: s.originalText,
                translatedText: s.currentText,
                targetCharCount: 0,
                actualCharCount: s.currentText.length
            }));

            const finalAudioSegments: AudioSegment[] = currentSegments.map(s => ({
                id: s.id,
                audioBlob: s.audioBlob!, // Assume exists or filter
                duration: s.duration || 0,
                targetDuration: s.endTime - s.startTime,
                startTime: s.startTime,
                needsStretch: false, // We handled it or gave up
                appliedSpeedFactor: s.speedFactor
            })).filter(s => s.audioBlob);

            // Populate Transcript (Dummy or Original)
            const transcriptSegments = finalTranslatedSegments.map(s => ({
                ...s,
                text: s.text // original
            }));

            setTranscriptSegments(transcriptSegments);
            setTranslatedSegments(finalTranslatedSegments);
            setAudioSegments(finalAudioSegments);

            // Redirect
            setOverallProgress(100);
            setStage('editor');
            setCurrentView('editor');

        } catch (error) {
            console.error(error);
            setCurrentStep('Erro fatal no processo.');
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg">
                        <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dublagem Inteligente (SRT)</h1>
                </div>

                {!file ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-3 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-all group"
                    >
                        <Upload className="w-16 h-16 text-gray-400 group-hover:text-blue-500 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Upload SRT ou TXT</h3>
                        <p className="text-gray-500">Clique para selecionar o arquivo de legendas</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".srt,.txt"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <FileText className="w-8 h-8 text-blue-500" />
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{file.name}</h3>
                                    <p className="text-sm text-gray-500">{segments.length} blocos encontrados</p>
                                </div>
                            </div>
                            {!isProcessing && (
                                <button
                                    onClick={startDubbing}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 transform hover:scale-105 transition-all"
                                >
                                    <Zap className="w-5 h-5 fill-current" /> Iniciar Processo Rápido
                                </button>
                            )}
                        </div>

                        {/* Progress Bar */}
                        {isProcessing && (
                            <div className="mb-6 space-y-2">
                                <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span>{currentStep}</span>
                                    <span>{overallProgress}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${overallProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Segments List */}
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {segments.map((seg) => (
                                <div
                                    key={seg.id}
                                    className={`p-4 rounded-xl border-l-4 ${seg.status === 'completed' ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' :
                                        seg.status === 'warning' ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10' :
                                            seg.status === 'error' ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' :
                                                (seg.status === 'processing' || seg.status === 're-processing') ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' :
                                                    'border-gray-300 bg-gray-50 dark:bg-gray-800'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-mono text-xs text-gray-500">#{seg.id} • {seg.startTime.toFixed(2)}s - {seg.endTime.toFixed(2)}s</span>
                                        <div className="flex items-center gap-2">
                                            {(seg.status === 'processing' || seg.status === 're-processing') && <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />}
                                            {seg.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                            {seg.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                            {seg.duration && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${seg.speedFactor! > 1.5 || seg.speedFactor! < 1.0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {seg.speedFactor?.toFixed(2)}x
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-gray-500 text-sm line-through opacity-75">{seg.originalText}</p>
                                        <p className="text-gray-900 dark:text-white font-medium">{seg.currentText}</p>
                                    </div>

                                    {seg.message && (
                                        <div className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                            {seg.attempts > 0 && <RefreshCw className="w-3 h-3" />}
                                            {seg.message}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Add CSS for scrolling if needed in global styles or just rely on Tailwind
