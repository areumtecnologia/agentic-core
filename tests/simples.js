require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fetch = global.fetch;

async function main() {
    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_GEMINI_API_KEY
    });

    try {
        const models = await ai.models.list();

        for await (const model of models) {
            console.log(model.name);
        }
        // const response = await ai.models.generateContent({
        //     model: 'gemma-4-31b-it',
        //     contents: 'Olá, responda apenas: OK'
        // });

        // console.log(response.text);
    } catch (error) {
        console.error('ERRO COMPLETO:');
        console.error(JSON.stringify(error, null, 2));
    }
}
const main2 = async () => {

    const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=' + process.env.GOOGLE_GEMINI_API_KEY,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Responda apenas OK'
                    }]
                }]
            })
        }
    );

    console.log(await response.text());
}

main()