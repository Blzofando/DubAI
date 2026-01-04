import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from 'node-edge-tts';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export async function POST(req: NextRequest) {
    try {
        const { text, voice } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const safeText = text
            .replace(/[\r\n\t]+/g, ' ')
            // eslint-disable-next-line no-control-regex
            .replace(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F\.,!\?;:()\- ]/g, '')
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        const voiceArg = voice || 'pt-BR-AntonioNeural';

        const tts = new EdgeTTS({
            voice: voiceArg,
            lang: voiceArg.split('-').slice(0, 2).join('-'),
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
        });

        // ttsPromise requires file path as second argument
        const tempFile = join(tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);

        await tts.ttsPromise(safeText, tempFile);
        const audioBuffer = await readFile(tempFile);

        // Cleanup
        await unlink(tempFile).catch(() => { }); // Ignore cleanup errors

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
            },
        });
    } catch (error: any) {
        console.error('TTS Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
