// Lectura y escritura de archivos zip (formato de los .dialog.ar) sin dependencias:
// el (des)inflado lo hacen CompressionStream / DecompressionStream del navegador (y de Node ≥ 18).

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < bytes.length; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function supportsDeflateRaw() {
  try { new DecompressionStream('deflate-raw'); return true; } catch (error) { return false; }
}

async function transform(bytes, streamClass) {
  const stream = new Blob([bytes]).stream().pipeThrough(new streamClass('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// En Node viejo (< 21) no existe 'deflate-raw' en los streams: se usa zlib. En el navegador nunca se llega acá.
async function nodeZlib() {
  return import('node:zlib');
}

export async function inflateRaw(bytes) {
  if (supportsDeflateRaw()) return transform(bytes, DecompressionStream);
  const zlib = await nodeZlib();
  return new Uint8Array(zlib.inflateRawSync(bytes));
}

export async function deflateRaw(bytes) {
  if (supportsDeflateRaw()) return transform(bytes, CompressionStream);
  const zlib = await nodeZlib();
  return new Uint8Array(zlib.deflateRawSync(bytes));
}

// Codifica en Latin-1 (lo que lee Cuis) si todos los caracteres entran; si no, UTF-8.
export function encodeText(text) {
  if ([...text].every(character => character.charCodeAt(0) <= 0xFF)) {
    return Uint8Array.from(text, character => character.charCodeAt(0));
  }
  return new TextEncoder().encode(text);
}

export class ZipEntry {
  constructor(name, { method, compressedBytes, uncompressedSize, crc }) {
    this.name = name;
    this.method = method;
    this.compressedBytes = compressedBytes;
    this.uncompressedSize = uncompressedSize;
    this.crc = crc;
  }

  async bytes() {
    if (this.method === METHOD_STORED) return this.compressedBytes;
    if (this.method === METHOD_DEFLATE) return inflateRaw(this.compressedBytes);
    throw new Error('Unsupported zip compression method ' + this.method);
  }

  // Los archivos de Cuis vienen en Latin-1; si los bytes son UTF-8 válido se usa UTF-8.
  async text() {
    const bytes = await this.bytes();
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (error) {
      return new TextDecoder('latin1').decode(bytes);
    }
  }
}

export class ZipArchive {
  constructor() {
    this.entries = new Map();
  }

  static fromBytes(source) {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const archive = new ZipArchive();
    let endOfCentralDirectory = -1;
    for (let offset = bytes.length - 22; offset >= 0; offset--) {
      if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) { endOfCentralDirectory = offset; break; }
    }
    if (endOfCentralDirectory < 0) throw new Error('Not a zip file');
    const entriesTotal = view.getUint16(endOfCentralDirectory + 10, true);
    let offset = view.getUint32(endOfCentralDirectory + 16, true);
    const decoder = new TextDecoder('utf-8');
    for (let index = 0; index < entriesTotal; index++) {
      if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_HEADER) throw new Error('Corrupt zip central directory');
      const method = view.getUint16(offset + 10, true);
      const crc = view.getUint32(offset + 16, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
      if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER) throw new Error('Corrupt zip local header');
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressedBytes = bytes.subarray(dataStart, dataStart + compressedSize);
      if (!name.endsWith('/')) archive.entries.set(name, new ZipEntry(name, { method, compressedBytes, uncompressedSize, crc }));
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return archive;
  }

  names() { return [...this.entries.keys()]; }
  has(name) { return this.entries.has(name); }
  entry(name) {
    const entry = this.entries.get(name);
    if (entry === undefined) throw new Error('No file named ' + name + ' in archive');
    return entry;
  }
  async bytes(name) { return this.entry(name).bytes(); }
  async text(name) { return this.entry(name).text(); }

  // files: [{ name, bytes: Uint8Array }] → Uint8Array con el zip (deflate).
  static async write(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
      const compressed = await deflateRaw(data);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, LOCAL_FILE_HEADER, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);
      local.setUint16(8, METHOD_DEFLATE, true);
      local.setUint16(10, 0, true);
      local.setUint16(12, 0x21, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, compressed.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), nameBytes, compressed);
      const header = new DataView(new ArrayBuffer(46));
      header.setUint32(0, CENTRAL_DIRECTORY_HEADER, true);
      header.setUint16(4, 20, true);
      header.setUint16(6, 20, true);
      header.setUint16(8, 0x0800, true);
      header.setUint16(10, METHOD_DEFLATE, true);
      header.setUint16(12, 0, true);
      header.setUint16(14, 0x21, true);
      header.setUint32(16, crc, true);
      header.setUint32(20, compressed.length, true);
      header.setUint32(24, data.length, true);
      header.setUint16(28, nameBytes.length, true);
      header.setUint16(30, 0, true);
      header.setUint16(32, 0, true);
      header.setUint16(34, 0, true);
      header.setUint16(36, 0, true);
      header.setUint32(38, 0, true);
      header.setUint32(42, offset, true);
      central.push(new Uint8Array(header.buffer), nameBytes);
      offset += 30 + nameBytes.length + compressed.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const result = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let position = 0;
    for (const part of all) { result.set(part, position); position += part.length; }
    return result;
  }
}
