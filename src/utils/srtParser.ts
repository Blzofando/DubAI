export interface SrtSegment {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
}

/**
 * Parses SRT content into an array of segments
 */
export function parseSrt(content: string): SrtSegment[] {
    const segments: SrtSegment[] = [];
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalizedContent.split('\n\n');

    for (const block of blocks) {
        if (!block.trim()) continue;

        const lines = block.split('\n');
        if (lines.length < 3) continue;

        // Try to find the numeric ID
        let idLineIndex = 0;
        // Some loose SRTs might have extra newlines or weird formats, but standard is:
        // 1
        // 00:00:01,000 --> 00:00:04,000
        // Text

        // Skip potential empty lines at start
        while (idLineIndex < lines.length && !lines[idLineIndex].trim()) {
            idLineIndex++;
        }
        if (idLineIndex >= lines.length) continue;

        const id = lines[idLineIndex].trim();
        const timeLine = lines[idLineIndex + 1]?.trim();

        if (!timeLine || !timeLine.includes('-->')) continue;

        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
        const startTime = parseSrtTime(startStr);
        const endTime = parseSrtTime(endStr);

        const text = lines.slice(idLineIndex + 2).join(' ').trim();

        if (!isNaN(startTime) && !isNaN(endTime)) {
            segments.push({
                id,
                startTime,
                endTime,
                text
            });
        }
    }

    return segments;
}

function parseSrtTime(timeStr: string): number {
    // Format: 00:00:00,000 or 00:00:00.000
    const [hms, ms] = timeStr.split(/[,.]/);
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + parseInt(ms || '0', 10) / 1000;
}
