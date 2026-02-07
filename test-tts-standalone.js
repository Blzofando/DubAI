const { Communicate } = require('edge-tts-universal');
const fs = require('fs');
const path = require('path');

async function testTTS() {
    const text = "Este é um teste de áudio executado diretamente pelo terminal.";
    const voice = "pt-BR-AntonioNeural";
    const outputFile = path.join(__dirname, 'test-audio.mp3');

    console.log(`[TEST] Iniciando geração de áudio...`);
    console.log(`[TEST] Texto: "${text}"`);
    console.log(`[TEST] Voz: ${voice}`);

    const start = Date.now();

    try {
        const communicate = new Communicate(text, { voice });
        const audioChunks = [];
        let chunkCount = 0;

        console.log('[TEST] Aguardando stream...');

        for await (const chunk of communicate.stream()) {
            if (chunk.type === 'audio' && chunk.data) {
                audioChunks.push(chunk.data);
                chunkCount++;
                process.stdout.write('.'); // Feedback visual
            }
        }

        console.log('\n[TEST] Stream finalizado.');

        if (audioChunks.length === 0) {
            throw new Error('Nenhum dado de áudio recebido.');
        }

        const audioBuffer = Buffer.concat(audioChunks);
        fs.writeFileSync(outputFile, audioBuffer);

        const duration = Date.now() - start;
        console.log(`\n[TEST] SUCESSO!`);
        console.log(`[TEST] Tempo total: ${duration}ms`);
        console.log(`[TEST] Tamanho: ${audioBuffer.length} bytes`);
        console.log(`[TEST] Arquivo salvo em: ${outputFile}`);

    } catch (err) { // Catch any error
        const duration = Date.now() - start; // Access start from outer scope
        console.error(`\n[TEST] ERRO após ${duration}ms:`);
        console.error(err);
    }
}

testTTS();
