import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

/**
 * Inicializa o FFmpeg.wasm
 */
export async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
    if (ffmpegInstance && ffmpegInstance.loaded) {
        return ffmpegInstance;
    }

    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
    });

    if (onProgress) {
        ffmpeg.on('progress', ({ progress }) => {
            onProgress(Math.round(progress * 100));
        });
    }

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
}

/**
 * Extrai áudio de MP4 ou MP3
 */
export async function extractAudio(file: File): Promise<Blob> {
    const ffmpeg = await loadFFmpeg();

    const inputName = 'input' + (file.name.endsWith('.mp4') ? '.mp4' : '.mp3');
    const outputName = 'output.mp3';

    // Escrever arquivo no sistema virtual do FFmpeg
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Extrair áudio (converter para mp3 se necessário)
    await ffmpeg.exec(['-i', inputName, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', outputName]);

    // Ler resultado
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'audio/mpeg' });

    // Limpar
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return blob;
}

/**
 * Remove silêncio do INÍCIO e FINAL do áudio (preserva pausas internas)
 */
/**
 * Remove silêncio do INÍCIO e FINAL do áudio (preserva pausas internas)
 */
export async function removeStartEndSilence(audioBlob: Blob): Promise<Blob> {
    const ffmpeg = await loadFFmpeg();

    const inputName = 'silence_input.mp3';
    const outputName = 'silence_output.mp3';

    await ffmpeg.writeFile(inputName, await fetchFile(audioBlob));

    // Filtro para remover silêncio no início e fim, mas preservar no meio
    // Ajustado para ser menos agressivo (threshold -60dB e duração minima 0.2s)
    await ffmpeg.exec([
        '-i', inputName,
        '-af', 'silenceremove=start_periods=1:start_silence=0.2:start_threshold=-60dB:stop_periods=1:stop_silence=0.2:stop_threshold=-60dB',
        '-ar', '44100',
        '-ac', '2', // Forçar stereo
        outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'audio/mpeg' });

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return blob;
}

/**
 * Ajusta velocidade do áudio SEM alterar pitch (time-stretch)
 * speedFactor > 1 = mais rápido, < 1 = mais lento
 */
export async function adjustSpeed(audioBlob: Blob, speedFactor: number): Promise<Blob> {
    const ffmpeg = await loadFFmpeg();

    const inputName = 'speed_input.mp3';
    const outputName = 'speed_output.mp3';

    await ffmpeg.writeFile(inputName, await fetchFile(audioBlob));

    // atempo: ajusta tempo sem alterar pitch
    // atempo aceita valores entre 0.5 e 100, mas vamos limitar entre 0.5 e 2.0
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speedFactor));

    await ffmpeg.exec([
        '-i', inputName,
        '-filter:a', `atempo=${clampedSpeed}`,
        '-ar', '44100',
        '-ac', '2', // Forçar stereo
        outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'audio/mpeg' });

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return blob;
}

/**
 * Monta o áudio final usando MIXAGEM com ADELAY
 * Abordagem robusta: Posiciona cada segmento em seu timestamp exato
 */
export async function assembleAudio(
    segments: Array<{ audioBlob: Blob; startTime: number; duration: number }>,
    totalDuration: number
): Promise<Blob> {
    const ffmpeg = await loadFFmpeg();

    if (segments.length === 0) {
        throw new Error('Nenhum segmento de áudio fornecido');
    }

    console.log(`[FFmpeg] Iniciando montagem via FILTER_COMPLEX (Total: ${totalDuration.toFixed(2)}s)`);

    // Ordenar por startTime apenas para organização, não é estritamente necessário para o mix
    segments.sort((a, b) => a.startTime - b.startTime);

    // Limite de segmentos para processar de uma vez (evitar erro de linha de comando muito longa)
    // Se houver muitos segmentos, seria ideal processar em batches, mas vamos tentar tudo de uma vez por enquanto
    // ou limitar a command line. O FFmpeg WASM roda em memória, então o limite é a RAM/Buffer.

    const inputArgs: string[] = [];
    const filterParts: string[] = [];
    let inputStreamName = '';

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segName = `seg_${i}.mp3`;

        // Escrever arquivo
        await ffmpeg.writeFile(segName, await fetchFile(seg.audioBlob));

        // Adicionar input
        inputArgs.push('-i', segName);

        // Delay em milissegundos
        const delayMs = Math.round(seg.startTime * 1000);

        // Criar filtro adelay para este input
        // Sintaxe: [i:a]adelay=delay|delay[标签]
        filterParts.push(`[${i}:a]adelay=${delayMs}|${delayMs}[s${i}]`);
    }

    // Parte final do filtro: mixar todos
    const accumulatedInputs = segments.map((_, i) => `[s${i}]`).join('');
    // mixar N inputs, normalize=0 mantem volume (dropout_transition=0 evita fade)
    filterParts.push(`${accumulatedInputs}amix=inputs=${segments.length}:dropout_transition=0:normalize=0[out]`);

    const filterComplex = filterParts.join(';');

    // Executar
    await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[out]',
        '-ar', '44100',
        '-ac', '2',
        'final_output.mp3'
    ]);

    // Ler resultado
    const data = await ffmpeg.readFile('final_output.mp3');
    const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'audio/mpeg' });

    // Limpeza
    await ffmpeg.deleteFile('final_output.mp3');
    for (let i = 0; i < segments.length; i++) {
        await ffmpeg.deleteFile(`seg_${i}.mp3`);
    }

    return blob;
}

/**
 * Calcula duração de um áudio
 */
export async function getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
            resolve(audio.duration);
        };
        audio.onerror = reject;
        audio.src = URL.createObjectURL(audioBlob);
    });
}
