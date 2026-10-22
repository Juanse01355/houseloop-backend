// ============================================================
//   HOUSELOOP BACKEND — Utilidades para URLs de archivos
//
//   Guarda este archivo en: src/utils/urls.js
//
//   Idea: en la base de datos se guarda SOLO la ruta
//   ("/uploads/videos/xxx.mp4"), nunca la IP. Al responder, el
//   backend le antepone la dirección del servidor. Así, si cambia
//   la IP, la red o el servidor, no hay que tocar ningún dato guardado.
// ============================================================

// Dirección pública de este servidor, SIN barra final.
//  - En producción: se usa BASE_URL (variable de entorno), por ejemplo
//    "https://api.tudominio.com". Así las URLs siempre salen en https
//    y no dependen de lo que mande cada petición.
//  - En desarrollo (BASE_URL vacía o sin definir): se arma con la petición,
//    por ejemplo "http://192.168.1.24:3300". Con "trust proxy" activado,
//    req.protocol respeta el header x-forwarded-proto del proxy de la nube.
const hostDe = (req) => {
  const base = (process.env.BASE_URL || '').trim();
  if (base) return base.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

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