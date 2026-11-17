# Contexto y Documentación del Ecosistema "Pizzería Popular"

Este archivo sirve como el "cerebro" o registro central del proyecto. **Cualquier IA o desarrollador que trabaje en este código debe leer este archivo antes de comenzar.**

## 📌 Regla de Oro para Asistentes de IA
**Si la IA comete un error, se topa con un problema específico de lógica de negocio, o el usuario (Nicolás) le enseña/corrige algo nuevo sobre cómo funciona la pizzería o el código, la IA TIENE LA OBLIGACIÓN de actualizar este archivo `contexto_pizzeria.md` con ese nuevo aprendizaje.** De esta manera, los errores no se repiten en el futuro.

---

## 🏗️ Arquitectura General
El proyecto es un sistema descentralizado sin base de datos tradicional:
*   **Frontend:** Aplicaciones web ligeras en HTML, CSS y Vanilla JavaScript.
*   **Backend / Base de Datos:** Google Sheets administrado a través de Google Apps Script.

## 📱 Módulos del Sistema
1.  **Menú Público / App de Pedidos (`index.html`, `main_app.js`):** Catálogo para clientes. Lee los datos en vivo de un CSV de Google Sheets. El checkout envía un POST a Google Apps Script para registrar la venta y redirige a WhatsApp.
2.  **Módulo de Caja (`caja.html`, `caja_app.js`):** Punto de venta interno para pedidos telefónicos y presenciales.
3.  **Módulo de Gastos (`gastos.html`, `gastos_app.js`):** Registro de egresos. Las categorías se extraen dinámicamente de la columna A de la pestaña "Categorías". Permite subir fotos de comprobantes tanto desde la galería como tomando una foto nueva con la cámara.
4.  **KDS / Pantallas de TV (`tv.html`, `tv_empanadas.html`):** Pantallas para visualizar los pedidos entrantes en el área de la cocina.

## ⚙️ Reglas de Negocio y Lógica Específica (Aprendizajes)
*   **Dominio Oficial:** La dirección web principal de la tienda es `pizzeriapopular.ar` (NO usar `.com`).
*   **Stock de Empanadas:** No se descuentan las empanadas de a una al venderlas. El control es simple: si en la planilla de Google Sheets se coloca un `0` en el stock de un sabor, ese sabor desaparece automáticamente del menú público y de la caja del mostrador.
*   **Doble registro de ventas:** La app no solo envía a WhatsApp, sino que hace un `fetch` con modo `no-cors` y `keepalive` (para evitar race conditions con la redirección) hacia Apps Script. El script registra el ticket general y desglosa los productos para control interno.
*   **Caché de Versiones:** Si se actualiza el código JS/CSS de un módulo, hay que asegurarse de forzar el refresco en el navegador del cliente, de lo contrario pueden quedar trabados (como pasó con la foto de los gastos).

## 🚀 Roadmap / Próximos Pasos (Pendiente)
*   **Fase 1 - Unificación Multi-Sucursal:** Eliminar archivos duplicados (ej: `_suc2.js`). Modificar el código para que sea un único archivo dinámico que lea de qué sucursal se trata a través de un parámetro en la URL (ej: `?sucursal=2`).

## 📜 Historial de Mejoras y Funcionalidades Recientes (Contexto de Desarrollo)
Para mantener un registro de las decisiones y características ya implementadas, a continuación se resumen los hitos clave del proyecto:

*   **Módulo de Gastos (`gastos.html`):**
    *   **Desarrollo:** App web mobile-friendly para el registro de gastos diarios, integrando subida de fotos de comprobantes a Google Drive mediante Google Apps Script.
    *   **Corrección de formato de montos:** Se modificó el backend en Apps Script para garantizar que los números grandes ingresados se parseen y guarden correctamente como números válidos en Google Sheets, evitando errores de puntuación (ej: que 500000 no termine como 50.00).

*   **Módulo de Caja (POS):**
    *   **Buscador Integrado:** Se agregó funcionalidad para filtrar/buscar productos por nombre directamente en la caja (tanto en la sucursal 1 como en la 2) agilizando los tiempos de cobro.
    *   **Sistema de Delivery:** Se actualizó la interfaz y el backend para capturar pedidos telefónicos (datos del cliente, dirección, costo de envío). Estos datos se envían a Google Sheets y se imprimen en el ticket.
    *   **Validación de Método de Pago:** Se modificó la lógica en la función `cobrar()` obligando al cajero a seleccionar explícitamente un método de pago antes de cerrar la venta para evitar descuadres en los balances.
    *   **Fix de Interfaz (Layout):** Se solucionó un problema de diseño (CSS/Overflow) que provocaba que el botón de "Cobrar e Imprimir" desapareciera de la pantalla al seleccionar "Delivery".

*   **Menús Digitales y TVs (`tv.html`, `tv_empanadas.html`):**
    *   **Automatización de Precios:** Los televisores de las sucursales pasaron de requerir actualización manual vía USB a ser pantallas web dinámicas sincronizadas en tiempo real con el "master" de Google Sheets (calculando dinámicamente precios compuestos como las "+ Horneadas").
    *   **Menú Vertical de Empanadas:** Se creó una interfaz específica y responsive orientada de forma vertical para un Smart TV Samsung.
    *   **Fallback Estático:** Se desarrolló un sistema o versión para exportar el menú web dinámico a imagen estática (JPG/PNG), requerido para un televisor antiguo específico sin capacidades Smart.

*   **Mapa Interactivo y Zonas de Envío (`zonas_envio.js`, `editor_zonas.html`):**
    *   **Cálculo por Polígonos en La Plata:** En la web de pedidos (`index.html` y `app_sucursal2.html`), cuando el cliente elige Delivery, ubica su dirección en un mapa interactivo Leaflet + OpenStreetMap oficial (`tile.openstreetmap.org`, evitando `basemaps.cartocdn.com` que exige API Key).
    *   **Precios Dinámicos por Zona desde Google Sheets:** Lee `ENVIO ZONA 1` ($3.000 por defecto), `ENVIO ZONA 2` ($3.500 por defecto) y `ENVIO ZONA 3` ($4.000 por defecto) desde la sección `CONFIGURACION` de `MASTER_PRECIOS_POPULAR`, tanto en la Web Pública como en los 3 botones de zona del POS de Caja (`caja.html` y `caja_sucursal2.html`).
    *   **Editor Visual de Zonas (`editor_zonas.html`):** Herramienta visual para arrastrar los vértices de las 3 zonas de cada sucursal o encuadrarlas por calles de La Plata.
    *   **Detector Cruzado de Sucursal, Memoria del Cliente y Caché Instantáneo:** Sugiere automáticamente la otra sucursal si el pin cae en su zona, recuerda los datos/pin del cliente en su celular (`pizzeria_popular_cliente_v1`), permite copiar el alias en 1 toque, autocompleta clientes habituales por teléfono en la Caja POS (`pizzeria_agenda_clientes_pos_v1`) y carga el menú web al instante con caché `Stale-While-Revalidate` (`menuPublicoCache_v1`).
    *   **Botón Rojo `🧪 TEST MASIVO EXCEL` en Caja 6 y 66 (`EXTRAS`) y Categorización de Bebidas:** En `caja_app.js` (pestaña `EXTRAS`) se agregó el botón rojo para disparar bajo demanda un pedido masivo con el 100% de los productos del Master (incluso los marcados con `NO`) hacia los 4 canales (Apps y Cajas de Sucursal 1 y 2) sin imprimir papel. Además, los 4 frontends y `codigo_apps_script.js` ahora etiquetan explícitamente `categoria: "Bebida"` (evitando que Pepsi/7UP/Mirinda caigan como `Empanada Suelta`).
