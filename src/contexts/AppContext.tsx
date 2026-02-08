'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type {
    ApiKeys,
    ProcessingStage,
    CurrentView,
    TranscriptSegment,
    TranslatedSegment,
    AudioSegment,
    TranscriptionProvider,
    TranslationProvider,
    ProgressUpdate
} from '@/types';
import type { Project } from '@/types/project';

interface AppContextType {
    // API Keys
    apiKeys: ApiKeys;
    saveApiKeys: (keys: ApiKeys) => void;
    hasApiKeys: boolean;

    // Providers
    transcriptionProvider: TranscriptionProvider;
    setTranscriptionProvider: (provider: TranscriptionProvider) => void;
    translationProvider: TranslationProvider;
    setTranslationProvider: (provider: TranslationProvider) => void;

    // Processing state
    stage: ProcessingStage;
    setStage: (stage: ProcessingStage) => void;
    progress: ProgressUpdate | null;
    setProgress: (progress: ProgressUpdate | null) => void;

    // Data
    sourceFile: File | null;
    setSourceFile: (file: File | null) => void;
    sourceLanguage: string;
    setSourceLanguage: (lang: string) => void;
    transcriptSegments: TranscriptSegment[];
    setTranscriptSegments: (segments: TranscriptSegment[]) => void;
    translatedSegments: TranslatedSegment[];
    setTranslatedSegments: (segments: TranslatedSegment[]) => void;
    audioSegments: AudioSegment[];
    setAudioSegments: (segments: AudioSegment[]) => void;
    finalAudioBlob: Blob | null;
    setFinalAudioBlob: (blob: Blob | null) => void;

    // Voice selection
    selectedVoice: string;
    setSelectedVoice: (voice: string) => void;

    // Theme
    theme: 'light' | 'dark';
    toggleTheme: () => void;

    // Current View
    currentView: CurrentView;
    setCurrentView: (view: CurrentView) => void;

    // Speed Adjustment Queue
    speedAdjustmentQueue: string[];
    addToSpeedQueue: (id: string) => void;
    removeFromSpeedQueue: (id: string) => void;
    clearSpeedQueue: () => void;
    processSpeedQueue: (onProgress?: (current: number, total: number, msg: string) => void) => Promise<void>;

    // Reset
    resetAll: () => void;
    updateAudioSegmentTiming: (id: string, newStartTime: number) => void;
    updateAudioSegmentBlob: (id: string, newBlob: Blob, newDuration: number) => void;
    applySpeedAdjustment: (id: string, onProgress?: (msg: string) => void) => Promise<void>;

    // Current Project
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
    GEMINI_KEY: 'dubai_gemini_key',
    OPENAI_KEY: 'dubai_openai_key',
    SELECTED_VOICE: 'dubai_selected_voice',
    THEME: 'dubai_theme',
    TRANSCRIPTION_PROVIDER: 'dubai_transcription_provider',
    TRANSLATION_PROVIDER: 'dubai_translation_provider',
};

export function AppProvider({ children }: { children: ReactNode }) {
    // API Keys com carregamento do localStorage
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ gemini: '', openai: '' });
    const [hasApiKeys, setHasApiKeys] = useState(false);

    // Processing state
    const [stage, setStage] = useState<ProcessingStage>('setup');
    const [progress, setProgress] = useState<ProgressUpdate | null>(null);

    // Theme state
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    // Current view state
    const [currentView, setCurrentView] = useState<CurrentView>('home');

    // Data
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourceLanguage, setSourceLanguage] = useState<string>('');
    const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
    const [translatedSegments, setTranslatedSegments] = useState<TranslatedSegment[]>([]);
    const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
    const [finalAudioBlob, setFinalAudioBlob] = useState<Blob | null>(null);

    // Voice selection
    const [selectedVoice, setSelectedVoice] = useState<string>('pt-BR-AntonioNeural');

    // Provider state
    const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>('whisper');
    const [translationProvider, setTranslationProvider] = useState<TranslationProvider>('gemini');

    // Speed Adjustment Queue
    const [speedAdjustmentQueue, setSpeedAdjustmentQueue] = useState<string[]>([]);

    // Current Project
    const [currentProject, setCurrentProject] = useState<Project | null>(null);

    // Carregar dados e tema do localStorage ao montar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const geminiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || '';
            const openaiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || '';
            const voice = localStorage.getItem(STORAGE_KEYS.SELECTED_VOICE) || 'pt-BR-AntonioNeural';
            const savedTranscription = localStorage.getItem(STORAGE_KEYS.TRANSCRIPTION_PROVIDER) as TranscriptionProvider;
            const savedTranslation = localStorage.getItem(STORAGE_KEYS.TRANSLATION_PROVIDER) as TranslationProvider;

            // Carregar tema (ou preferência do sistema)
            const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark' | null;
            if (savedTheme) {
                setTheme(savedTheme);
            } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setTheme('dark');
            }

            if (geminiKey || openaiKey) {
                setApiKeys({ gemini: geminiKey, openai: openaiKey });
                setHasApiKeys(geminiKey.length > 0 && openaiKey.length > 0);
            }

            setSelectedVoice(voice);
            if (savedTranscription) setTranscriptionProvider(savedTranscription);
            if (savedTranslation) setTranslationProvider(savedTranslation);
        }
    }, []);

    // Atualizar classe 'dark' no html e salvar tema
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const root = window.document.documentElement;
            if (theme === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
            localStorage.setItem(STORAGE_KEYS.THEME, theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // Salvar API keys no localStorage e state
    const saveApiKeys = (keys: ApiKeys) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, keys.gemini);
            localStorage.setItem(STORAGE_KEYS.OPENAI_KEY, keys.openai);
            setApiKeys(keys);
            setHasApiKeys(keys.gemini.length > 0 && keys.openai.length > 0);
        }
    };

    // Salvar voz selecionada
    useEffect(() => {
        if (typeof window !== 'undefined' && selectedVoice) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, selectedVoice);
        }
    }, [selectedVoice]);

    // Salvar provedores
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.TRANSCRIPTION_PROVIDER, transcriptionProvider);
            localStorage.setItem(STORAGE_KEYS.TRANSLATION_PROVIDER, translationProvider);
        }
    }, [transcriptionProvider, translationProvider]);

    // Reset tudo
    const resetAll = () => {
        setStage('setup');
        setProgress(null);
        setSourceFile(null);
        setSourceLanguage('');
        setTranscriptSegments([]);
        setTranslatedSegments([]);
        setAudioSegments([]);
        setAudioSegments([]);
        setFinalAudioBlob(null);
        setCurrentProject(null);
    };

    const updateAudioSegmentTiming = (id: string, newStartTime: number) => {
        setAudioSegments(prev => prev.map(seg =>
            seg.id === id ? { ...seg, startTime: newStartTime } : seg
        ));
    };

    const updateAudioSegmentBlob = (id: string, newBlob: Blob, newDuration: number) => {
        setAudioSegments(prev => prev.map(seg =>
            seg.id === id ? { ...seg, audioBlob: newBlob, duration: newDuration, needsStretch: false } : seg
        ));
    };

    const applySpeedAdjustment = async (id: string, onProgress?: (msg: string) => void) => {
        try {
            // Find segment in audioSegments
            const segment = audioSegments.find(seg => seg.id === id);
            if (!segment) {
                throw new Error('Segment not found');
            }

            // Find corresponding translated segment for target duration
            const translatedSeg = translatedSegments.find(seg => seg.id === id);
            if (!translatedSeg) {
                throw new Error('Translated segment not found');
            }

            const targetDuration = translatedSeg.end - translatedSeg.start;
            const currentDuration = segment.duration;
            const speedFactor = currentDuration / targetDuration;

            onProgress?.(`Ajustando velocidade (${speedFactor.toFixed(2)}x)...`);

            // Import FFmpeg function dynamically
            const { adjustAudioSpeed, loadFFmpeg, getAudioDuration } = await import('@/services/ffmpeg');

            // Ensure FFmpeg is loaded
            await loadFFmpeg();

            // Apply tempo adjustment
            const adjustedBlob = await adjustAudioSpeed(segment.audioBlob, speedFactor, onProgress);

            // Get the ACTUAL duration of the adjusted audio to ensure accuracy
            const actualDuration = await getAudioDuration(adjustedBlob);

            // Update the segment with new blob, actual duration, and applied speed factor
            setAudioSegments(prev => prev.map(seg =>
                seg.id === id ? {
                    ...seg,
                    audioBlob: adjustedBlob,
                    duration: actualDuration,
                    targetDuration: targetDuration,
                    needsStretch: false,
                    appliedSpeedFactor: speedFactor
                } : seg
            ));

            onProgress?.('✅ Velocidade ajustada com sucesso!');
        } catch (error: any) {
            console.error('Error applying speed adjustment:', error);
            throw new Error(`Falha ao ajustar velocidade: ${error.message}`);
        }
    };

    // Speed Queue Management
    const addToSpeedQueue = (id: string) => {
        setSpeedAdjustmentQueue(prev => {
            if (!prev.includes(id)) {
                return [...prev, id];
            }
            return prev;
        });
    };

    const removeFromSpeedQueue = (id: string) => {
        setSpeedAdjustmentQueue(prev => prev.filter(qid => qid !== id));
    };

    const clearSpeedQueue = () => {
        setSpeedAdjustmentQueue([]);
    };

    const processSpeedQueue = async (onProgress?: (current: number, total: number, msg: string) => void) => {
        const queue = [...speedAdjustmentQueue];
        const total = queue.length;

        for (let i = 0; i < queue.length; i++) {
            const id = queue[i];
            try {
                onProgress?.(i + 1, total, `Ajustando segmento ${i + 1}/${total}...`);
                await applySpeedAdjustment(id);
                removeFromSpeedQueue(id);
            } catch (error) {
                console.error(`Failed to adjust speed for segment ${id}:`, error);
                // Continue with next segment
            }
        }

        clearSpeedQueue();
        onProgress?.(total, total, '✅ Todos os ajustes concluídos!');
    };

    const value: AppContextType = {
        apiKeys,
        saveApiKeys,
        hasApiKeys,
        transcriptionProvider,
        setTranscriptionProvider,
        translationProvider,
        setTranslationProvider,
        stage,
        setStage,
        progress,
        setProgress,
        sourceFile,
        setSourceFile,
        sourceLanguage,
        setSourceLanguage,
        transcriptSegments,
        setTranscriptSegments,
        translatedSegments,
        setTranslatedSegments,
        audioSegments,
        setAudioSegments,
        finalAudioBlob,
        setFinalAudioBlob,
        selectedVoice,
        setSelectedVoice,
        theme,
        toggleTheme,
        currentView,
        setCurrentView,
        speedAdjustmentQueue,
        addToSpeedQueue,
        removeFromSpeedQueue,
        clearSpeedQueue,
        processSpeedQueue,
        resetAll,
        updateAudioSegmentTiming,
        updateAudioSegmentBlob,
        applySpeedAdjustment,
        currentProject,
        setCurrentProject
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
}
