/** Little-endian reads on a byte slice (Buffer or Uint8Array in RN). */
export function dataView(buf: Uint8Array): DataView {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function safeGetLabel<T extends Record<number, string>>(
  map: T,
  key: number,
  fallback = 'Unknown'
): string {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

export function safeReadString(buf: Uint8Array, offset: number, length: number): string {
  const end = clamp(offset + length, 0, buf.length);
  let s = '';
  for (let i = offset; i < end; i += 1) {
    const c = buf[i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

export function toUint8Array(msg: unknown): Uint8Array | null {
  if (!msg) return null;
  if (msg instanceof Uint8Array) return msg;
  if (typeof msg === 'object' && msg !== null && 'buffer' in msg) {
    const u = msg as { buffer: ArrayBufferLike; byteOffset?: number; byteLength?: number };
    return new Uint8Array(u.buffer, u.byteOffset ?? 0, u.byteLength ?? 0);
  }
  return null;
}
