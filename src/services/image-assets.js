import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
export class AssetError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export const safeKey = (key) => /^[a-f0-9-]{36}\.png$/.test(key);

export async function decodeAsset(file, slot) {
  const extension = /\.([a-z0-9]+)$/i.exec(file.originalname)?.[1].toLowerCase();
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  if (!types[extension] || types[extension] !== file.mimetype || file.size > 10 * 1024 * 1024) throw new AssetError(`${slot.label}: use PNG, JPEG or WebP, up to 10 MB.`);
  const b = file.buffer;
  const format = b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' :
    b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'jpeg' :
      b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP' ? 'webp' : null;
  if (types[extension] !== `image/${format}`) throw new AssetError(`${slot.label}: image contents do not match its file type.`);
  try {
    const image = sharp(b, { limitInputPixels: 16000000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages || 1) !== 1) throw new Error();
    const max = slot.key === 'favicon' ? 256 : 2400;
    image.rotate();
    // Keep QR pixels intact; scaling a code may make it harder to scan.
    if (slot.key !== 'donation_qr' && slot.key !== 'receipt') image.resize({width: max, height: max, fit: 'inside', withoutEnlargement: true});
    const { data, info } = await image.png().toBuffer({ resolveWithObject: true });
    if (data.length > 12 * 1024 * 1024) throw new Error();
    return { data, metadata: {storage_key: `${randomUUID()}.png`, mime_type: 'image/png', size_bytes: data.length, width: info.width, height: info.height} };
  } catch { throw new AssetError(`${slot.label}: use a valid, non-animated image no larger than 16 megapixels.`); }
}

