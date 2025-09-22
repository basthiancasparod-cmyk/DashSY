// Este código es para un archivo de backend de Vercel (Node.js)

export default async function handler(request, response) {
  // Permitir que nuestra app frontend llame a esta función (CORS)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Vercel maneja las solicitudes OPTIONS automáticamente, pero es bueno tener esto
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  // Extraer el mensaje del usuario de la solicitud
  const { message } = request.body;

  if (!message) {
    return response.status(400).json({ error: 'No message provided' });
  }

  // Llamar a la API de Hugging Face
  try {
    const apiResponse = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        headers: {
          "Authorization": `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ "inputs": message }),
      }
    );

    const result = await apiResponse.json();
    
    // Devolver la respuesta generada por la IA
    // El formato de la respuesta puede variar, nos aseguramos de manejarlo
    const aiText = result[0]?.generated_text || "No pude generar una respuesta.";
    
    response.status(200).json({ reply: aiText });

  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Failed to connect to the AI model' });
  }
}
