// api/askAI.js - VERSIÓN DE PRUEBA "HOLA MUNDO"

export default function handler(request, response) {
  // Imprimimos un mensaje claro en los logs de Vercel para ver si la función se ejecuta
  console.log("--- ¡HOLA MUNDO DESDE LA FUNCIÓN DE VERCEL! ---");
  console.log("Si ves este mensaje, la función se está ejecutando correctamente.");

  // Permitir que nuestra app frontend llame a esta función (CORS)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Enviamos una respuesta de prueba fija al chatbot
  response.status(200).json({ 
    reply: "Hola, soy una respuesta de prueba. La función está funcionando." 
  });
}
