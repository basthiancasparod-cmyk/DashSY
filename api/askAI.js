// api/askAI.js - VERSIÓN FINAL PARA GROQ

export default async function handler(request, response) {
  // Configuración para permitir que tu app frontend llame a esta función (CORS)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Vercel maneja las solicitudes OPTIONS, pero esto es una buena práctica
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  // Lee la clave API secreta desde la configuración de Vercel
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Error Crítico: La variable de entorno GROQ_API_KEY no está configurada.");
    return response.status(500).json({ error: 'Error de configuración del servidor.' });
  }

  // Extrae el mensaje del usuario de la solicitud
  const { message } = request.body;
  if (!message) {
    return response.status(400).json({ error: 'No se proporcionó ningún mensaje.' });
  }

  try {
    // Realiza la llamada a la API de Groq
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Mensajes que se envían al modelo de IA
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
          // El modelo de IA que usaremos (Llama 3, 8 mil millones de parámetros)
          model: "llama3-8b-8192",
        }),
      }
    );

    const result = await groqResponse.json();
    
    // Extrae la respuesta de texto de la IA del resultado
    const aiText = result.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";
    
    // Envía la respuesta de vuelta al chatbot
    response.status(200).json({ reply: aiText });

  } catch (error) {
    console.error("Error al llamar a la API de Groq:", error);
    response.status(500).json({ error: 'Falló la conexión con el modelo de IA.' });
  }
}
