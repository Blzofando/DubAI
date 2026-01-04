import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from 'node-edge-tts';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Aumentar timeout para 60 segundos (limite do plano Hobby da Vercel)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    let safeText = '';
    let voiceArg = '';

    try {
        const { text, voice } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // Less aggressive sanitization - preserve more characters for better TTS
        // Only remove control characters and problematic symbols
        safeText = text
            .replace(/[\r\n\t]+/g, ' ') // Remove newlines/tabs
            .replace(/['"]/g, '"')      // Normalize quotes
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        voiceArg = voice || 'pt-BR-AntonioNeural';

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
        console.error('TTS Error Details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            text: safeText?.substring(0, 100), // Log primeiro 100 chars do texto
            voice: voiceArg
        });

        // Retornar mensagem mais específica
        const errorMessage = error.message || 'Erro ao gerar áudio';
        return NextResponse.json({
            error: `Falha no TTS: ${errorMessage}`
        }, { status: 500 });
    }
}
