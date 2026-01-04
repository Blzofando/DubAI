'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Sparkles, Sun, Moon } from 'lucide-react';

// Views
import SetupView from '@/components/setup/SetupView';
import ProcessingView from '@/components/processing/ProcessingView';
import EditorView from '@/components/editor/EditorView';

// Services
import { translateIsochronic } from '@/services/gemini';
import { transcribeWithWhisper } from '@/services/whisper';
import { generateSpeech } from '@/services/openai';
import { extractAudio, adjustSpeed, assembleAudio, getAudioDuration, loadFFmpeg } from '@/services/ffmpeg';

export default function HomePage() {
    const {
        hasApiKeys,
        apiKeys,
        sourceFile,
        stage,
        setStage,
        setProgress,
        setTranscriptSegments,
        translatedSegments,
        setTranslatedSegments,
        setAudioSegments,
        setFinalAudioBlob,
        selectedVoice,
        theme,
        toggleTheme,
    } = useApp();

    const handleProcessProject = async () => {
        if (!hasApiKeys || !sourceFile) return;

        try {
            setStage('processing');

            // --- 1. SETUP & EXTRACTION ---
            setProgress({ stage: 'processing', progress: 0, message: 'Iniciando engine...' });
            await loadFFmpeg();

            setProgress({ stage: 'processing', progress: 5, message: 'Extraindo áudio original...' });
            const audioBlob = await extractAudio(sourceFile);

            // --- 2. TRANSCRIPTION (WHISPER) ---
            setProgress({ stage: 'processing', progress: 15, message: 'Transcrevendo com Whisper (preciso)...' });
            const transcript = await transcribeWithWhisper(
                apiKeys.openai, // Whisper usa API key da OpenAI
                audioBlob,
                (msg) => setProgress({ stage: 'processing', progress: 20, message: msg })
            );
            setTranscriptSegments(transcript);

            // --- 3. TRANSLATION ---
            setProgress({ stage: 'processing', progress: 40, message: 'Traduzindo e adaptando (Gemini)...' });
            const translated = await translateIsochronic(
                apiKeys.gemini,
                transcript,
                'pt-br',
                (msg) => setProgress({ stage: 'processing', progress: 50, message: msg })
            );
            setTranslatedSegments(translated);

            // --- 4. DUBBING (TTS) & SYNC ---
            setProgress({ stage: 'processing', progress: 60, message: 'Gerando dublagem (OpenAI)...' });

            const processedSegments = [];
            let completed = 0;

            for (let i = 0; i < translated.length; i++) {
                const seg = translated[i];
                const targetDuration = seg.end - seg.start;

                // Call OpenAI TTS
                const ttsBlob = await generateSpeech(apiKeys.openai, seg.translatedText, selectedVoice);
                const currentDuration = await getAudioDuration(ttsBlob);

                let finalBlob = ttsBlob;

                // Auto-Speed Adjustment (CapCut style pre-processing)
                if (currentDuration > targetDuration + 0.2) {
                    const speedFactor = currentDuration / targetDuration;
                    finalBlob = await adjustSpeed(ttsBlob, speedFactor);
                }

                processedSegments.push({
                    id: seg.id, // Ensure ID is passed if available, or generate one
                    audioBlob: finalBlob,
                    startTime: seg.start,
                    duration: currentDuration,
                    targetDuration,
                    needsStretch: currentDuration > targetDuration
                });

                completed++;
                const pct = 60 + Math.round((completed / translated.length) * 30); // 60% -> 90%
                setProgress({
                    stage: 'processing',
                    progress: pct,
                    message: `Gerando segmento ${completed}/${translated.length}`
                });
            }

            setAudioSegments(processedSegments);

            // --- 5. INITIAL ASSEMBLY (Preview) ---
            setProgress({ stage: 'processing', progress: 95, message: 'Montando preview inicial...' });

            // We assemble it once so the Editor has a baseline "Full Audio" 
            // even though the timeline will play individual blobs later.
            const lastSeg = translated[translated.length - 1];
            const totalDuration = lastSeg ? lastSeg.end + 2 : 0;

            // Convert processed segments to assembleAudio format
            const dubbedSegments = processedSegments.map(seg => ({
                blob: seg.audioBlob,
                start: seg.startTime
            }));

            const finalAudio = await assembleAudio(audioBlob, dubbedSegments, totalDuration);
            setFinalAudioBlob(finalAudio);

            // --- DONE ---
            setProgress(null);
            setStage('editor');

        } catch (error: any) {
            console.error('Erro no processamento:', error);
            alert(`Erro: ${error.message || 'Falha desconhecida'}`);
            setStage('setup');
            setProgress(null);
        }
    };

    return (
        <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 h-16 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                        DubAI-PRO <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">v2.0</span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    >
                        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Main Content Manager */}
            <main>
                {stage === 'setup' && (
                    <SetupView onStartProcessing={handleProcessProject} />
                )}

                {stage === 'processing' && (
                    <ProcessingView />
                )}

                {stage === 'editor' && (
                    <EditorView />
                )}
            </main>
        </div>
    );
}
