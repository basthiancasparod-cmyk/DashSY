// api/askAI.js - VERSIÓN INTELIGENTE CON CONTEXTO
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

  // Ahora extraemos tanto el mensaje como las métricas
  const { message, metrics } = request.body;
  if (!message) {
    return response.status(400).json({ error: 'No se proporcionó ningún mensaje.' });
  }

  // 1. Creamos el "personaje" o rol de la IA
  const systemPrompt = `
    Eres "DashSY", un asistente experto en trading P2P de criptomonedas, especializado en el mercado venezolano.
    Tu tono debe ser profesional, directo y útil. Proporciona respuestas cortas y precisas.
    Analiza las métricas del día que se te proporcionan y responde la pregunta del usuario basándote en ellas.
  `;

  // 2. Creamos la pregunta del usuario con su contexto
  const userPrompt = `
    Métricas del día:
    - Ganancia Total: ${metrics.gananciaVes} VES
    - Ganancia Total en Dólares (aprox): ${metrics.gananciaUsdc} USDC
    - Número de Operaciones: ${metrics.totalOps}
    - Tasa de Compra Promedio: ${metrics.promCompra} VES
    - Tasa de Venta Promedio: ${metrics.promVenta} VES
    - Brecha (Spread): ${metrics.brecha}

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
            // 3. Enviamos tanto el rol del sistema como la pregunta contextualizada
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
