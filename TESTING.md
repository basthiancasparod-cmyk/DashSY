# Estrategia de Aseguramiento de Calidad (QA) - DashSY

Este documento detalla el plan de pruebas y los criterios de aceptación seguidos para garantizar la integridad financiera y operativa de DashSY.

## 1. Alcance de las Pruebas
El objetivo principal fue validar la lógica de cálculo de rentabilidad y la persistencia de datos en tiempo real.

## 2. Tipos de Pruebas Realizadas
* **Pruebas Manuales (Black Box):** Validación de flujos de usuario, desde el registro de operaciones hasta la visualización de profit.
* [cite_start]**Pruebas de Reglas de Negocio:** Verificación exhaustiva de la lógica FIFO para el cálculo preciso de ganancias en transacciones P2P[cite: 33].
* [cite_start]**Pruebas de Integración:** Validación de la sincronización en tiempo real entre la interfaz (PWA) y la base de datos (Firebase)[cite: 33].

## 3. Casos de Prueba Destacados (Escenarios)
| ID | Descripción | Resultado Esperado | Estado |
|---|---|---|---|
| TC-01 | Registro de compra/venta | El sistema debe recalcular el profit total instantáneamente. | Pass |
| TC-02 | Persistencia de datos | Al recargar la PWA, los datos deben recuperarse íntegros desde Firebase. | Pass |
| TC-03 | Lógica FIFO | El cálculo de profit debe seguir estrictamente el orden de entrada de activos. | Pass |

## 4. Reporte de Errores (Bug Reporting)
Durante el desarrollo se identificaron y solventaron errores críticos como:
* **BUG-001:** Desfase en el cálculo de decimales en spreads de alta volatilidad. (Solucionado mediante ajuste de funciones matemáticas en JavaScript).

## 5. Herramientas Utilizadas
* [cite_start]**JavaScript (Vanilla):** Para la lógica de validación interna[cite: 37].
* [cite_start]**Firebase Console:** Para el monitoreo de la integridad de los datos en el backend[cite: 33].
* **Chrome DevTools:** Para auditoría de rendimiento y compatibilidad.
