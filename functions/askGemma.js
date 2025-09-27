// Archivo: netlify/functions/askGemma.js

// Usamos 'node-fetch' para hacer la llamada a la API externa
const fetch = require('node-fetch');

// La API Key se guarda de forma segura en las variables de entorno de Netlify
const GEMMA_API_KEY = process.env.GEMMA_API_KEY;

exports.handler = async function (event, context) {
    // 1. Recibe la pregunta desde tu PWA
    // El 'event.body' es un string, así que lo convertimos a JSON
    const { prompt } = JSON.parse(event.body);

    if (!prompt) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'El prompt no puede estar vacío.' })
        };
    }

    try {
        // 2. Llama de forma segura a la API de Gemma o DeepSeek
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMMA_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const result = await response.json();
        const modelResponse = result.candidates[0].content.parts[0].text;

        // 3. Devuelve la respuesta a tu PWA
        return {
            statusCode: 200,
            body: JSON.stringify({ reply: modelResponse })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Hubo un error al contactar la IA.' })
        };
    }
};
