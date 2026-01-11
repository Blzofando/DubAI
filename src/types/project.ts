import { Timestamp } from 'firebase/firestore';
import type { TranscriptSegment, TranslatedSegment, AudioSegment, DubbingPart } from './index';

export interface Project {
    id: string;
    name: string;
    userId: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // File info
    sourceFileName: string;
    sourceFileUrl?: string;
    finalAudioUrl?: string;

    // Segments data
    transcriptSegments: TranscriptSegment[];
    translatedSegments: TranslatedSegment[];
    parts?: DubbingPart[]; // Para projetos divididos (Douyin)

    // Metadata
    duration: number;
    selectedVoice: string;
}

export interface CreateProjectData {
    name: string;
    userId: string;
    sourceFileName: string;
    sourceFileUrl?: string;
    transcriptSegments?: TranscriptSegment[];
    translatedSegments?: TranslatedSegment[];
    parts?: DubbingPart[];
    duration?: number;
    selectedVoice?: string;
}
