'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type {
    ApiKeys,
    ProcessingStage,
    TranscriptSegment,
    TranslatedSegment,
    AudioSegment,
    ProgressUpdate
} from '@/types';

interface AppContextType {
    // API Keys
    apiKeys: ApiKeys;
    saveApiKeys: (keys: ApiKeys) => void;
    hasApiKeys: boolean;

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

    // Reset
    resetAll: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
    GEMINI_KEY: 'dubai_gemini_key',
    OPENAI_KEY: 'dubai_openai_key',
    SELECTED_VOICE: 'dubai_selected_voice',
    THEME: 'dubai_theme',
};

export function AppProvider({ children }: { children: ReactNode }) {
    // API Keys com carregamento do localStorage
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ gemini: '', openai: '' });
    const [hasApiKeys, setHasApiKeys] = useState(false);

    // Processing state
    const [stage, setStage] = useState<ProcessingStage>('idle');
    const [progress, setProgress] = useState<ProgressUpdate | null>(null);

    // Theme state
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    // Data
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourceLanguage, setSourceLanguage] = useState<string>('');
    const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
    const [translatedSegments, setTranslatedSegments] = useState<TranslatedSegment[]>([]);
    const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
    const [finalAudioBlob, setFinalAudioBlob] = useState<Blob | null>(null);

    // Voice selection
    const [selectedVoice, setSelectedVoice] = useState<string>('nova');

    // Carregar dados e tema do localStorage ao montar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const geminiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || '';
            const openaiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || '';
            const voice = localStorage.getItem(STORAGE_KEYS.SELECTED_VOICE) || 'nova';

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

    // Reset tudo
    const resetAll = () => {
        setStage('idle');
        setProgress(null);
        setSourceFile(null);
        setSourceLanguage('');
        setTranscriptSegments([]);
        setTranslatedSegments([]);
        setAudioSegments([]);
        setFinalAudioBlob(null);
    };

    const value: AppContextType = {
        apiKeys,
        saveApiKeys,
        hasApiKeys,
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
        resetAll,
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
