'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Sun, Moon } from 'lucide-react';

// Views
import LoginScreen from '@/components/auth/LoginScreen';
import ProjectList from '@/components/projects/ProjectList';
import SetupView from '@/components/setup/SetupView';
import ProcessingView from '@/components/processing/ProcessingView';
import EditorView from '@/components/editor/EditorView';

// Services
import { translateIsochronic, transcribeAudio } from '@/services/gemini';
import { transcribeWithWhisper } from '@/services/whisper';
import { translateWithOpenAI } from '@/services/openaiTranslation';
import { generateSpeech } from '@/services/tts';
import { extractAudio, assembleAudio, loadFFmpeg } from '@/services/ffmpeg';
import { createProject, updateProject, uploadFile } from '@/services/projectService';

import type { Project } from '@/types/project';

export default function HomePage() {
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
    } = useApp();

    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [projectName, setProjectName] = useState('');
    const [showProjectList, setShowProjectList] = useState(true);

    const handleProcessProject = async () => {
        if (!hasApiKeys || !sourceFile || !user) return;

        try {
            setStage('processing');

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
            const processedSegments = [];

            for (let i = 0; i < translated.length; i++) {
                const seg = translated[i];
                setProgress({
                    stage: 'processing',
                    progress: 60 + (i / translated.length) * 30,
                    message: `Gerando TTS ${i + 1}/${translated.length}...`
                });

                const audioBlob = await generateSpeech(
                    seg.translatedText,
                    selectedVoice
                );

                processedSegments.push({
                    id: seg.id,
                    audioBlob,
                    duration: audioBlob.size / 24000,
                    targetDuration: seg.end - seg.start,
                    startTime: seg.start,
                    needsStretch: false
                });
            }

            setAudioSegments(processedSegments);

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
            } catch (err) {
                console.error('Error saving project:', err);
                // Continue even if save fails
            }

            // --- DONE ---
            setProgress(null);
            setStage('editor');

        } catch (error: any) {
            console.error('Erro no processamento:', error);
            alert(`Erro: ${error.message}`);
            setStage('setup');
            setProgress(null);
        }
    };

    const handleNewProject = () => {
        setShowProjectList(false);
        setCurrentProject(null);
        setStage('setup');
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

            {/* Content */}
            {stage === 'setup' && (
                <SetupView
                    onStart={handleProcessProject}
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                />
            )}
            {stage === 'processing' && <ProcessingView />}
            {stage === 'editor' && <EditorView />}
        </div>
    );
}
