import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

/**
 * Termina e limpa instância FFmpeg atual
 */
export async function terminateFFmpeg(): Promise<void> {
    if (ffmpegInstance) {
        try {
            await ffmpegInstance.terminate();
        } catch (e) {
            console.warn('Error terminating FFmpeg:', e);
        }
        ffmpegInstance = null;
        ffmpegLoaded = false;
    }
}

/**
 * Carrega FFmpeg WebAssembly
 */
export async function loadFFmpeg(): Promise<void> {
    // Terminate existing instance only if it actually exists and is loaded
    if (ffmpegInstance && ffmpegLoaded) {
        await terminateFFmpeg();
    }

    ffmpegInstance = new FFmpeg();

    // Add logger
    ffmpegInstance.on('log', ({ message }) => {
        console.log('FFmpeg Log:', message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoaded = true;
}

/**
 * Extrai áudio de um vídeo
 */
export async function extractAudio(videoFile: File): Promise<Blob> {
    if (!ffmpegInstance) throw new Error('FFmpeg não carregado');

    await ffmpegInstance.writeFile('input.mp4', await fetchFile(videoFile));

    await ffmpegInstance.exec([
        '-i', 'input.mp4',
        '-vn', // Sem vídeo
        '-acodec', 'libmp3lame',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '192k',
        'output.mp3'
    ]);

    const data = await ffmpegInstance.readFile('output.mp3') as Uint8Array;
    return new Blob([data as BlobPart], { type: 'audio/mpeg' });
}

/**
 * Ajusta velocidade do áudio usando atempo filter
 * Suporta qualquer fator de velocidade, encadeando filtros quando necessário
 */
export async function adjustAudioSpeed(
    audioBlob: Blob,
    speedFactor: number,
    onProgress?: (message: string) => void
): Promise<Blob> {
    if (!ffmpegInstance) throw new Error('FFmpeg não carregado');
    if (speedFactor <= 0) throw new Error('Speed factor deve ser > 0');

    onProgress?.(`Ajustando velocidade (${speedFactor.toFixed(2)}x)...`);

    // atempo filter tem limite de 0.5x - 2.0x
    // Para valores fora desse range, encadeamos múltiplos filtros
    let filters: string[] = [];
    let remainingSpeed = speedFactor;

    while (remainingSpeed > 2.0) {
        filters.push('atempo=2.0');
        remainingSpeed /= 2.0;
    }

    while (remainingSpeed < 0.5) {
        filters.push('atempo=0.5');
        remainingSpeed /= 0.5;
    }

    // Adiciona o fator final
    if (remainingSpeed !== 1.0) {
        filters.push(`atempo=${remainingSpeed.toFixed(4)}`);
    }

    const filterChain = filters.join(',');

    // CRITICAL: Use unique filenames to prevent collisions when processing multiple segments
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inputFile = `input_audio_${uniqueId}.mp3`;
    const outputFile = `output_adjusted_${uniqueId}.mp3`;

    try {
        await ffmpegInstance.writeFile(inputFile, await fetchFile(audioBlob));

        await ffmpegInstance.exec([
            '-i', inputFile,
            '-filter:a', filterChain,
            '-ar', '44100',
            '-ac', '2',
            outputFile
        ]);

        const data = await ffmpegInstance.readFile(outputFile) as Uint8Array;

        // CRITICAL: Create a copy of the data to prevent memory access issues after cleanup
        const dataCopy = new Uint8Array(data);

        // CRITICAL: Clean up temp files immediately to prevent memory overflow
        try {
            await ffmpegInstance.deleteFile(inputFile);
            await ffmpegInstance.deleteFile(outputFile);
        } catch (e) {
            console.warn('Failed to cleanup temp files:', e);
        }

        onProgress?.('✅ Velocidade ajustada!');
        return new Blob([dataCopy as BlobPart], { type: 'audio/mpeg' });
    } catch (error) {
        // Cleanup on error too
        try {
            await ffmpegInstance.deleteFile(inputFile).catch(() => { });
            await ffmpegInstance.deleteFile(outputFile).catch(() => { });
        } catch (e) {
            // Ignore cleanup errors
        }
        console.error('Erro ao ajustar velocidade:', error);
        throw new Error('Falha ao ajustar velocidade do áudio');
    }
}


/**
 * Ajusta a velocidade do vídeo + áudio
 * Fator < 1.0 = Slow Motion (duração aumenta)
 */
export async function adjustVideoSpeed(
    videoFile: File,
    speedFactor: number,
    onProgress?: (message: string) => void
): Promise<Blob> {
    if (!ffmpegInstance) throw new Error('FFmpeg não carregado');
    if (speedFactor <= 0) throw new Error('Speed factor deve ser > 0');

    onProgress?.(`Ajustando velocidade do vídeo (${speedFactor}x)...`);

    // setpts = 1/speedFactor (ex: 0.8x -> setpts=1.25)
    // atempo = speedFactor (ex: 0.8)
    const ptsFactor = (1 / speedFactor).toFixed(4);

    // CRITICAL: Use unique filenames to prevent collisions
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inputFile = `input_video_${uniqueId}.mp4`;
    const outputFile = `output_slow_${uniqueId}.mp4`;

    try {
        await ffmpegInstance.writeFile(inputFile, await fetchFile(videoFile));

        const ret = await ffmpegInstance.exec([
            '-i', inputFile,
            '-filter_complex', `[0:v]setpts=${ptsFactor}*PTS[v];[0:a]atempo=${speedFactor}[a]`,
            '-map', '[v]',
            '-map', '[a]',
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // Prioritize speed
            '-crf', '28', // Lower quality is fine for preview/editing
            '-c:a', 'aac',
            '-b:a', '128k',
            outputFile
        ]);

        const data = await ffmpegInstance.readFile(outputFile) as Uint8Array;
        const dataCopy = new Uint8Array(data);

        // Cleanup
        try {
            await ffmpegInstance.deleteFile(inputFile);
            await ffmpegInstance.deleteFile(outputFile);
        } catch (e) {
            console.warn('Failed to cleanup temp files (adjustVideoSpeed):', e);
        }

        return new Blob([dataCopy as BlobPart], { type: 'video/mp4' });

    } catch (error) {
        // Cleanup on error
        try {
            await ffmpegInstance.deleteFile(inputFile).catch(() => { });
            await ffmpegInstance.deleteFile(outputFile).catch(() => { });
        } catch (e) { }
        console.error('Erro ao ajustar velocidade do vídeo:', error);
        throw new Error('Falha ao ajustar velocidade do vídeo');
    }
}

/**
 * Remove silêncio do início e fim do áudio

/**
 * Remove silêncio do início e fim do áudio
 * Útil para TTS que adiciona pausas indesejadas
 */
export async function removeSilence(
    audioBlob: Blob,
    onProgress?: (message: string) => void
): Promise<Blob> {
    if (!ffmpegInstance) throw new Error('FFmpeg não carregado');

    onProgress?.('Removendo silêncio...');

    // CRITICAL: Use unique filenames to prevent collisions when processing multiple segments
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inputFile = `input_silence_${uniqueId}.mp3`;
    const outputFile = `output_trimmed_${uniqueId}.mp3`;

    try {
        await ffmpegInstance.writeFile(inputFile, await fetchFile(audioBlob));

        // silenceremove filter with conservative thresholds
        await ffmpegInstance.exec([
            '-i', inputFile,
            '-af', 'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:stop_periods=-1:stop_duration=0.3:stop_threshold=-50dB',
            '-ar', '44100',
            '-ac', '2',
            outputFile
        ]);

        const data = await ffmpegInstance.readFile(outputFile) as Uint8Array;

        // CRITICAL: Create a copy of the data to prevent memory access issues after cleanup
        const dataCopy = new Uint8Array(data);

        // CRITICAL: Clean up temp files immediately to prevent memory overflow
        try {
            await ffmpegInstance.deleteFile(inputFile);
            await ffmpegInstance.deleteFile(outputFile);
        } catch (e) {
            console.warn('Failed to cleanup temp files:', e);
        }

        onProgress?.('✅ Silêncio removido!');
        return new Blob([dataCopy as BlobPart], { type: 'audio/mpeg' });
    } catch (error) {
        // Cleanup on error too
        try {
            await ffmpegInstance.deleteFile(inputFile).catch(() => { });
            await ffmpegInstance.deleteFile(outputFile).catch(() => { });
        } catch (e) {
            // Ignore cleanup errors
        }
        console.error('Erro ao remover silêncio:', error);
        throw new Error('Falha ao remover silêncio do áudio');
    }
}

/**
 * Ajusta velocidade do áudio (legado, mantido para compatibilidade)
 * @deprecated Use adjustAudioSpeed para maior precisão
 */
export async function adjustSpeed(audioBlob: Blob, speedFactor: number): Promise<Blob> {
    return adjustAudioSpeed(audioBlob, speedFactor);
}

/**
 * Monta SOMENTE os segmentos dublados sem o áudio original
 * Ideal para exportação final
 */
export async function assembleDubbingOnly(
    dubbedSegments: Array<{ blob: Blob; start: number }>,
    totalDuration: number
): Promise<Blob> {
    if (!ffmpegInstance) throw new Error('FFmpeg não carregado');
    if (dubbedSegments.length === 0) throw new Error('Nenhum segmento para montar');

    try {
        // Escrever cada segmento dublado
        for (let i = 0; i < dubbedSegments.length; i++) {
            await ffmpegInstance.writeFile(`dub_${i}.mp3`, await fetchFile(dubbedSegments[i].blob));
        }

        // Construir filtro de delay para cada segmento
        let filterComplex = '';
        for (let i = 0; i < dubbedSegments.length; i++) {
            const delayMs = Math.round(dubbedSegments[i].start * 1000); // ms
            filterComplex += `[${i}:a]adelay=${delayMs}|${delayMs}[dub${i}];`;
        }

        // Mixar todos os segmentos com normalização de volume
        const inputs = dubbedSegments.map((_, i) => `[dub${i}]`);
        filterComplex += `${inputs.join('')}amix=inputs=${dubbedSegments.length}:duration=longest,volume=2.5,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;

        const inputArgs: string[] = [];
        for (let i = 0; i < dubbedSegments.length; i++) {
            inputArgs.push('-i', `dub_${i}.mp3`);
        }

        await ffmpegInstance.exec([
            ...inputArgs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-ar', '44100',
            '-ac', '2',
            '-b:a', '192k',
            '-t', totalDuration.toString(),
            'final_dubbing.mp3'
        ]);

        const data = await ffmpegInstance.readFile('final_dubbing.mp3') as Uint8Array;

        // CRITICAL: Create a copy of the data to prevent memory access issues after cleanup
        const dataCopy = new Uint8Array(data);

        // Clean up all temporary files
        try {
            for (let i = 0; i < dubbedSegments.length; i++) {
                await ffmpegInstance.deleteFile(`dub_${i}.mp3`);
            }
            await ffmpegInstance.deleteFile('final_dubbing.mp3');
        } catch (e) {
            console.warn('Failed to cleanup temp files in assembleDubbingOnly:', e);
        }

        return new Blob([dataCopy as BlobPart], { type: 'audio/mpeg' });
    } catch (error) {
        // Cleanup on error
        try {
            for (let i = 0; i < dubbedSegments.length; i++) {
                await ffmpegInstance.deleteFile(`dub_${i}.mp3`).catch(() => { });
            }
            await ffmpegInstance.deleteFile('final_dubbing.mp3').catch(() => { });
        } catch (e) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

/**
 * Monta o áudio final misturando original + segmentos dublados
 * USE assembleDubbingOnly() se quiser apenas a dublagem
 */
export async function assembleAudio(
    originalAudio: Blob,
    dubbedSegments: Array<{ blob: Blob; start: number }>,
    totalDuration: number
): Promise<Blob> {
    if (!ffmpegInstance) throw new Error('FFmpeg não carregado');

    try {
        // Escrever áudio original
        await ffmpegInstance.writeFile('original.mp3', await fetchFile(originalAudio));

        // Escrever cada segmento dublado
        for (let i = 0; i < dubbedSegments.length; i++) {
            await ffmpegInstance.writeFile(`dub_${i}.mp3`, await fetchFile(dubbedSegments[i].blob));
        }

        // Construir filtro de mixagem complexo
        let filterComplex = `[0:a]volume=0.3[orig];`; // Original em 30%

        for (let i = 0; i < dubbedSegments.length; i++) {
            const delay = Math.round(dubbedSegments[i].start * 1000); // ms
            filterComplex += `[${i + 1}:a]adelay=${delay}|${delay}[dub${i}];`;
        }

        // Mixar tudo
        const inputs = ['[orig]', ...dubbedSegments.map((_, i) => `[dub${i}]`)];
        filterComplex += `${inputs.join('')}amix=inputs=${dubbedSegments.length + 1}:duration=longest[out]`;

        const inputArgs: string[] = ['-i', 'original.mp3'];
        for (let i = 0; i < dubbedSegments.length; i++) {
            inputArgs.push('-i', `dub_${i}.mp3`);
        }

        await ffmpegInstance.exec([
            ...inputArgs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-ar', '44100',
            '-ac', '2',
            '-b:a', '192k',
            'final.mp3'
        ]);

        const data = await ffmpegInstance.readFile('final.mp3') as Uint8Array;

        // CRITICAL: Create a copy of the data to prevent memory access issues after cleanup
        const dataCopy = new Uint8Array(data);

        // Clean up all temporary files
        try {
            await ffmpegInstance.deleteFile('original.mp3');
            for (let i = 0; i < dubbedSegments.length; i++) {
                await ffmpegInstance.deleteFile(`dub_${i}.mp3`);
            }
            await ffmpegInstance.deleteFile('final.mp3');
        } catch (e) {
            console.warn('Failed to cleanup temp files in assembleAudio:', e);
        }

        return new Blob([dataCopy as BlobPart], { type: 'audio/mpeg' });
    } catch (error) {
        // Cleanup on error
        try {
            await ffmpegInstance.deleteFile('original.mp3').catch(() => { });
            for (let i = 0; i < dubbedSegments.length; i++) {
                await ffmpegInstance.deleteFile(`dub_${i}.mp3`).catch(() => { });
            }
            await ffmpegInstance.deleteFile('final.mp3').catch(() => { });
        } catch (e) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

/**
 * Calcula duração de um áudio
 */
export function getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = reject;
        audio.src = URL.createObjectURL(audioBlob);
    });
}
