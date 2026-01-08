import { NextRequest, NextResponse } from 'next/server';
import { Communicate } from 'edge-tts-universal';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    let safeText = '';
    let voiceArg = '';

    try {
        const { text, voice } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        safeText = text
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/['"]/g, '"')
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        voiceArg = voice || 'pt-BR-AntonioNeural';

        console.log('[TTS] Generating with edge-tts-universal:', { voice: voiceArg, textLength: safeText.length });

        // Create Communicate instance
        const communicate = new Communicate(safeText, {
            voice: voiceArg,
        });

        // Stream audio chunks
        const audioChunks: Buffer[] = [];

        for await (const chunk of communicate.stream()) {
            if (chunk.type === 'audio' && chunk.data) {
                audioChunks.push(chunk.data);
            }
        }

        if (audioChunks.length === 0) {
            throw new Error('No audio data received from TTS service');
        }

        // Concatenate all chunks
        const audioBuffer = Buffer.concat(audioChunks);
        const uint8Array = new Uint8Array(audioBuffer);

        console.log('[TTS] Successfully generated audio:', { bytes: uint8Array.length });

        return new NextResponse(uint8Array, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': uint8Array.length.toString(),
            },
        });

    } catch (error: any) {
        console.error('[TTS] Error Details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            text: safeText?.substring(0, 100),
            voice: voiceArg
        });

        const errorMessage = error.message || 'Erro ao gerar áudio';
        return NextResponse.json({
            error: `Falha no TTS: ${errorMessage}`
        }, { status: 500 });
    }
}
