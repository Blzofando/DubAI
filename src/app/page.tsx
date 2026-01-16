'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Sun, Moon } from 'lucide-react';

// Views
import LoginScreen from '@/components/auth/LoginScreen';
import ProjectList from '@/components/projects/ProjectList';
import HomePage from '@/components/home/HomePage';
import SettingsView from '@/components/settings/SettingsView';
import SimpleDubbingView from '@/components/dubbing/SimpleDubbingView';
import LongDubbingView from '@/components/dubbing/LongDubbingView';
import DouyinDubbingView from '@/components/dubbing/DouyinDubbingView';
import SrtDubbingView from '@/components/dubbing/SrtDubbingView';
import ProcessingView from '@/components/processing/ProcessingView';
import EditorView from '@/components/editor/EditorView';

// Services
import { translateIsochronic, transcribeAudio } from '@/services/gemini';
import { transcribeWithWhisper } from '@/services/whisper';
import { translateWithOpenAI } from '@/services/openaiTranslation';
import { generateSpeech } from '@/services/tts';
import { generateSpeechBatch } from '@/services/batchTTS';
import { extractAudio, assembleAudio, assembleDubbingOnly, loadFFmpeg, terminateFFmpeg, adjustAudioSpeed, removeSilence, adjustVideoSpeed } from '@/services/ffmpeg';
import { processDouyinSplits } from '@/services/cliffhanger';
import { createProject, updateProject, uploadFile } from '@/services/projectService';

import type { Project } from '@/types/project';
import type { AudioSegment } from '@/types';

export default function MainPage() {
    const { user, loading: authLoading } = useAuth();
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
        transcriptionProvider,
        translationProvider,
        setSourceFile,
        currentView,
        setCurrentView,
        currentProject,
        setCurrentProject
    } = useApp();

    const [projectName, setProjectName] = useState('');
    const [showProjectList, setShowProjectList] = useState(true);

    const handleProcessProject = async () => {
        if (!hasApiKeys || !sourceFile || !user) return;

        try {
            setStage('processing');
            setCurrentView('processing');

            // --- 1. SETUP & EXTRACTION ---
            setProgress({ stage: 'processing', progress: 0, message: 'Iniciando engine...' });
            await loadFFmpeg();

            setProgress({ stage: 'processing', progress: 5, message: 'Extraindo áudio original...' });
            const audioBlob = await extractAudio(sourceFile);

            // --- 2. TRANSCRIPTION ---
            setProgress({ stage: 'processing', progress: 15, message: `Transcrevendo com ${transcriptionProvider === 'whisper' ? 'Whisper' : 'Gemini'}...` });

            let transcript;
            if (transcriptionProvider === 'whisper') {
                transcript = await transcribeWithWhisper(
                    apiKeys.openai,
                    audioBlob,
                    (msg: string) => setProgress({ stage: 'processing', progress: 20, message: msg })
                );
            } else {
                transcript = await transcribeAudio(
                    apiKeys.gemini,
                    audioBlob,
                    (msg: string) => setProgress({ stage: 'processing', progress: 20, message: msg })
                );
            }
            setTranscriptSegments(transcript);

            // --- 3. TRANSLATION ---
            setProgress({ stage: 'processing', progress: 40, message: `Traduzindo com ${translationProvider === 'gemini' ? 'Gemini' : 'OpenAI'}...` });

            let translated;
            if (translationProvider === 'gemini') {
                translated = await translateIsochronic(
                    apiKeys.gemini,
                    transcript,
                    'pt-BR',
                    (msg: string) => setProgress({ stage: 'processing', progress: 45, message: msg })
                );
            } else {
                translated = await translateWithOpenAI(
                    apiKeys.openai,
                    transcript,
                    'pt-BR',
                    (msg: string) => setProgress({ stage: 'processing', progress: 45, message: msg })
                );
            }
            setTranslatedSegments(translated);

            // --- 4. TTS (OPENAI) ---
            setProgress({ stage: 'processing', progress: 60, message: 'Gerando dublagem com Edge TTS...' });
            const processedSegments: AudioSegment[] = [];

            for (let i = 0; i < translated.length; i++) {
                const seg = translated[i];
                setProgress({
                    stage: 'processing',
                    progress: 60 + (i / translated.length) * 30,
                    message: `Gerando TTS ${i + 1}/${translated.length}...`
                });

                try {
                    let audioBlob = await generateSpeech(
                        seg.translatedText,
                        selectedVoice
                    );

                    // Try to remove silence - if it fails, continue with original audio
                    try {
                        audioBlob = await removeSilence(audioBlob);
                    } catch (error) {
                        console.warn(`Não foi possível remover silêncio do segmento ${i + 1}:`, error);
                        // Continue with original audio blob
                    }

                    // Calculate actual audio duration (after silence removal if successful)
                    const actualDuration = await new Promise<number>((resolve, reject) => {
                        const audio = new Audio();
                        audio.onloadedmetadata = () => resolve(audio.duration);
                        audio.onerror = reject;
                        audio.src = URL.createObjectURL(audioBlob);
                    });

                    const targetDuration = seg.end - seg.start;
                    const needsAdjustment = Math.abs(actualDuration - targetDuration) > 0.2;

                    processedSegments.push({
                        id: seg.id,
                        audioBlob,
                        duration: actualDuration,
                        targetDuration,
                        startTime: seg.start,
                        needsStretch: needsAdjustment
                    });
                } catch (error: any) {
                    console.error(`Erro ao processar TTS do segmento ${i + 1}:`, error);
                    // Skip this segment and continue
                    alert(`Erro ao gerar áudio para segmento ${i + 1}: ${error.message}\nContinuando com próximos...`);
                }
            }

            setAudioSegments(processedSegments);

            // Auto-apply speed adjustment for segments that need it
            setProgress({ stage: 'processing', progress: 90, message: 'Ajustando velocidades...' });

            for (let i = 0; i < processedSegments.length; i++) {
                const seg = processedSegments[i];
                if (seg.needsStretch) {
                    setProgress({
                        stage: 'processing',
                        progress: 90 + (i / processedSegments.length) * 5,
                        message: `Ajustando ${i + 1}/${processedSegments.length}...`
                    });

                    try {
                        const speedFactor = seg.duration / seg.targetDuration;
                        const adjustedBlob = await adjustAudioSpeed(seg.audioBlob, speedFactor);

                        // Update segment with adjusted audio and save the applied speed factor
                        seg.audioBlob = adjustedBlob;
                        seg.duration = seg.targetDuration;
                        seg.needsStretch = false;
                        seg.appliedSpeedFactor = speedFactor; // Save the speed that was applied
                    } catch (error) {
                        console.warn(`Não foi possível ajustar velocidade do segmento ${i + 1}:`, error);
                        // Keep needsStretch = true so user can adjust manually in editor
                        // Don't update the blob - keep original
                    }
                }
            }

            setAudioSegments([...processedSegments]); // Force state update

            // --- 5. INITIAL ASSEMBLY (Preview) ---
            setProgress({ stage: 'processing', progress: 95, message: 'Montando preview inicial...' });

            const lastSeg = translated[translated.length - 1];
            const totalDuration = lastSeg ? lastSeg.end + 2 : 0;

            const dubbedSegments = processedSegments.map(seg => ({
                blob: seg.audioBlob,
                start: seg.startTime
            }));

            const finalAudio = await assembleAudio(audioBlob, dubbedSegments, totalDuration);
            setFinalAudioBlob(finalAudio);

            // --- 6. SAVE PROJECT TO FIREBASE ---
            setProgress({ stage: 'processing', progress: 97, message: 'Salvando projeto...' });

            try {
                // Upload disabled (No Storage Access)
                // const sourceUrl = await uploadFile(...)

                // Create project in Firestore (Metadata only)
                const projectId = await createProject({
                    name: projectName,
                    userId: user.uid,
                    sourceFileName: sourceFile.name,
                    sourceFileUrl: '', // No storage URL
                    transcriptSegments: transcript,
                    translatedSegments: translated,
                    duration: totalDuration,
                    selectedVoice: selectedVoice
                });

                console.log('Project saved:', projectId);

                setCurrentProject({
                    id: projectId,
                    name: projectName,
                    userId: user.uid,
                    sourceFileName: sourceFile.name,
                    transcriptSegments: transcript,
                    translatedSegments: translated,
                    duration: totalDuration,
                    selectedVoice: selectedVoice,
                    createdAt: new Date() as any, // Simulação para UI
                    updatedAt: new Date() as any
                });
            } catch (err) {
                console.error('Error saving project:', err);
                // Continue even if save fails
            }

            // --- DONE ---
            setProgress(null);
            setStage('editor');
            setCurrentView('editor');

        } catch (error: any) {
            console.error('Erro no processamento:', error);
            alert(`Erro: ${error.message}`);
            setStage('setup');
            setCurrentView('dubbing');
            setProgress(null);
        }
    };

    // Handler for Long Dubbed (Batch TTS Processing)
    const handleProcessLongProject = async () => {
        if (!hasApiKeys || !sourceFile || !user) return;

        try {
            setStage('processing');
            setCurrentView('processing');

            // --- 1. SETUP & EXTRACTION ---
            setProgress({ stage: 'processing', progress: 0, message: 'Iniciando engine...' });
            await loadFFmpeg();

            setProgress({ stage: 'processing', progress: 5, message: 'Extraindo áudio original...' });
            const audioBlob = await extractAudio(sourceFile);

            // --- 2. TRANSCRIPTION ---
            setProgress({ stage: 'processing', progress: 15, message: `Transcrevendo com ${transcriptionProvider === 'whisper' ? 'Whisper' : 'Gemini'}...` });

            let transcript;
            if (transcriptionProvider === 'whisper') {
                transcript = await transcribeWithWhisper(
                    apiKeys.openai,
                    audioBlob,
                    (msg: string) => setProgress({ stage: 'processing', progress: 20, message: msg })
                );
            } else {
                transcript = await transcribeAudio(
                    apiKeys.gemini,
                    audioBlob,
                    (msg: string) => setProgress({ stage: 'processing', progress: 20, message: msg })
                );
            }
            setTranscriptSegments(transcript);

            // --- 3. TRANSLATION ---
            setProgress({ stage: 'processing', progress: 30, message: `Traduzindo com ${translationProvider === 'openai' ? 'OpenAI' : 'Gemini'}...` });

            let translated;
            if (translationProvider === 'openai') {
                translated = await translateWithOpenAI(
                    apiKeys.openai,
                    transcript
                );
            } else {
                translated = await translateIsochronic(
                    apiKeys.gemini,
                    transcript
                );
            }
            setTranslatedSegments(translated);

            // --- 4. BATCH TTS (PARALLEL) ---
            setProgress({ stage: 'processing', progress: 60, message: '⚡ Gerando dublagem em batches paralelos...' });

            const processedSegments = await generateSpeechBatch(
                translated,
                selectedVoice,
                { batchSize: 5, delayBetweenBatches: 500 },
                (current, total, message) => {
                    const progress = 60 + (current / total) * 30;
                    setProgress({
                        stage: 'processing',
                        progress,
                        message: `⚡ ${message}`
                    });
                }
            );

            setAudioSegments(processedSegments);

            // Auto-apply speed adjustment SEQUENTIALLY (ONE BY ONE) to avoid memory issues
            setProgress({ stage: 'processing', progress: 90, message: 'Ajustando velocidades...' });

            const segmentsToAdjust = processedSegments.filter(seg => seg.needsStretch);

            for (let i = 0; i < segmentsToAdjust.length; i++) {
                const seg = segmentsToAdjust[i];

                setProgress({
                    stage: 'processing',
                    progress: 90 + ((i / segmentsToAdjust.length) * 5),
                    message: `Ajustando ${i + 1}/${segmentsToAdjust.length}...`
                });

                // Reload FFmpeg every 10 segments to clear accumulated memory
                if (i > 0 && i % 10 === 0) {
                    console.log(`Reloading FFmpeg after ${i} adjustments to clear memory...`);
                    await loadFFmpeg();
                    // Give it a moment to stabilize
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                try {
                    const speedFactor = seg.duration / seg.targetDuration;
                    const adjustedBlob = await adjustAudioSpeed(seg.audioBlob, speedFactor);

                    seg.audioBlob = adjustedBlob;
                    seg.duration = seg.targetDuration;
                    seg.appliedSpeedFactor = speedFactor;
                    seg.needsStretch = false;
                } catch (error) {
                    console.warn(`Não foi possível ajustar velocidade do segmento ${i + 1}:`, error);
                    // Keep segment as-is with needsStretch = true for manual adjustment
                }

                // Small delay between each adjustment to help with memory stability
                if (i < segmentsToAdjust.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // --- 5. ASSEMBLE ---
            setProgress({ stage: 'processing', progress: 95, message: 'Montando áudio final...' });

            const videoDuration = await new Promise<number>((resolve) => {
                const video = document.createElement('video');
                video.onloadedmetadata = () => resolve(video.duration);
                video.src = URL.createObjectURL(sourceFile);
            });

            const finalBlob = await assembleDubbingOnly(
                processedSegments.map(s => ({
                    blob: s.audioBlob,
                    start: s.startTime
                })),
                videoDuration
            );

            setFinalAudioBlob(finalBlob);

            // Save project
            const projectId = await createProject({
                name: projectName,
                userId: user.uid,
                sourceFileName: sourceFile.name,
                transcriptSegments: transcript,
                translatedSegments: translated
            });

            setCurrentProject({
                id: projectId,
                name: projectName,
                userId: user.uid,
                sourceFileName: sourceFile.name,
                transcriptSegments: transcript,
                translatedSegments: translated,
                duration: videoDuration,
                selectedVoice: selectedVoice,
                createdAt: new Date() as any,
                updatedAt: new Date() as any
            });

            // Upload source file to storage
            await uploadFile(sourceFile, `projects/${projectId}/source`);

            // --- DONE ---
            setProgress(null);
            setStage('editor');
            setCurrentView('editor');

        } catch (error: any) {
            console.error('Erro no processamento:', error);
            alert(`Erro: ${error.message}`);
            setStage('setup');
            setCurrentView('long-dubbing');
            setProgress(null);
        }
    };

    // Handler for Douyin Dub Slow
    const handleProcessDouyinProject = async (skipSlow: boolean) => {
        if (!hasApiKeys || !sourceFile || !user) return;

        try {
            setStage('processing');
            setCurrentView('processing');
            setProgress({ stage: 'processing', progress: 0, message: 'Iniciando modo Douyin...' });

            await loadFFmpeg();

            // 1. Video Processing (Slow Motion)
            let processedVideoBlob: Blob | File = sourceFile;

            if (!skipSlow) {
                setProgress({ stage: 'processing', progress: 5, message: 'Aplicando Slow Motion (0.8x)...' });
                try {
                    processedVideoBlob = await adjustVideoSpeed(
                        sourceFile,
                        0.8,
                        (msg: string) => setProgress({ stage: 'processing', progress: 10, message: msg })
                    );
                } catch (e: any) {
                    console.error("Slow motion failed:", e);
                    alert(`Falha ao aplicar slow motion: ${e.message || String(e)}. Tente um vídeo menor ou verifique se o vídeo tem áudio.`);
                }
            } else {
                setProgress({ stage: 'processing', progress: 10, message: 'Pulando Slow Motion (vídeo já processado)...' });
            }

            // 2. Extract Audio
            setProgress({ stage: 'processing', progress: 15, message: 'Extraindo áudio...' });
            const audioBlob = await extractAudio(processedVideoBlob as File); // OK if Blob is passed as File often

            // 3. Transcription
            setProgress({ stage: 'processing', progress: 20, message: 'Transcrevendo...' });
            let transcript;
            if (transcriptionProvider === 'whisper') {
                transcript = await transcribeWithWhisper(
                    apiKeys.openai,
                    audioBlob,
                    (msg: string) => setProgress({ stage: 'processing', progress: 25, message: msg })
                );
            } else {
                transcript = await transcribeAudio(
                    apiKeys.gemini,
                    audioBlob,
                    (msg: string) => setProgress({ stage: 'processing', progress: 25, message: msg })
                );
            }
            setTranscriptSegments(transcript);

            // 4. Translation
            setProgress({ stage: 'processing', progress: 40, message: 'Traduzindo...' });
            let translated;
            if (translationProvider === 'openai') {
                translated = await translateWithOpenAI(
                    apiKeys.openai,
                    transcript
                );
            } else {
                translated = await translateIsochronic(
                    apiKeys.gemini,
                    transcript
                );
            }
            setTranslatedSegments(translated);

            // 5. Cliffhanger / Split Logic
            setProgress({ stage: 'processing', progress: 50, message: 'Criando ganchos e dividindo partes...' });

            const totalDuration = await new Promise<number>((resolve) => {
                const video = document.createElement('video');
                video.onloadedmetadata = () => resolve(video.duration);
                video.src = URL.createObjectURL(processedVideoBlob);
            });

            const parts = await processDouyinSplits(translated, totalDuration, apiKeys);
            console.log("Douyin Parts Created:", parts);

            // 6. TTS Generation (All segments in all parts)
            // We need to flatten segments to generate audio for unique ones, then map back?
            // Actually, cliffs modified checks in parts.
            // Let's generate for ALL segments found in parts.
            // Note: Some segments in Part 2 might be same as Transcript, but Part 1 might have modified text.

            setProgress({ stage: 'processing', progress: 60, message: 'Gerando dublagem para todas as partes...' });

            // Collect all unique segments to process
            const allSegmentsToProcess: any[] = [];
            parts.forEach(p => allSegmentsToProcess.push(...p.segments));

            // Use Batch TTS
            const processedSegments = await generateSpeechBatch(
                allSegmentsToProcess,
                selectedVoice,
                { batchSize: 5, delayBetweenBatches: 200 },
                (current, total, message) => {
                    setProgress({
                        stage: 'processing',
                        progress: 60 + (current / total) * 30,
                        message: `TTS das Partes: ${message}`
                    });
                }
            );

            setAudioSegments(processedSegments);

            // 7. Save Project
            setProgress({ stage: 'processing', progress: 95, message: 'Salvando projeto Douyin...' });

            const projectId = await createProject({
                name: projectName,
                userId: user.uid,
                sourceFileName: sourceFile.name,
                transcriptSegments: transcript,
                translatedSegments: translated, // Base translation
                parts: parts // Save the split parts structure!
            });

            setCurrentProject({
                id: projectId,
                name: projectName,
                userId: user.uid,
                sourceFileName: sourceFile.name,
                transcriptSegments: transcript,
                translatedSegments: translated,
                parts: parts,
                duration: totalDuration,
                selectedVoice: selectedVoice,
                createdAt: new Date() as any,
                updatedAt: new Date() as any
            });

            // Upload processed slow video if we made one?
            // For now, assume local serving or upload original.
            //Ideally upload processedVideoBlob. 
            // await uploadFile(processedVideoBlob as File, `projects/${projectId}/source`);

            setProgress(null);
            setStage('editor');
            setCurrentView('editor');

        } catch (error: any) {
            console.error('Douyin Process Error:', error);
            alert(`Erro: ${error.message}`);
            setStage('setup');
            setCurrentView('douyin-dubbing');
            setProgress(null);
        }
    };

    const handleNewProject = () => {
        setShowProjectList(false);
        setCurrentProject(null);
        setCurrentView('home');
    };

    const handleBackToProjects = () => {
        setShowProjectList(true);
    };

    const handleLoadProject = async (project: Project) => {
        setCurrentProject(project);
        setProjectName(project.name);
        setTranscriptSegments(project.transcriptSegments || []);
        setTranslatedSegments(project.translatedSegments || []);

        // TODO: Load source file from Storage URL
        // For now just go to editor mode
        setShowProjectList(false);
        setStage('editor');
        setCurrentView('editor');
    };

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Not logged in
    if (!user) {
        return <LoginScreen />;
    }

    // Show project list
    if (showProjectList) {
        return <ProjectList onNewProject={handleNewProject} onLoadProject={handleLoadProject} />;
    }

    // Main app flow
    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="fixed top-4 right-4 z-50 p-3 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-lg"
                aria-label="Toggle theme"
            >
                {theme === 'dark' ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-700" />}
            </button>

            {/* Content based on currentView */}
            {currentView === 'home' && <HomePage onBackToProjects={handleBackToProjects} />}
            {currentView === 'settings' && <SettingsView onBackToProjects={handleBackToProjects} />}
            {currentView === 'dubbing' && (
                <SimpleDubbingView
                    onStart={handleProcessProject}
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                    onBackToProjects={handleBackToProjects}
                />
            )}
            {currentView === 'long-dubbing' && (
                <LongDubbingView
                    onStart={handleProcessLongProject}
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                    onBackToProjects={handleBackToProjects}
                />
            )}
            {currentView === 'douyin-dubbing' && (
                <DouyinDubbingView
                    onStart={handleProcessDouyinProject}
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                    onBackToProjects={handleBackToProjects}
                />
            )}
            {currentView === 'srt-dubbing' && (
                <SrtDubbingView onBack={() => setCurrentView('home')} />
            )}
            {(currentView === 'processing' || stage === 'processing') && <ProcessingView />}
            {(currentView === 'editor' || stage === 'editor') && <EditorView />}
        </div>
    );
}
