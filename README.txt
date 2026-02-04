# SDComayagua (Tienda + Admin) ✅

Incluye:
- **Tienda** (catálogo, filtros, modal con galería, carrito en drawer, checkout por WhatsApp)
- **Panel Admin** (agregar/editar/eliminar/duplicar productos) sin tocar código

## Configuración rápida
1. Abrí `config.js` y verificá:
   - `API_BASE` = tu Web App de Apps Script
   - `WHATSAPP_NUMBER` y `WHATSAPP_DISPLAY`
2. Subí estos archivos a GitHub (repositorio) y activá **GitHub Pages**.
3. Entrá a `admin.html` e ingresá tu `ADMIN_KEY` (la clave del backend).

## Backend esperado (Apps Script)
- GET: `?only=productos` (o `?resource=productos`)
- POST: acciones:
  - `{ action:"updateProduct", adminKey:"...", product:{...} }`
  - `{ action:"deleteProduct", adminKey:"...", id:"..." }`

Si tu backend actual aún no tiene `deleteProduct`, decime y te paso el snippet para agregarlo.

## Estructura
- index.html
- styles.css
- app.js
- admin.html
- admin.css
- admin.js
- config.js
