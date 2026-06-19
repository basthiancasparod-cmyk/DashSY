import { state } from './state.js';
import { showToast } from './ui.js';

export async function pasteSpecial() {
    try {
        const text = await navigator.clipboard.readText();
        const refMatch = text.match(/(?:Ref(?:erencia)?)[:\s-]+([a-z0-9]{8})/i);
        const usuarioMatch = text.match(/Contraparte:\s*([A-Z0-9\.]+)/i);
        const tasaMatch = text.match(/Precio:\s*([\d\.]+)/i);
        const estatusMatch = text.match(/Transacción\s+completada/i);
        const montoRecibidoUsdcMatch = text.match(/Monto recibido:\s*([\d\.,]+)\s*USDC/i);
        const montoEnviadoUsdcMatch = text.match(/Monto enviado:\s*([\d\.,]+)\s*USDC/i);
        if (usuarioMatch) document.getElementById("usuario").value = usuarioMatch[1];
        if (refMatch) document.getElementById("referencia").value = refMatch[1];
        if (tasaMatch) document.getElementById("tasa").value = tasaMatch[1].replace(',', '.');
        if (montoRecibidoUsdcMatch) {
            document.getElementById("operacion").value = "Compra";
            document.getElementById("montoUsdc").value = montoRecibidoUsdcMatch[1].replace(',', '.');
        } else if (montoEnviadoUsdcMatch) {
            document.getElementById("operacion").value = "Venta";
            document.getElementById("montoUsdc").value = montoEnviadoUsdcMatch[1].replace(',', '.');
        } else { showToast("No se pudo determinar el tipo de operación (Compra/Venta) o el monto USDC.", "warning"); return; }
        if (estatusMatch) document.getElementById("estatus").value = "Completado";
        window.calculateAll();
        showToast("Pegado especial exitoso.", "success");
    } catch (err) { showToast("No se pudo leer el portapapeles o el formato es incorrecto.", "error"); console.error(err); }
}

export async function pasteSpecialWally() {
    try {
        const text = await navigator.clipboard.readText();
        const refMatch = text.match(/(?:Ref(?:erencia)?)[:\s-]+([a-z0-9]{8})/i);
        const usuarioMatch = text.match(/Contraparte:\s*([A-Z0-9\.]+)/i);
        const montoEnviadoUsdMatch = text.match(/Monto enviado:\s*([\d\.]+)\s*USD/i);
        const montoRecibidoUsdcMatch = text.match(/Monto recibido:\s*([\d\.]+)\s*USDC/i);
        const montoEnviadoUsdcMatch = text.match(/Monto enviado:\s*([\d\.]+)\s*USDC/i);
        const montoRecibidoUsdMatch = text.match(/Monto recibido:\s*([\d\.]+)\s*USD/i);
        const tasaMatch = text.match(/Precio:\s*([\d\.]+)/i);
        if (usuarioMatch) document.getElementById("wallyUsuario").value = usuarioMatch[1];
        if (refMatch) document.getElementById("wallyReferencia").value = refMatch[1];
        let tasaValue = tasaMatch ? tasaMatch[1] : '';
        if (montoEnviadoUsdMatch && montoRecibidoUsdcMatch) {
            document.getElementById("wallyOperacion").value = "Compra";
            window.updateWallyFormFields();
            document.getElementById("reciboUsdc").value = montoRecibidoUsdcMatch[1];
            document.getElementById("tasaCompra").value = tasaValue;
            window.updateWallyCalculations();
            showToast("Pegado especial exitoso (Wally Compra).", "success");
        } else if (montoEnviadoUsdcMatch && montoRecibidoUsdMatch) {
            document.getElementById("wallyOperacion").value = "Venta";
            window.updateWallyFormFields();
            document.getElementById("envioUsdcVenta").value = montoEnviadoUsdcMatch[1];
            document.getElementById("tasaVenta").value = tasaValue;
            window.updateWallyCalculations();
            showToast("Pegado especial exitoso (Wally Venta).", "success");
        } else { showToast("Formato no reconocido para Wally.", "warning"); }
    } catch (err) { showToast("No se pudo leer el portapapeles.", "error"); console.error(err); }
}
