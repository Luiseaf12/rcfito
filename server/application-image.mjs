// Bounded container/header validation, without decoding pixels or executing metadata.
// A provider decoder may still reject damaged compressed pixels; that is handled safely.
export const applicationImageMaxBytes = 5 * 1024 * 1024;
export const applicationImageMaxPixels = 20_000_000;
export class ApplicationImageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const imageInvalid = () => { throw new ApplicationImageError(400, 'La imagen no es un PNG, JPEG o WebP estático válido. Selecciona otro archivo.'); };
const imageDimensions = (width, height) => {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) return imageInvalid();
  if (width * height > applicationImageMaxPixels) throw new ApplicationImageError(400, 'La imagen supera 20 megapíxeles. Reduce sus dimensiones antes de enviarla.');
  return { width, height };
};
const imageU16 = (bytes, offset) => bytes[offset] * 256 + bytes[offset + 1];
const imageU32 = (bytes, offset) => bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 256 + bytes[offset + 3];
const imageLE32 = (bytes, offset) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000;
const imageTag = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
const imageCrcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function imageCrc(bytes, start, end) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) crc = imageCrcTable[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function imagePng(bytes) {
  if (bytes.length < 57 || [137, 80, 78, 71, 13, 10, 26, 10].some((value, index) => bytes[index] !== value)) return imageInvalid();
  let offset = 8, dimensions, color, palette = false, dataSize = 0, dataEnded = false;
  const zlibHeader = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return imageInvalid();
    const length = imageU32(bytes, offset), tag = imageTag(bytes, offset + 4), start = offset + 8, end = start + length;
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(tag) || end + 4 > bytes.length || imageCrc(bytes, offset + 4, end) !== imageU32(bytes, end)) return imageInvalid();
    if (['acTL', 'fcTL', 'fdAT'].includes(tag)) return imageInvalid();
    if (offset === 8 && tag !== 'IHDR') return imageInvalid();
    if (tag === 'IHDR') {
      if (dimensions || length !== 13) return imageInvalid();
      dimensions = imageDimensions(imageU32(bytes, start), imageU32(bytes, start + 4));
      const depth = bytes[start + 8]; color = bytes[start + 9];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!depths[color]?.includes(depth) || bytes[start + 10] !== 0 || bytes[start + 11] !== 0 || bytes[start + 12] > 1) return imageInvalid();
    } else if (tag === 'PLTE') {
      if (palette || dataSize || [0, 4].includes(color) || !length || length > 768 || length % 3) return imageInvalid();
      palette = true;
    } else if (tag === 'IDAT') {
      if (dataEnded || color === 3 && !palette) return imageInvalid();
      for (let index = start; index < end && zlibHeader.length < 2; index++) zlibHeader.push(bytes[index]);
      dataSize += length;
    } else if (tag === 'IEND') {
      if (length || !dimensions || dataSize < 6 || end + 4 !== bytes.length || zlibHeader[0] % 16 !== 8 || zlibHeader[0] >> 4 > 7 || ((zlibHeader[0] << 8) + zlibHeader[1]) % 31 || zlibHeader[1] & 32) return imageInvalid();
      return dimensions;
    } else {
      if (tag[0] === tag[0].toUpperCase()) return imageInvalid();
      if (dataSize) dataEnded = true;
    }
    offset = end + 4;
  }
  return imageInvalid();
}
function imageJpeg(bytes) {
  if (bytes.length < 20 || bytes[0] !== 255 || bytes[1] !== 216) return imageInvalid();
  let offset = 2, dimensions, components = 0, scans = 0, quantization = false, huffman = false, entropy = false, entropySize = 0;
  while (offset < bytes.length) {
    if (entropy && bytes[offset] !== 255) { entropySize++; offset++; continue; }
    if (bytes[offset++] !== 255) return imageInvalid();
    while (bytes[offset] === 255) offset++;
    if (offset >= bytes.length) return imageInvalid();
    const marker = bytes[offset++];
    if (entropy && (marker === 0 || marker >= 208 && marker <= 215)) { entropySize++; continue; }
    if (entropy && !entropySize) return imageInvalid();
    entropy = false;
    if (marker === 217) {
      if (!dimensions || !scans || offset !== bytes.length) return imageInvalid();
      return dimensions;
    }
    if (marker === 0 || marker === 216 || marker === 1 || marker >= 208 && marker <= 215 || offset + 2 > bytes.length) return imageInvalid();
    const length = imageU16(bytes, offset), start = offset + 2, end = offset + length;
    if (length < 2 || end > bytes.length) return imageInvalid();
    if ([192, 193, 194].includes(marker)) {
      if (dimensions || length < 11 || bytes[start] !== 8) return imageInvalid();
      dimensions = imageDimensions(imageU16(bytes, start + 3), imageU16(bytes, start + 1));
      components = bytes[start + 5];
      if (components < 1 || components > 4 || length !== 8 + 3 * components) return imageInvalid();
    } else if (marker === 218) {
      const count = bytes[start];
      if (!dimensions || !quantization || !huffman || count < 1 || count > components || length !== 6 + 2 * count) return imageInvalid();
      scans++; entropy = true; entropySize = 0;
    } else if (marker === 219) {
      let cursor = start;
      while (cursor < end) { const table = bytes[cursor++]; if (table >> 4 > 1 || (table & 15) > 3) return imageInvalid(); cursor += table >> 4 ? 128 : 64; }
      if (cursor !== end || start === end) return imageInvalid();
      quantization = true;
    } else if (marker === 196) {
      let cursor = start;
      while (cursor < end) {
        const table = bytes[cursor++];
        if (table >> 4 > 1 || (table & 15) > 3 || cursor + 16 > end) return imageInvalid();
        let symbols = 0; for (let index = 0; index < 16; index++) symbols += bytes[cursor++];
        if (!symbols || symbols > 256) return imageInvalid(); cursor += symbols;
      }
      if (cursor !== end || start === end) return imageInvalid();
      huffman = true;
    } else if (marker === 221) {
      if (length !== 4) return imageInvalid();
    } else if (!(marker >= 224 && marker <= 239 || marker === 254)) return imageInvalid();
    offset = end;
  }
  return imageInvalid();
}
function imageWebp(bytes) {
  if (bytes.length < 26 || imageTag(bytes, 0) !== 'RIFF' || imageTag(bytes, 8) !== 'WEBP' || imageLE32(bytes, 4) + 8 !== bytes.length) return imageInvalid();
  let offset = 12, canvas, dimensions, alpha = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return imageInvalid();
    const tag = imageTag(bytes, offset), length = imageLE32(bytes, offset + 4), start = offset + 8, end = start + length;
    if (end > bytes.length || end + (length & 1) > bytes.length || length & 1 && bytes[end] !== 0 || ['ANIM', 'ANMF'].includes(tag)) return imageInvalid();
    if (tag === 'VP8X') {
      if (offset !== 12 || canvas || length !== 10 || bytes[start] & 0xc3 || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) return imageInvalid();
      canvas = imageDimensions(1 + bytes[start + 4] + bytes[start + 5] * 256 + bytes[start + 6] * 65536, 1 + bytes[start + 7] + bytes[start + 8] * 256 + bytes[start + 9] * 65536);
    } else if (tag === 'VP8 ') {
      if (dimensions || length < 11 || bytes[start] & 1 || !(bytes[start] & 16) || ((bytes[start] >> 1) & 7) > 3 || bytes[start + 3] !== 157 || bytes[start + 4] !== 1 || bytes[start + 5] !== 42) return imageInvalid();
      const partition = (bytes[start] + bytes[start + 1] * 256 + bytes[start + 2] * 65536) >>> 5;
      if (!partition || partition > length - 10) return imageInvalid();
      dimensions = imageDimensions((bytes[start + 6] + bytes[start + 7] * 256) & 0x3fff, (bytes[start + 8] + bytes[start + 9] * 256) & 0x3fff);
    } else if (tag === 'VP8L') {
      if (dimensions || length < 6 || bytes[start] !== 47 || bytes[start + 4] >> 5) return imageInvalid();
      const packed = imageLE32(bytes, start + 1);
      dimensions = imageDimensions(1 + (packed & 0x3fff), 1 + (packed >>> 14 & 0x3fff));
    } else if (tag === 'ALPH') {
      if (!canvas || alpha || dimensions || !length) return imageInvalid(); alpha = true;
    } else if (!canvas || !['ICCP', 'EXIF', 'XMP '].includes(tag)) return imageInvalid();
    offset = end + (length & 1);
  }
  if (!dimensions || canvas && (canvas.width !== dimensions.width || canvas.height !== dimensions.height)) return imageInvalid();
  return dimensions;
}
export function validateApplicationImage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'mime_type') || !Object.hasOwn(value, 'data') || !['image/png', 'image/jpeg', 'image/webp'].includes(value.mime_type) || typeof value.data !== 'string' || !value.data) return imageInvalid();
  const encoded = value.data;
  if (encoded.length > 4 * Math.ceil(applicationImageMaxBytes / 3)) throw new ApplicationImageError(413, 'La imagen supera el límite de 5 MiB. Reduce su tamaño antes de enviarla.');
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  if (encoded.length % 4 || /[^A-Za-z0-9+/]/.test(encoded.slice(0, encoded.length - padding))) return imageInvalid();
  let raw;
  try { raw = atob(encoded); } catch { return imageInvalid(); }
  if (!raw.length || raw.length > applicationImageMaxBytes) throw new ApplicationImageError(413, 'La imagen supera el límite de 5 MiB. Reduce su tamaño antes de enviarla.');
  if (btoa(raw) !== encoded) return imageInvalid();
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  const dimensions = value.mime_type === 'image/png' ? imagePng(bytes) : value.mime_type === 'image/jpeg' ? imageJpeg(bytes) : imageWebp(bytes);
  return { mime_type: value.mime_type, data: encoded, ...dimensions, size: bytes.length };
}
