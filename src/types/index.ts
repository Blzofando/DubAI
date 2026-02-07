// Segmento de transcrição do Gemini
export interface TranscriptSegment {
    id: string;
    start: number; // segundos
    end: number; // segundos
    text: string;
    language?: string;
    speaker?: string;
}

// Segmento traduzido com metadata de timing
export interface TranslatedSegment extends TranscriptSegment {
    translatedText: string;
    targetCharCount: number; // caracteres esperados baseado em duração
    actualCharCount: number; // caracteres reais da tradução
    wasManuallyResized?: boolean; // true se usuário redimensionou manualmente
}

// Segmento de áudio gerado
export interface AudioSegment {
    id: string;
    audioBlob: Blob;
    duration: number;
    targetDuration: number; // duração esperada do slot
    startTime: number; // segundos
    needsStretch: boolean; // se precisa de time-stretch
    appliedSpeedFactor?: number; // fator de velocidade aplicado pelo FFmpeg
}

// Parte de uma dublagem dividida (Douyin Slow)
export interface DubbingPart {
    index: number; // 1, 2, 3...
    start: number; // Tempo de vídeo onde essa parte começa
    end: number; // Tempo de vídeo onde essa parte termina
    segments: TranslatedSegment[];
}

// Estágios do pipeline
export type ProcessingStage =
    | 'setup'
    | 'processing'
    | 'editor';

// Current view state
export type CurrentView =
    | 'home'
    | 'settings'
    | 'dubbing'
    | 'long-dubbing'
    | 'douyin-dubbing'
    | 'srt-dubbing'
    | 'advanced-dubbing'
    | 'processing'
    | 'editor';

// Opções de voz OpenAI
export interface VoiceOption {
    id: string;
    name: string;
    description: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
    { id: 'pt-BR-AntonioNeural', name: 'Antônio', description: 'Voz masculina natural (pt-BR)' },
    { id: 'pt-BR-FranciscaNeural', name: 'Francisca', description: 'Voz feminina natural (pt-BR)' },
    { id: 'pt-BR-ThalitaNeural', name: 'Thalita', description: 'Voz feminina jovem (pt-BR)' },
    { id: 'en-US-AndrewNeural', name: 'Andrew', description: 'Voz masculina internacional (en-US)' },
    { id: 'en-US-AvaNeural', name: 'Ava', description: 'Voz feminina internacional (en-US)' },
];

// Estrutura de API Keys
export interface ApiKeys {
    gemini: string;
    openai: string;
}

// Progress update
export interface ProgressUpdate {
    stage: ProcessingStage;
    progress: number; // 0-100
    message: string;
}

// Configurable Providers
export type TranscriptionProvider = 'whisper' | 'gemini';
export type TranslationProvider = 'gemini' | 'openai';

