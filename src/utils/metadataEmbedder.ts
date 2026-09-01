/**
 * Lossless EXIF / IPTC / XMP Metadata Embedder for JPEG and PNG images
 * Embeds Title, Subject (Topic), 5-Star Rating, Tags (Keywords), and Comments (Description)
 * directly into image binary headers with 0% quality loss.
 * Enables direct marketplace upload (Adobe Stock, Shutterstock, Freepik, etc.)
 * without requiring secondary CSV files, and fills Windows File Properties Details.
 */

// Helper: Convert string to UTF-16LE Uint8Array for Windows XP EXIF tags
function stringToUtf16LE(str: string, nullTerminate: boolean = true): Uint8Array {
  const len = str.length + (nullTerminate ? 1 : 0);
  const bytes = new Uint8Array(len * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  if (nullTerminate) {
    bytes[str.length * 2] = 0;
    bytes[str.length * 2 + 1] = 0;
  }
  return bytes;
}

// Helper: String to ASCII Uint8Array with null terminator
function stringToAscii(str: string, nullTerminate: boolean = true): Uint8Array {
  const len = str.length + (nullTerminate ? 1 : 0);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0x7f;
  }
  if (nullTerminate) bytes[str.length] = 0;
  return bytes;
}

// XML entity escape
function escapeXml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// CRC32 table for PNG chunk writing
const crcTable = (() => {
  const cTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    cTable[n] = c;
  }
  return cTable;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface EmbedMetadataParams {
  title: string;
  topic?: string;
  category?: string;
  description: string;
  keywords: string[];
  rating?: number; // default 5 (5 stars)
}

/**
 * Creates Adobe XMP XML packet
 */
export function createXmpPacket(params: EmbedMetadataParams): string {
  const { title, topic, category, description, keywords, rating = 5 } = params;
  const safeTopic = topic || category || 'General Stock';

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(description)}</rdf:li>
        </rdf:Alt>
      </dc:description>
      <dc:subject>
        <rdf:Bag>
          ${keywords.map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`).join('\n          ')}
        </rdf:Bag>
      </dc:subject>
      <xmp:Rating>${rating}</xmp:Rating>
      <photoshop:Headline>${escapeXml(title)}</photoshop:Headline>
      <photoshop:Category>${escapeXml(safeTopic)}</photoshop:Category>
      <photoshop:Credit>FarukStock</photoshop:Credit>
      <photoshop:Source>FarukStock SEO</photoshop:Source>
      <photoshop:CaptionWriter>FarukStock Contributor</photoshop:CaptionWriter>
      <Iptc4xmpCore:SubjectCode>${escapeXml(safeTopic)}</Iptc4xmpCore:SubjectCode>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Creates Little-Endian EXIF APP1 payload with Windows XP Properties (Title, Subject, Rating, Tags, Comments)
 */
export function createExifApp1Segment(params: EmbedMetadataParams): Uint8Array {
  const { title, topic, description, keywords, rating = 5 } = params;
  const safeTopic = topic || 'Stock Topic';
  const tagsList = (keywords || []).join('; ');

  // Value buffers
  const descBytes = stringToAscii(description || title, true);
  const artistBytes = stringToAscii('FarukStock Contributor', true);
  const softwareBytes = stringToAscii('FarukStock AI SEO Studio', true);
  const xpTitleBytes = stringToUtf16LE(title || '', true);
  const xpSubjectBytes = stringToUtf16LE(safeTopic, true);
  const xpCommentBytes = stringToUtf16LE(description || title, true);
  const xpKeywordsBytes = stringToUtf16LE(tagsList, true);

  // IFD0 entries structure
  interface TagSpec {
    tag: number;
    type: number; // 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 7=UNDEFINED
    count: number;
    valueOrOffset: number;
    extraData?: Uint8Array;
  }

  const entries: TagSpec[] = [];

  // 0x010E ImageDescription (ASCII)
  entries.push({
    tag: 0x010e,
    type: 2,
    count: descBytes.length,
    valueOrOffset: 0,
    extraData: descBytes,
  });

  // 0x0131 Software (ASCII)
  entries.push({
    tag: 0x0131,
    type: 2,
    count: softwareBytes.length,
    valueOrOffset: 0,
    extraData: softwareBytes,
  });

  // 0x013B Artist (ASCII)
  entries.push({
    tag: 0x013b,
    type: 2,
    count: artistBytes.length,
    valueOrOffset: 0,
    extraData: artistBytes,
  });

  // 0x4746 Rating (SHORT: 5)
  entries.push({
    tag: 0x4746,
    type: 3,
    count: 1,
    valueOrOffset: rating,
  });

  // 0x4749 RatingPercent (SHORT: 99)
  entries.push({
    tag: 0x4749,
    type: 3,
    count: 1,
    valueOrOffset: 99,
  });

  // 0x9C9B XPTitle (UNDEFINED) -> Windows Title
  entries.push({
    tag: 0x9c9b,
    type: 7,
    count: xpTitleBytes.length,
    valueOrOffset: 0,
    extraData: xpTitleBytes,
  });

  // 0x9C9C XPComment (UNDEFINED) -> Windows Comments
  entries.push({
    tag: 0x9c9c,
    type: 7,
    count: xpCommentBytes.length,
    valueOrOffset: 0,
    extraData: xpCommentBytes,
  });

  // 0x9C9E XPKeywords (UNDEFINED) -> Windows Tags
  entries.push({
    tag: 0x9c9e,
    type: 7,
    count: xpKeywordsBytes.length,
    valueOrOffset: 0,
    extraData: xpKeywordsBytes,
  });

  // 0x9C9F XPSubject (UNDEFINED) -> Windows Subject (Topic)
  entries.push({
    tag: 0x9c9f,
    type: 7,
    count: xpSubjectBytes.length,
    valueOrOffset: 0,
    extraData: xpSubjectBytes,
  });

  // Sort tags in ascending order (required by TIFF spec)
  entries.sort((a, b) => a.tag - b.tag);

  // Calculate offsets
  // Exif header: 6 bytes ("Exif\0\0")
  // TIFF header: 8 bytes (0..7 inside TIFF body)
  // IFD0: 2 bytes count + (entries.length * 12) + 4 bytes next IFD offset (0)
  const ifd0Start = 8;
  const numEntries = entries.length;
  const ifd0Size = 2 + numEntries * 12 + 4;
  let currentExtraOffset = ifd0Start + ifd0Size;

  // Assign offsets to extraData
  for (const entry of entries) {
    if (entry.extraData) {
      if (entry.extraData.length <= 4) {
        // Fits directly into valueOrOffset field
        let val = 0;
        for (let i = 0; i < entry.extraData.length; i++) {
          val |= entry.extraData[i] << (i * 8);
        }
        entry.valueOrOffset = val;
      } else {
        entry.valueOrOffset = currentExtraOffset;
        currentExtraOffset += entry.extraData.length;
        // Align 2-byte boundary
        if (currentExtraOffset % 2 !== 0) currentExtraOffset++;
      }
    }
  }

  const tiffTotalSize = currentExtraOffset;
  const exifSegmentLength = 2 + 6 + tiffTotalSize; // 2 bytes length + 6 bytes "Exif\0\0" + tiff
  const segment = new Uint8Array(2 + exifSegmentLength); // 0xFF, 0xE1 + length + payload

  // Marker 0xFF, 0xE1
  segment[0] = 0xff;
  segment[1] = 0xe1;
  // Segment length (big endian, includes length bytes)
  segment[2] = (exifSegmentLength >> 8) & 0xff;
  segment[3] = exifSegmentLength & 0xff;

  // "Exif\0\0"
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  for (let i = 0; i < 6; i++) {
    segment[4 + i] = exifHeader[i];
  }

  // TIFF Header at offset 10: "II\x2A\x00\x08\x00\x00\x00" (Little Endian)
  const tiffBase = 10;
  segment[tiffBase + 0] = 0x49; // 'I'
  segment[tiffBase + 1] = 0x49; // 'I'
  segment[tiffBase + 2] = 0x2a; // 42
  segment[tiffBase + 3] = 0x00;
  segment[tiffBase + 4] = 0x08; // Offset to IFD0 (8)
  segment[tiffBase + 5] = 0x00;
  segment[tiffBase + 6] = 0x00;
  segment[tiffBase + 7] = 0x00;

  // Write IFD0 entry count
  let ptr = tiffBase + 8;
  segment[ptr++] = numEntries & 0xff;
  segment[ptr++] = (numEntries >> 8) & 0xff;

  // Write Entries
  for (const entry of entries) {
    // Tag (2 bytes)
    segment[ptr++] = entry.tag & 0xff;
    segment[ptr++] = (entry.tag >> 8) & 0xff;
    // Type (2 bytes)
    segment[ptr++] = entry.type & 0xff;
    segment[ptr++] = (entry.type >> 8) & 0xff;
    // Count (4 bytes)
    segment[ptr++] = entry.count & 0xff;
    segment[ptr++] = (entry.count >> 8) & 0xff;
    segment[ptr++] = (entry.count >> 16) & 0xff;
    segment[ptr++] = (entry.count >> 24) & 0xff;
    // Value/Offset (4 bytes)
    segment[ptr++] = entry.valueOrOffset & 0xff;
    segment[ptr++] = (entry.valueOrOffset >> 8) & 0xff;
    segment[ptr++] = (entry.valueOrOffset >> 16) & 0xff;
    segment[ptr++] = (entry.valueOrOffset >> 24) & 0xff;
  }

  // Next IFD offset (4 bytes 0)
  segment[ptr++] = 0;
  segment[ptr++] = 0;
  segment[ptr++] = 0;
  segment[ptr++] = 0;

  // Write Extra Data
  for (const entry of entries) {
    if (entry.extraData && entry.extraData.length > 4) {
      const targetPos = tiffBase + entry.valueOrOffset;
      segment.set(entry.extraData, targetPos);
    }
  }

  return segment;
}

/**
 * Creates XMP APP1 segment for JPEG
 */
export function createXmpApp1Segment(params: EmbedMetadataParams): Uint8Array {
  const xmpXml = createXmpPacket(params);
  const xmpHeader = stringToAscii('http://ns.adobe.com/xap/1.0/', true);
  const xmlBytes = new TextEncoder().encode(xmpXml);

  const payloadSize = xmpHeader.length + xmlBytes.length;
  const segmentLength = 2 + payloadSize;
  const segment = new Uint8Array(2 + segmentLength);

  // 0xFF, 0xE1
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;

  segment.set(xmpHeader, 4);
  segment.set(xmlBytes, 4 + xmpHeader.length);

  return segment;
}

/**
 * Creates IPTC APP13 segment for JPEG
 */
export function createIptcApp13Segment(params: EmbedMetadataParams): Uint8Array {
  const { title, topic, description, keywords } = params;
  const safeTopic = topic || 'Stock Topic';

  // Build IPTC IIM records
  const iptcRecords: Uint8Array[] = [];

  const addRecord = (recordNum: number, datasetNum: number, dataStr: string) => {
    if (!dataStr) return;
    const strBytes = new TextEncoder().encode(dataStr);
    const rec = new Uint8Array(5 + strBytes.length);
    rec[0] = 0x1c; // Tag marker
    rec[1] = recordNum;
    rec[2] = datasetNum;
    rec[3] = (strBytes.length >> 8) & 0xff;
    rec[4] = strBytes.length & 0xff;
    rec.set(strBytes, 5);
    iptcRecords.push(rec);
  };

  // 2:05 Object Name (Title)
  addRecord(2, 5, title);
  // 2:15 Category (Topic)
  addRecord(2, 15, safeTopic.slice(0, 3));
  // 2:20 Supplemental Category
  addRecord(2, 20, safeTopic);
  // 2:25 Keywords (each keyword)
  keywords.forEach((k) => addRecord(2, 25, k));
  // 2:105 Headline
  addRecord(2, 105, title);
  // 2:120 Caption-Abstract
  addRecord(2, 120, description || title);

  // Total IPTC IIM size
  let iptcTotalLen = 0;
  iptcRecords.forEach((r) => (iptcTotalLen += r.length));
  const iptcData = new Uint8Array(iptcTotalLen);
  let p = 0;
  iptcRecords.forEach((r) => {
    iptcData.set(r, p);
    p += r.length;
  });

  // Photoshop 3.0 8BIM Resource
  // Header: "Photoshop 3.0\0" (14 bytes)
  const psHeader = [0x50, 0x68, 0x6f, 0x74, 0x6f, 0x73, 0x68, 0x6f, 0x70, 0x20, 0x33, 0x2e, 0x30, 0x00];
  // 8BIM marker (4 bytes: "8BIM"), Resource ID (2 bytes: 0x0404 = IPTC), Name (2 bytes: 0x00 0x00), Size (4 bytes)
  const bimHeaderLen = 4 + 2 + 2 + 4;
  const padByte = iptcData.length % 2 !== 0 ? 1 : 0;
  const bimBlockLen = bimHeaderLen + iptcData.length + padByte;

  const payloadLen = psHeader.length + bimBlockLen;
  const segmentLen = 2 + payloadLen;
  const segment = new Uint8Array(2 + segmentLen);

  // 0xFF, 0xED
  segment[0] = 0xff;
  segment[1] = 0xed;
  segment[2] = (segmentLen >> 8) & 0xff;
  segment[3] = segmentLen & 0xff;

  let off = 4;
  segment.set(psHeader, off);
  off += psHeader.length;

  // "8BIM"
  segment[off++] = 0x38;
  segment[off++] = 0x42;
  segment[off++] = 0x49;
  segment[off++] = 0x4d;
  // Resource ID: 0x0404 (IPTC-NAA)
  segment[off++] = 0x04;
  segment[off++] = 0x04;
  // Pascal String name (empty: 0x00, 0x00)
  segment[off++] = 0x00;
  segment[off++] = 0x00;
  // Data size (4 bytes big-endian)
  segment[off++] = (iptcData.length >> 24) & 0xff;
  segment[off++] = (iptcData.length >> 16) & 0xff;
  segment[off++] = (iptcData.length >> 8) & 0xff;
  segment[off++] = iptcData.length & 0xff;

  segment.set(iptcData, off);

  return segment;
}

/**
 * Embeds EXIF, IPTC, and XMP metadata into a JPEG binary buffer losslessly
 */
export function embedMetadataInJpeg(
  jpegBytes: Uint8Array,
  metadata: EmbedMetadataParams
): Uint8Array {
  if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    // Not a valid JPEG, return as-is
    return jpegBytes;
  }

  // Create segments
  const exifSegment = createExifApp1Segment(metadata);
  const xmpSegment = createXmpApp1Segment(metadata);
  const iptcSegment = createIptcApp13Segment(metadata);

  // Find position right after SOI (offset 2) or after JFIF/APP0
  let insertPos = 2;
  if (jpegBytes[2] === 0xff && jpegBytes[3] === 0xe0) {
    // Has APP0/JFIF, skip it so JFIF stays first
    const app0Len = (jpegBytes[4] << 8) | jpegBytes[5];
    insertPos = 2 + 2 + app0Len;
  }

  // Scan and strip old EXIF, XMP, IPTC segments to prevent duplicate conflicts
  const parts: Uint8Array[] = [jpegBytes.slice(0, insertPos)];
  parts.push(exifSegment);
  parts.push(xmpSegment);
  parts.push(iptcSegment);

  let offset = insertPos;
  while (offset < jpegBytes.length - 1) {
    if (jpegBytes[offset] !== 0xff) {
      parts.push(jpegBytes.slice(offset));
      break;
    }

    const marker = jpegBytes[offset + 1];
    // SOS (Start of Scan) or EOI (End of Image) -> copy rest and finish
    if (marker === 0xda || marker === 0xd9) {
      parts.push(jpegBytes.slice(offset));
      break;
    }

    // Segment length includes 2 bytes of length
    const segLen = (jpegBytes[offset + 2] << 8) | jpegBytes[offset + 3];
    const totalSegSize = 2 + segLen;

    // Check if this segment is old Exif/XMP (0xFFE1) or IPTC (0xFFED)
    const isOldExifOrXmp = marker === 0xe1;
    const isOldIptc = marker === 0xed;

    if (!isOldExifOrXmp && !isOldIptc) {
      // Keep other segments intact (quantization tables, frames, comments, etc.)
      parts.push(jpegBytes.slice(offset, offset + totalSegSize));
    }

    offset += totalSegSize;
  }

  // Combine into single Uint8Array
  let totalLength = 0;
  parts.forEach((p) => (totalLength += p.length));
  const result = new Uint8Array(totalLength);
  let cur = 0;
  parts.forEach((p) => {
    result.set(p, cur);
    cur += p.length;
  });

  return result;
}

/**
 * Embeds XMP and tEXt chunks into a PNG binary buffer losslessly
 */
export function embedMetadataInPng(
  pngBytes: Uint8Array,
  metadata: EmbedMetadataParams
): Uint8Array {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    pngBytes[0] !== 0x89 ||
    pngBytes[1] !== 0x50 ||
    pngBytes[2] !== 0x4e ||
    pngBytes[3] !== 0x47
  ) {
    return pngBytes;
  }

  const { title, topic, description, keywords } = metadata;
  const safeTopic = topic || 'Stock Topic';

  // Helper to build a PNG chunk
  const createChunk = (type: string, data: Uint8Array): Uint8Array => {
    const chunkLen = data.length;
    const chunk = new Uint8Array(4 + 4 + chunkLen + 4);
    // Length (4 bytes big-endian)
    chunk[0] = (chunkLen >> 24) & 0xff;
    chunk[1] = (chunkLen >> 16) & 0xff;
    chunk[2] = (chunkLen >> 8) & 0xff;
    chunk[3] = chunkLen & 0xff;
    // Chunk Type (4 bytes)
    for (let i = 0; i < 4; i++) {
      chunk[4 + i] = type.charCodeAt(i);
    }
    // Data
    chunk.set(data, 8);
    // CRC (Type + Data)
    const crcVal = crc32(chunk.slice(4, 8 + chunkLen));
    const crcPos = 8 + chunkLen;
    chunk[crcPos] = (crcVal >> 24) & 0xff;
    chunk[crcPos + 1] = (crcVal >> 16) & 0xff;
    chunk[crcPos + 2] = (crcVal >> 8) & 0xff;
    chunk[crcPos + 3] = crcVal & 0xff;
    return chunk;
  };

  const createTextChunk = (keyword: string, text: string): Uint8Array => {
    const enc = new TextEncoder();
    const keyBytes = enc.encode(keyword);
    const textBytes = enc.encode(text);
    const data = new Uint8Array(keyBytes.length + 1 + textBytes.length);
    data.set(keyBytes, 0);
    data[keyBytes.length] = 0; // Null separator
    data.set(textBytes, keyBytes.length + 1);
    return createChunk('tEXt', data);
  };

  // Build XMP chunk (iTXt XML:com.adobe.xmp)
  const xmpXml = createXmpPacket(metadata);
  const xmpHeader = new TextEncoder().encode('XML:com.adobe.xmp\0\0\0\0\0');
  const xmpBody = new TextEncoder().encode(xmpXml);
  const xmpData = new Uint8Array(xmpHeader.length + xmpBody.length);
  xmpData.set(xmpHeader, 0);
  xmpData.set(xmpBody, xmpHeader.length);
  const xmpChunk = createChunk('iTXt', xmpData);

  // Standard PNG tEXt chunks
  const chunksToAdd: Uint8Array[] = [
    createTextChunk('Title', title),
    createTextChunk('Subject', safeTopic),
    createTextChunk('Topic', safeTopic),
    createTextChunk('Author', 'FarukStock Contributor'),
    createTextChunk('Description', description || title),
    createTextChunk('Comment', description || title),
    createTextChunk('Keywords', (keywords || []).join(', ')),
    xmpChunk,
  ];

  // Find IHDR chunk (starts at offset 8, 8 bytes sig + 4 len + 4 type + 13 data + 4 crc = 33)
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;

  const resultLength = pngBytes.length + chunksToAdd.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(resultLength);

  // Copy signature and IHDR
  result.set(pngBytes.slice(0, ihdrEnd), 0);
  let cur = ihdrEnd;

  // Insert our metadata chunks right after IHDR
  for (const chunk of chunksToAdd) {
    result.set(chunk, cur);
    cur += chunk.length;
  }

  // Copy the rest of the PNG
  result.set(pngBytes.slice(ihdrEnd), cur);

  return result;
}

/**
 * Master function to inject metadata into any Image File or Blob losslessly
 */
export async function injectMetadataIntoFile(
  fileOrBlob: Blob,
  filename: string,
  metadata: EmbedMetadataParams
): Promise<{ blob: Blob; buffer: Uint8Array }> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);
  const lowerName = filename.toLowerCase();

  let processedBytes: Uint8Array = rawBytes;

  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    processedBytes = embedMetadataInJpeg(rawBytes, metadata);
  } else if (lowerName.endsWith('.png')) {
    processedBytes = embedMetadataInPng(rawBytes, metadata);
  }

  const mimeType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const newBlob = new Blob([processedBytes], { type: mimeType });

  return { blob: newBlob, buffer: processedBytes };
}
