// Client-side AES-256-GCM encryption for sensitive PII and health profiles
// Uses Web Crypto API (PBKDF2 + AES-GCM) before storing payloads in Firestore

const APP_PEPPER = 'KasWargaRT-AES256-Shield-2026';

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(uid: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${uid}:${APP_PEPPER}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSensitiveJson<T>(uid: string, payload: T): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(uid, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoded
  );

  return JSON.stringify({
    v: 1,
    s: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ct: bufferToBase64(ciphertext),
  });
}

export async function decryptSensitiveJson<T>(uid: string, encryptedString: string): Promise<T | null> {
  try {
    const parsed = JSON.parse(encryptedString) as { v: number; s: string; iv: string; ct: string };
    if (!parsed?.s || !parsed?.iv || !parsed?.ct) return null;
    const salt = base64ToBuffer(parsed.s);
    const iv = base64ToBuffer(parsed.iv);
    const ct = base64ToBuffer(parsed.ct);
    const key = await deriveAesKey(uid, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ct as unknown as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export function compressProofImage(file: File, maxDimension = 960, quality = 0.68): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 340000) {
          resolve(canvas.toDataURL('image/jpeg', 0.48));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function compressBannerSlideImage(
  file: File,
  maxDimension = 1280,
  initialQuality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`File "${file.name}" bukan gambar yang valid.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`Format gambar "${file.name}" tidak dapat diproses.`));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia di browser ini.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const qualities = [initialQuality, 0.65, 0.52, 0.4];
        let result = canvas.toDataURL('image/jpeg', qualities[0]);
        for (let i = 1; i < qualities.length && result.length > 420000; i++) {
          result = canvas.toDataURL('image/jpeg', qualities[i]);
        }

        if (result.length > 440000) {
          const fallbackCanvas = document.createElement('canvas');
          const scale = 0.72;
          fallbackCanvas.width = Math.max(320, Math.round(width * scale));
          fallbackCanvas.height = Math.max(200, Math.round(height * scale));
          const fctx = fallbackCanvas.getContext('2d');
          if (fctx) {
            fctx.drawImage(canvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
            result = fallbackCanvas.toDataURL('image/jpeg', 0.55);
          }
        }
        resolve(result);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
