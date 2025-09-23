// api/askAI.js - VERSIÓN CON INTELIGENCIA AVANZADA
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'Error de configuración del servidor.' });
  }

  const { message, context } = request.body;
  if (!message) {
    return response.status(400).json({ error: 'No se proporcionó ningún mensaje.' });
  }

  const systemPrompt = `
    Eres "DashSY", un asistente experto en trading P2P de criptomonedas, integrado en un dashboard.
    Tu principal fuente de información es el CONTEXTO JSON proporcionado. 
    NUNCA inventes datos referentes a las metricas del dashboard.
    Tu tono debe ser profesional, analítico y amigable, como el asistente Jarvis de Iron Man, 
    incluso puede hacer chistes ocasionales e incluso ser sarcastica.
    Proporciona respuestas amigables pero útiles.
    No te presentes ni menciones que eres una IA.
    Si la pregunta no puede ser respondida con el contexto, di "No tengo información sobre eso".
    Interpreta los datos para dar resúmenes, comparaciones y sugerencias simples.
  `;
  
  // Convertimos el objeto de contexto en un string legible para la IA
  const contextString = JSON.stringify(context, null, 2);

  const userPrompt = `
    CONTEXTO:
    ${contextString}

    PREGUNTA DEL USUARIO:
    ${message}
  `;

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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          model: "gemma2-9b-it", 
        }),
      }
    );

    const result = await groqResponse.json();
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error("La respuesta de Groq no contiene una respuesta válida.");
    }
    
    const aiText = result.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";
    
    response.status(200).json({ reply: aiText });

  } catch (error) {
    console.error("Error detallado:", error);
    response.status(500).json({ error: 'Falló la conexión con el modelo de IA.' });
  }
}
