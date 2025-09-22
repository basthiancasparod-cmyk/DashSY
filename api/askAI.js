export default async function handler(request, response) {
  // Permitir que nuestra app frontend llame a esta función (CORS)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  const apiKey = process.env.HUGGING_FACE_API_KEY;

  // --- LÍNEA DE DEPURACIÓN AÑADIDA ---
  console.log("Verificando la clave API. ¿Existe?:", apiKey ? "Sí" : "No");

  // Si la clave no existe, detenemos todo y enviamos un error claro.
  if (!apiKey) {
    console.error("Error Crítico: La variable de entorno HUGGING_FACE_API_KEY no está configurada en Vercel.");
    return response.status(500).json({ error: 'Error de configuración del servidor: Falta la clave API.' });
  }

  const { message } = request.body;
  if (!message) {
    return response.status(400).json({ error: 'No message provided' });
  }

  try {
    const apiResponse = await fetch(
      "https://api-inference.huggingface.co/models/distilgpt2",
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ "inputs": message }),
      }
    );
    const result = await apiResponse.json();
    const aiText = result[0]?.generated_text || "No pude generar una respuesta.";
    response.status(200).json({ reply: aiText });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Failed to connect to the AI model' });
  }
}
