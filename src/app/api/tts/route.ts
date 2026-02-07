import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const maxDuration = 300;

/**
 * Generates audio using the installed python 'edge-tts' CLI.
 * This is used because the Node.js library is currently blocked/buggy.
 */
async function generateAudioPython(text: string, voice: string): Promise<Buffer> {
    const tempFile = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);

    return new Promise((resolve, reject) => {
        console.log(`[TTS-PY] Spawning python for: "${text.substring(0, 20)}..." (Voice: ${voice})`);

        // Use 'python' as command. In some envs might need 'python3'
        const process = spawn('python', [
            '-m', 'edge_tts',
            '--text', text,
            '--voice', voice,
            '--write-media', tempFile
        ]);

        let stderr = '';

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                console.error('[TTS-PY] Process failed:', stderr);
                // Clean up temp file if it exists
                if (fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile); } catch { }

                reject(new Error(`Python process exited with code ${code}. Error: ${stderr}`));
                return;
            }

            try {
                if (fs.existsSync(tempFile)) {
                    const audioBuffer = fs.readFileSync(tempFile);
                    fs.unlinkSync(tempFile); // Clean up
                    console.log(`[TTS-PY] Success. Size: ${audioBuffer.length} bytes`);
                    resolve(audioBuffer);
                } else {
                    reject(new Error('Output file was not created by edge-tts'));
                }
            } catch (err) {
                reject(err);
            }
        });

        process.on('error', (err) => {
            console.error('[TTS-PY] Spawn error:', err);
            reject(new Error(`Failed to spawn python: ${err.message}`));
        });
    });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'Teste de áudio do DubAI com Python';
    const voice = searchParams.get('voice') || 'pt-BR-AntonioNeural';

    try {
        const audioData = await generateAudioPython(text, voice);
        // Create a fresh ArrayBuffer copy to ensure proper TypeScript compatibility with Next.js 15
        const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength) as ArrayBuffer;

        return new NextResponse(arrayBuffer, {
            headers: { 'Content-Type': 'audio/mpeg' }
        });
    } catch (err: any) {
        console.error('[TTS-GET] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    let safeText = '';
    let voiceArg = '';
    const start = Date.now();

    try {
        const body = await req.json();
        const { text, voice } = body;

        console.log(`[TTS-API] Start request: ${text?.substring(0, 20)}... Voice: ${voice}`);

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

        const audioData = await generateAudioPython(safeText, voiceArg);
        const duration = Date.now() - start;

        console.log(`[TTS-API] Success in ${duration}ms. Size: ${audioData.length} bytes.`);

        // Create a fresh ArrayBuffer copy to ensure proper TypeScript compatibility with Next.js 15
        const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength) as ArrayBuffer;
        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
            },
        });

    } catch (error: any) {
        console.error(`[TTS-API] Error after ${Date.now() - start}ms:`, error);
        return NextResponse.json({
            error: `Falha no TTS (Python): ${error.message}`
        }, { status: 500 });
    }
}
