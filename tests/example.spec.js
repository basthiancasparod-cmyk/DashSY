const { test, expect } = require('@playwright/test');

test('Validar que DashSY carga correctamente', async ({ page }) => {
  // Le damos 60 segundos por si Firebase tarda en responder
  test.setTimeout(60000);

  // Usamos localhost en lugar de la IP para evitar bloqueos de red
  await page.goto('http://localhost:5500', { 
    waitUntil: 'networkidle', // Espera a que no haya tráfico de red (ideal para Firebase)
    timeout: 60000 
  });

  // Verificamos el título (asegúrate de que en tu index.html el <title> diga DashSY)
  await expect(page).toHaveTitle(/DashSY/i);

  console.log('¡LOGRADO! La plataforma DashSY es estable y accesible.');
});