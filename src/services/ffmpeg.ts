import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

/**
 * Carrega FFmpeg WebAssembly
 */
export async function loadFFmpeg(): Promise<void> {
    if (ffmpegLoaded) return;

    ffmpegInstance = new FFmpeg();

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

    try {
        await ffmpegInstance.writeFile('input_audio.mp3', await fetchFile(audioBlob));

        await ffmpegInstance.exec([
            '-i', 'input_audio.mp3',
            '-filter:a', filterChain,
            '-ar', '44100',
            '-ac', '2',
            'output_adjusted.mp3'
        ]);

        const data = await ffmpegInstance.readFile('output_adjusted.mp3') as Uint8Array;
        onProgress?.('✅ Velocidade ajustada!');

        return new Blob([data as BlobPart], { type: 'audio/mpeg' });
    } catch (error) {
        console.error('Erro ao ajustar velocidade:', error);
        throw new Error('Falha ao ajustar velocidade do áudio');
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

    // Mixar todos os segmentos
    const inputs = dubbedSegments.map((_, i) => `[dub${i}]`);
    filterComplex += `${inputs.join('')}amix=inputs=${dubbedSegments.length}:duration=longest[out]`;

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
    return new Blob([data as BlobPart], { type: 'audio/mpeg' });
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
    return new Blob([data as BlobPart], { type: 'audio/mpeg' });
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
