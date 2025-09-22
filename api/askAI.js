// api/askAI.js - VERSIÓN FINAL Y FUNCIONAL
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Error Crítico: La variable de entorno GROQ_API_KEY no está configurada.");
    return response.status(500).json({ error: 'Error de configuración del servidor.' });
  }

  const { message } = request.body;
  if (!message) {
    return response.status(400).json({ error: 'No se proporcionó ningún mensaje.' });
  }

  try {
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }],
          model: "llama3-70b-8192", // <-- ¡El modelo correcto!
        }),
      }
    );

    const result = await groqResponse.json();
    
    if (!result.choices || result.choices.length === 0) {
      console.error("Respuesta inesperada de Groq:", result);
      throw new Error("La respuesta de Groq no contiene una respuesta válida.");
    }
    
    const aiText = result.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";
    
    response.status(200).json({ reply: aiText });

  } catch (error) {
    console.error("Error detallado:", error);
    response.status(500).json({ error: 'Falló la conexión con el modelo de IA.' });
  }
}
