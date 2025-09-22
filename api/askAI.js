// api/askAI.js - VERSIÓN FINAL CON PROMPT ESTRICTO
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

  // --- INICIO: PROMPT FINAL Y ESTRICTO ---
  // Combinamos todas las instrucciones y datos en un solo bloque para ser más directos.
  const finalPrompt = `
    **ROL Y REGLAS ESTRICTAS:**
    - Eres un asistente de datos llamado DashSY.
    - Tu única fuente de conocimiento son los DATOS DEL DÍA proporcionados a continuación.
    - NUNCA menciones que eres un modelo de IA o que eres entrenado por Google.
    - NUNCA te presentes.
    - Responde de forma CORTA, PRECISA y DIRECTA a la PREGUNTA DEL USUARIO.
    - USA ÚNICAMENTE LOS DATOS PROPORCIONADOS.

    **DATOS DEL DÍA:**
    - Ganancia Total en VES: ${metrics.gananciaVes}
    - Ganancia Total en USDC (aproximada): ${metrics.gananciaUsdc}
    - Número de Operaciones: ${metrics.totalOps}
    - Tasa de Compra Promedio: ${metrics.promCompra}
    - Tasa de Venta Promedio: ${metrics.promVenta}
    - Brecha (Spread): ${metrics.brecha}%

    **PREGUNTA DEL USUARIO:**
    ${message}
  `;
  // --- FIN: PROMPT FINAL Y ESTRICTO ---

  try {
    const groqResponse = await fetch(
      "https://api.gro.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            // Ahora solo enviamos un mensaje de "usuario" con todas las instrucciones
            { 
              role: "user", 
              content: finalPrompt 
            }
          ],
          model: "gemma2-9b-it", 
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
