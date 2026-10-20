// ============================================================
//   HOUSELOOP BACKEND — Utilidades para URLs de archivos
//
//   Guarda este archivo en: src/utils/urls.js
//
//   Idea: en la base de datos se guarda SOLO la ruta
//   ("/uploads/videos/xxx.mp4"), nunca la IP. Al responder, el
//   backend le antepone la dirección con la que lo llamó el
//   cliente en ese momento. Así, si cambia la IP, la red o el
//   servidor, no hay que tocar ningún dato guardado.
// ============================================================

// "http://192.168.1.24:3300" (o localhost)
const hostDe = (req) => `${req.protocol}://${req.get('host')}`;

// "http://192.168.1.16:3300/uploads/videos/a.mp4" → "/uploads/videos/a.mp4"
// Solo toca URLs que apunten a /uploads (las de este servidor).
// Cualquier otra (por ejemplo la foto de Google) se deja igual.
const rutaRelativa = (valor) => {
  if (!valor || typeof valor !== 'string') return valor;
  const coincidencia = valor.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/);
  return coincidencia ? coincidencia[1] : valor;
};

// "/uploads/videos/a.mp4"  (o una URL vieja con IP) → URL completa actual.
// Sirve también para los datos viejos que aún tienen la IP guardada.
const urlPublica = (req, valor) => {
  const ruta = rutaRelativa(valor);
  if (typeof ruta === 'string' && ruta.startsWith('/uploads/')) {
    return `${hostDe(req)}${ruta}`;
  }
  return ruta;
};

module.exports = { hostDe, rutaRelativa, urlPublica };