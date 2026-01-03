// Segmento de transcrição do Gemini
export interface TranscriptSegment {
    id: string;
    start: number; // segundos
    end: number; // segundos
    text: string;
    language?: string;
}

// Segmento traduzido com metadata de timing
export interface TranslatedSegment extends TranscriptSegment {
    translatedText: string;
    targetCharCount: number; // caracteres esperados baseado em duração
    actualCharCount: number; // caracteres reais da tradução
}

// Segmento de áudio gerado
export interface AudioSegment {
    id: string;
    audioBlob: Blob;
    duration: number;
    targetDuration: number; // duração esperada do slot
    needsStretch: boolean; // se precisa de time-stretch
}

// Estágios do pipeline
export type ProcessingStage =
    | 'idle'
    | 'transcription'
    | 'translation'
    | 'dubbing'
    | 'assembly'
    | 'completed';

// Opções de voz OpenAI
export interface VoiceOption {
    id: string;
    name: string;
    description: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
    { id: 'alloy', name: 'Alloy', description: 'Voz neutra e versátil' },
    { id: 'echo', name: 'Echo', description: 'Voz masculina clara' },
    { id: 'fable', name: 'Fable', description: 'Voz narrativa britânica' },
    { id: 'onyx', name: 'Onyx', description: 'Voz masculina profunda' },
    { id: 'nova', name: 'Nova', description: 'Voz feminina natural' },
    { id: 'shimmer', name: 'Shimmer', description: 'Voz feminina suave' },
    { id: 'coral', name: 'Coral', description: 'Voz feminina calorosa' },
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
