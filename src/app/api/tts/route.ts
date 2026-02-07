import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

export const maxDuration = 300;

// Constants from edge-tts
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

// Generate Sec-MS-GEC token (DRM)
function generateSecMsGec(): string {
    let ticks = Date.now() / 1000; // Current Unix timestamp
    ticks += WIN_EPOCH; // Convert to Windows file time epoch
    ticks -= ticks % 300; // Round down to nearest 5 minutes
    ticks *= 1e9 / 100; // Convert to 100-nanosecond intervals

    const strToHash = `${Math.floor(ticks)}${TRUSTED_CLIENT_TOKEN}`;
    return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

// Generate random MUID
function generateMuid(): string {
    return randomBytes(16).toString('hex').toUpperCase();
}

// Generate connection ID
function connectId(): string {
    return randomBytes(16).toString('hex');
}

// Get JavaScript-style date string
function dateToString(): string {
    return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

// Escape XML special characters
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Remove incompatible characters
function removeIncompatibleChars(text: string): string {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

// Create SSML
function mkssml(text: string, voice: string, rate = '+0%', pitch = '+0Hz', volume = '+0%'): string {
    const escapedText = escapeXml(removeIncompatibleChars(text));
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
        `${escapedText}` +
        `</prosody></voice></speak>`;
}

// Generate SSML request headers + data
function ssmlHeadersData(requestId: string, timestamp: string, ssml: string): string {
    return `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
}

// Generate config request
function configRequest(timestamp: string): string {
    return `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
        `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
}

/**
 * Generates audio using Microsoft Edge TTS WebSocket API directly
 */
async function generateAudio(text: string, voice: string): Promise<Buffer> {
    console.log(`[TTS] Generating audio for: "${text.substring(0, 30)}..." (Voice: ${voice})`);

    const connectionId = connectId();
    const secMsGec = generateSecMsGec();
    const muid = generateMuid();

    const wsUrl = `${WSS_URL}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const headers = {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': `muid=${muid};`,
    };

    return new Promise((resolve, reject) => {
        const audioChunks: Buffer[] = [];

        // Dynamic import of ws for serverless compatibility
        import('ws').then(({ default: WebSocket }) => {
            const ws = new WebSocket(wsUrl, { headers });

            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket timeout'));
            }, 30000);

            ws.on('open', () => {
                console.log('[TTS] WebSocket connected');
                // Send config request
                ws.send(configRequest(dateToString()));

                // Send SSML request
                const ssml = mkssml(text, voice);
                ws.send(ssmlHeadersData(connectId(), dateToString(), ssml));
            });

            ws.on('message', (data: Buffer | string) => {
                if (typeof data === 'string') {
                    // Text message - check for turn.end
                    if (data.includes('Path:turn.end')) {
                        clearTimeout(timeout);
                        ws.close();
                        if (audioChunks.length === 0) {
                            reject(new Error('No audio data received'));
                        } else {
                            const result = Buffer.concat(audioChunks);
                            console.log(`[TTS] Success. Total size: ${result.length} bytes`);
                            resolve(result);
                        }
                    }
                } else {
                    // Binary message - extract audio data
                    const buffer = Buffer.from(data);
                    if (buffer.length > 2) {
                        const headerLength = buffer.readUInt16BE(0);
                        if (buffer.length > headerLength + 2) {
                            const audioData = buffer.subarray(headerLength + 2);
                            if (audioData.length > 0) {
                                audioChunks.push(audioData);
                            }
                        }
                    }
                }
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                console.error('[TTS] WebSocket error:', err);
                reject(new Error(`WebSocket error: ${err.message}`));
            });

            ws.on('close', () => {
                clearTimeout(timeout);
            });
        }).catch((err) => {
            reject(new Error(`Failed to load WebSocket: ${err.message}`));
        });
    });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'Teste de áudio do DubAI';
    const voice = searchParams.get('voice') || 'pt-BR-AntonioNeural';

    try {
        const audioData = await generateAudio(text, voice);
        const arrayBuffer = audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength
        ) as ArrayBuffer;

        return new NextResponse(arrayBuffer, {
            headers: { 'Content-Type': 'audio/mpeg' }
        });
    } catch (err: any) {
        console.error('[TTS-GET] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const start = Date.now();

    try {
        const body = await req.json();
        const { text, voice } = body;

        console.log(`[TTS-API] Start request: ${text?.substring(0, 20)}... Voice: ${voice}`);

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const safeText = text
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/['"]/g, '"')
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        const voiceArg = voice || 'pt-BR-AntonioNeural';

        const audioData = await generateAudio(safeText, voiceArg);
        const duration = Date.now() - start;

        console.log(`[TTS-API] Success in ${duration}ms. Size: ${audioData.length} bytes.`);

        const arrayBuffer = audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength
        ) as ArrayBuffer;

        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
            },
        });

    } catch (error: any) {
        console.error(`[TTS-API] Error after ${Date.now() - start}ms:`, error);
        return NextResponse.json({
            error: `Falha no TTS: ${error.message}`
        }, { status: 500 });
    }
}
