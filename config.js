/**
 * SDComayagua - Configuración
 * Nota: NO necesitas tocar código para subir productos.
 * El panel admin te deja agregar/editar/eliminar desde el navegador.
 */
window.SDCO_CONFIG = {
  APP_NAME: "SDComayagua",
  WHATSAPP_DISPLAY: "+504 3151-7755",
  WHATSAPP_NUMBER: "50431517755",
  API_BASE: "https://script.google.com/macros/s/AKfycbz3cGjYhcjXLyCcue8SpFPt3u_a7jE8huqtN-fDnZGhhN04BN-FfmgZePmorbAMUDmGDw/exec",
  // Si tu Apps Script expone ?only=productos (como el backend premium), déjalo en true.
  USE_ONLY_MODE: true,
  // Si en tu backend usas ?resource=productos en vez de ?only=productos, pon USE_ONLY_MODE en false.
  // USE_ONLY_MODE: false,
  CURRENCY: "Lps.",
  LOCALE: "es-HN",
  // Si quieres mostrar precio en USD también, pon un tipo de cambio fijo aquí (opcional).
  USD_RATE: null
};
