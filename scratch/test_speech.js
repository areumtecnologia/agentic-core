'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function synthesizeWindowsSpeech(text, outputFile, voiceName = 'Microsoft Maria Desktop') {
    const safeText = text.replace(/'/g, "''").replace(/[\r\n]+/g, ' ');
    const psScript = [
        'Add-Type -AssemblyName System.Speech',
        '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
        `$synth.SelectVoice('${voiceName}')`,
        `$synth.SetOutputToWaveFile('${outputFile.replace(/\\/g, '/')}')`,
        `$synth.Speak('${safeText}')`,
        '$synth.Dispose()'
    ].join('\r\n');

    const tempPs1 = path.join(__dirname, 'temp_synth.ps1');
    fs.writeFileSync(tempPs1, psScript, 'latin1');
    try {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`);
    } finally {
        if (fs.existsSync(tempPs1)) fs.unlinkSync(tempPs1);
    }
    return fs.readFileSync(outputFile);
}

const gleicyOut = path.join(__dirname, '../tests/audios/resposta_agente_para_gleicy.wav');
const renanOut = path.join(__dirname, '../tests/audios/resposta_agente_para_renan.wav');

synthesizeWindowsSpeech('Olá, Gleicy! Muito bom dia. É um prazer ter você aqui na Áreum Tecnologia! Como posso te ajudar hoje?', gleicyOut);
console.log('✓ Gleicy spoken WAV generated, size:', fs.statSync(gleicyOut).size);

synthesizeWindowsSpeech('Alô, Renan! Som recebido alto e claro! Teste de microfone aprovado com sucesso.', renanOut);
console.log('✓ Renan spoken WAV generated, size:', fs.statSync(renanOut).size);
