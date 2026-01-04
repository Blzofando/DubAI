import { Timestamp } from 'firebase/firestore';
import type { TranscriptSegment, TranslatedSegment, AudioSegment } from './index';

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
    duration?: number;
    selectedVoice?: string;
}
