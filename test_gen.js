const { EdgeTTSClient } = require('edge-tts-client');
global.WebSocket = require('ws');

async function test() {
    console.log('Initializing client...');
    // Try passing voice in constructor. 
    // If it fails, we know we might need to pass it to toStream.
    const client = new EdgeTTSClient({ voice: 'pt-BR-AntonioNeural' });

    console.log('Calling toStream...');
    const stream = await client.toStream('Olá, este é um teste de som.');

    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log('Success! Buffer length:', buffer.length);
}
test().catch(e => console.error('Error:', e));
