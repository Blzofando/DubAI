'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import ApiKeyInput from '@/components/ApiKeyInput';
import FileUpload from '@/components/FileUpload';
import VoiceSelector from '@/components/VoiceSelector';
import ProgressIndicator from '@/components/ProgressIndicator';
import TranslationEditor from '@/components/TranslationEditor';
import DownloadButton from '@/components/DownloadButton';
import { Play, RotateCcw, Sparkles, Sun, Moon } from 'lucide-react';

import { transcribeAudio, translateIsochronic } from '@/services/gemini';
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
        setSourceLanguage,
        setTranscriptSegments,
        translatedSegments,
        setTranslatedSegments,
        setAudioSegments,
        setFinalAudioBlob,
        selectedVoice,
        resetAll,
        theme,
        toggleTheme,
    } = useApp();

    const handleStart = async () => {
        if (!hasApiKeys || !sourceFile) return;

        try {
            setStage('transcription');
            setProgress({ stage: 'transcription', progress: 0, message: 'Iniciando...' });

            await loadFFmpeg();

            setProgress({ stage: 'transcription', progress: 10, message: 'Extraindo áudio...' });
            const audioBlob = await extractAudio(sourceFile);

            setProgress({ stage: 'transcription', progress: 30, message: 'Transcrevendo áudio (Gemini)...' });
            const transcript = await transcribeAudio(
                apiKeys.gemini,
                audioBlob,
                (msg) => setProgress({ stage: 'transcription', progress: 40, message: msg })
            );

            setTranscriptSegments(transcript);

            setStage('translation');
            setProgress({ stage: 'translation', progress: 60, message: 'Traduzindo e adaptando (Gemini)...' });

            const translated = await translateIsochronic(
                apiKeys.gemini,
                transcript,
                'pt-br',
                (msg) => setProgress({ stage: 'translation', progress: 70, message: msg })
            );

            setTranslatedSegments(translated);
            setProgress(null);

        } catch (error: any) {
            console.error('Erro no start:', error);
            alert(`Erro: ${error.message || 'Falha desconhecida'}`);
            setStage('idle');
            setProgress(null);
        }
    };

    const handleContinueToDubbing = async () => {
        try {
            setStage('dubbing');
            setProgress({ stage: 'dubbing', progress: 0, message: 'Gerando áudio (OpenAI)...' });

            const processedSegments = [];
            let completed = 0;

            for (let i = 0; i < translatedSegments.length; i++) {
                const seg = translatedSegments[i];
                const targetDuration = seg.end - seg.start;

                const ttsBlob = await generateSpeech(seg.translatedText, selectedVoice, apiKeys.openai);
                const currentDuration = await getAudioDuration(ttsBlob);

                let finalBlob = ttsBlob;

                if (currentDuration > targetDuration + 0.2) {
                    const speedFactor = currentDuration / targetDuration;
                    finalBlob = await adjustSpeed(ttsBlob, speedFactor);
                }

                processedSegments.push({
                    audioBlob: finalBlob,
                    startTime: seg.start,
                    duration: currentDuration
                });

                completed++;
                const pct = Math.round((completed / translatedSegments.length) * 100);
                setProgress({
                    stage: 'dubbing',
                    progress: pct,
                    message: `Gerando segmento ${completed}/${translatedSegments.length}`
                });
            }

            setStage('assembly');
            setProgress({ stage: 'assembly', progress: 100, message: 'Montando áudio final...' });

            const lastSeg = translatedSegments[translatedSegments.length - 1];
            const totalDuration = lastSeg ? lastSeg.end + 2 : 0;

            const finalAudio = await assembleAudio(processedSegments, totalDuration);
            setFinalAudioBlob(finalAudio);

            setStage('completed');
            setProgress(null);

        } catch (error: any) {
            console.error('Erro dublagem:', error);
            alert(`Erro na dublagem: ${error.message}`);
            setStage('translation');
            setProgress(null);
        }
    };

    const handleReset = () => {
        if (confirm('Tem certeza que deseja reiniciar? Todo o progresso será perdido.')) {
            resetAll();
        }
    };

    const canStart = hasApiKeys && sourceFile && stage === 'idle';
    const canReset = stage !== 'idle';

    return (
        <div className="min-h-screen transition-colors duration-300">
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b-2 border-primary-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                                    DubAI-PRO
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Dublagem Automática com IA</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-lg text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                                title="Alternar Tema"
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </button>

                            {canReset && stage !== 'idle' && (
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-400 transition-all"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Reiniciar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Config */}
                    <div className="lg:col-span-1 space-y-6">
                        <ApiKeyInput />
                        <VoiceSelector />
                    </div>

                    {/* Center Column - File & Progress */}
                    <div className="lg:col-span-2 space-y-6">
                        <FileUpload />

                        {canStart && (
                            <button
                                onClick={handleStart}
                                className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                            >
                                <Play className="w-6 h-6" />
                                Iniciar Dublagem
                            </button>
                        )}

                        {stage === 'translation' && translatedSegments.length > 0 && (
                            <button
                                onClick={handleContinueToDubbing}
                                className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 animate-pulse"
                            >
                                <Play className="w-6 h-6" />
                                Continuar para Dublagem
                            </button>
                        )}

                        <ProgressIndicator />
                        <TranslationEditor />
                        <DownloadButton />
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-12 p-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-2 border-primary-200 dark:border-primary-900/50 rounded-2xl transition-colors duration-300">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Como funciona?</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="font-semibold text-primary-600 dark:text-primary-400 mb-1">1. Transcrição</div>
                            <p className="text-gray-600 dark:text-gray-400">Gemini transcreve o áudio original</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="font-semibold text-primary-600 dark:text-primary-400 mb-1">2. Tradução</div>
                            <p className="text-gray-600 dark:text-gray-400">Tradução isocrônica para PT-BR</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="font-semibold text-accent-600 dark:text-accent-400 mb-1">3. Dublagem</div>
                            <p className="text-gray-600 dark:text-gray-400">OpenAI gera voz sincronizada</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="font-semibold text-accent-600 dark:text-accent-400 mb-1">4. Montagem</div>
                            <p className="text-gray-600 dark:text-gray-400">FFmpeg ajusta e monta o áudio</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
