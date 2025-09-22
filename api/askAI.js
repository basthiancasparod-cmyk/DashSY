// api/askAI.js - VERSIÓN CON PROMPT MEJORADO
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

  const { message, metrics } = request.body;
  if (!message) {
    return response.status(400).json({ error: 'No se proporcionó ningún mensaje.' });
  }

  // --- INICIO: PROMPT MEJORADO ---
  const systemPrompt = `
    Eres "DashSY", un asistente de trading P2P integrado en un dashboard. 
    Tu única fuente de información son las métricas del día que se te proporcionan a continuación.
    NUNCA inventes datos ni des información que no esté en las métricas.
    Tus respuestas deben ser cortas, directas y al punto, como si fueras un analista de datos.
    No te presentes ni menciones que eres una IA. Responde directamente a la pregunta del usuario usando los datos.
  `;
  // --- FIN: PROMPT MEJORADO ---

  const userPrompt = `
    Métricas del día:
    - Ganancia Total VES: ${metrics.gananciaVes}
    - Ganancia Total USDC: ${metrics.gananciaUsdc}
    - Operaciones: ${metrics.totalOps}
    - Promedio Compra: ${metrics.promCompra}
    - Promedio Venta: ${metrics.promVenta}
    - Brecha: ${metrics.brecha}%

    Pregunta del usuario: "${message}"
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
