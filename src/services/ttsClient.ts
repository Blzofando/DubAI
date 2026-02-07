/**
 * Client-side Edge TTS using WebSocket directly from the browser.
 * This avoids the 403 error from Vercel's datacenter IPs.
 */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

/**
 * Generate Sec-MS-GEC token using Web Crypto API
 */
async function generateSecMsGec(): Promise<string> {
    let ticks = Date.now() / 1000;
    ticks += WIN_EPOCH;
    ticks -= ticks % 300;
    ticks *= 1e9 / 100;

    const strToHash = `${Math.floor(ticks)}${TRUSTED_CLIENT_TOKEN}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(strToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Generate random hex string
 */
function randomHex(bytes: number): string {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get JavaScript-style date string
 */
function dateToString(): string {
    return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Remove incompatible characters
 */
function removeIncompatibleChars(text: string): string {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

/**
 * Create SSML markup
 */
function mkssml(text: string, voice: string, rate = '+0%', pitch = '+0Hz', volume = '+0%'): string {
    const escapedText = escapeXml(removeIncompatibleChars(text));
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
        `${escapedText}` +
        `</prosody></voice></speak>`;
}

/**
 * Generate SSML request
 */
function ssmlRequest(requestId: string, timestamp: string, ssml: string): string {
    return `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
}

/**
 * Generate config request
 */
function configRequest(timestamp: string): string {
    return `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
        `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
}

/**
 * Generate speech using Edge TTS WebSocket from the browser
 */
export async function generateSpeechClient(
    text: string,
    voice: string = 'pt-BR-AntonioNeural'
): Promise<Blob> {
    console.log(`[TTS-Client] Generating: "${text.substring(0, 30)}..." (Voice: ${voice})`);

    const connectionId = randomHex(16);
    const secMsGec = await generateSecMsGec();

    // Note: Browser WebSocket doesn't support custom headers, but Edge TTS works without them
    // The important params are in the URL query string
    const wsUrl = `${WSS_URL}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    return new Promise((resolve, reject) => {
        const audioChunks: Uint8Array[] = [];
        const ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket timeout (30s)'));
        }, 30000);

        ws.onopen = () => {
            console.log('[TTS-Client] WebSocket connected');
            // Send config
            ws.send(configRequest(dateToString()));
            // Send SSML request
            const ssml = mkssml(text, voice);
            ws.send(ssmlRequest(randomHex(16), dateToString(), ssml));
        };

        ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                // Text message - check for turn.end
                if (event.data.includes('Path:turn.end')) {
                    clearTimeout(timeout);
                    ws.close();
                    if (audioChunks.length === 0) {
                        reject(new Error('No audio data received'));
                    } else {
                        // Combine all chunks into a single blob
                        const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
                        const combined = new Uint8Array(totalLength);
                        let offset = 0;
                        for (const chunk of audioChunks) {
                            combined.set(chunk, offset);
                            offset += chunk.length;
                        }
                        const blob = new Blob([combined], { type: 'audio/mpeg' });
                        console.log(`[TTS-Client] Success. Size: ${blob.size} bytes`);
                        resolve(blob);
                    }
                }
            } else if (event.data instanceof Blob) {
                // Binary message - extract audio data
                const buffer = await event.data.arrayBuffer();
                const data = new Uint8Array(buffer);
                if (data.length > 2) {
                    const headerLength = (data[0] << 8) | data[1];
                    if (data.length > headerLength + 2) {
                        const audioData = data.subarray(headerLength + 2);
                        if (audioData.length > 0) {
                            audioChunks.push(audioData);
                        }
                    }
                }
            }
        };

        ws.onerror = (event) => {
            clearTimeout(timeout);
            console.error('[TTS-Client] WebSocket error:', event);
            reject(new Error('WebSocket connection error'));
        };

        ws.onclose = () => {
            clearTimeout(timeout);
        };
    });
}

/**
 * Get audio duration from blob
 */
function getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(audio.src);
            resolve(audio.duration);
        };
        audio.onerror = () => {
            URL.revokeObjectURL(audio.src);
            reject(new Error('Failed to load audio'));
        };
        audio.src = URL.createObjectURL(audioBlob);
    });
}

export { getAudioDuration };
