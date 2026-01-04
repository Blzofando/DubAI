import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts';

export async function POST(req: NextRequest) {
    try {
        const { text, voice } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // Aggressive sanitization to prevent potential issues
        // 1. Remove newlines/tabs
        // 2. Remove emojis and uncommon symbols
        const safeText = text
            .replace(/[\r\n\t]+/g, ' ')
            // eslint-disable-next-line no-control-regex
            .replace(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F\.,!\?;:()\- ]/g, '')
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        const voiceArg = voice || 'pt-BR-AntonioNeural';

        // Using native Node.js implementation instead of Python CLI
        const tts = new EdgeTTS({
            voice: voiceArg,
            lang: voiceArg.split('-').slice(0, 2).join('-'), // "pt-BR"
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
        });

        // Convert base64 result to buffer/blob
        const base64Audio = await tts.ttsPromise(safeText);
        const audioBuffer = Buffer.from(base64Audio, 'base64');

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
