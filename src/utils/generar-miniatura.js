// ============================================================
//   HOUSELOOP BACKEND — Utilidad para generar miniaturas
//   Saca un frame del video y lo guarda como imagen .jpg
//
//   Guarda este archivo en: src/utils/generar-miniatura.js
//   Requiere: npm install fluent-ffmpeg ffmpeg-static
//   (ffmpeg-static trae ffmpeg incluido; no hace falta instalar
//   nada más en Windows y tampoco se necesita ffprobe)
// ============================================================

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * sacarFrame
 * Extrae UN frame del video en el segundo indicado y lo guarda
 * como imagen de 480 px de ancho (alto proporcional).
 */
const sacarFrame = (rutaVideo, rutaSalida, segundo) => {
  return new Promise((resolve, reject) => {
    ffmpeg(rutaVideo)
      .seekInput(segundo)
      .frames(1)
      .outputOptions(['-vf', 'scale=480:-2', '-q:v', '3'])
      .output(rutaSalida)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
};

/**
 * generarMiniatura
 * Recibe:
 *   rutaVideo     — ruta completa del video en el disco
 *   carpetaSalida — carpeta donde se guardará la miniatura
 *   nombreArchivo — nombre SIN extensión (ej: el nombre del video)
 * Devuelve: Promise con el nombre del archivo creado (ej: "abc123.jpg")
 *
 * Intenta primero en el segundo 1 (evita el frame negro del inicio).
 * Si el video es muy corto y no sale nada, usa el primer frame.
 */
const generarMiniatura = async (rutaVideo, carpetaSalida, nombreArchivo) => {
  fs.mkdirSync(carpetaSalida, { recursive: true });

  const nombreFinal = `${nombreArchivo}.jpg`;
  const rutaSalida = path.join(carpetaSalida, nombreFinal);

  const existeYTieneContenido = () =>
    fs.existsSync(rutaSalida) && fs.statSync(rutaSalida).size > 0;

  for (const segundo of [1, 0]) {
    try {
      await sacarFrame(rutaVideo, rutaSalida, segundo);
    } catch (error) {
      if (segundo === 0) throw error; // ya no hay más intentos
      continue;
    }
    if (existeYTieneContenido()) return nombreFinal;
  }

  throw new Error('No se pudo extraer ningún frame del video');
};

module.exports = { generarMiniatura };