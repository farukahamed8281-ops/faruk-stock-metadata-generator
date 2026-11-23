/**
 * Lossless EXIF / IPTC / XMP Metadata Embedder for JPEG and PNG images
 * Embeds Title, Subject (Topic), 5-Star Rating, Tags (Keywords), and Comments (Description)
 * directly into image binary headers with 0% quality loss.
 * Enables direct marketplace upload (Adobe Stock, Shutterstock, Magnific, etc.)
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

// Helper: Clean common Unicode punctuation before ASCII conversion
function normalizeToAsciiSafe(str: string): string {
  return (str || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: String to ASCII Uint8Array with null terminator
function stringToAscii(str: string, nullTerminate: boolean = true): Uint8Array {
  const safe = normalizeToAsciiSafe(str);
  const len = safe.length + (nullTerminate ? 1 : 0);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < safe.length; i++) {
    bytes[i] = safe.charCodeAt(i) & 0x7f;
  }
  if (nullTerminate) bytes[safe.length] = 0;
  return bytes;
}

// Helper: Truncate a string to fit within a strict UTF-8 byte budget without cutting mid-word
function truncateUtf8Bytes(str: string, maxBytes: number): string {
  if (!str) return '';
  const enc = new TextEncoder();
  const clean = str.trim();
  if (enc.encode(clean).length <= maxBytes) return clean;
  let result = '';
  for (const ch of clean) {
    const next = result + ch;
    if (enc.encode(next).length > maxBytes) break;
    result = next;
  }
  const lastSpace = result.lastIndexOf(' ');
  if (lastSpace > Math.floor(result.length * 0.55)) {
    result = result.slice(0, lastSpace);
  }
  return result.replace(/[,;:\-\s]+$/, '').trim();
}

// Helper: Normalize and sanitize embedded metadata params before writing binary headers
const isPlaceholderTopic = (val?: string): boolean => {
  const norm = (val || '').trim().toLowerCase();
  return !norm || norm === 'general stock' || norm === 'stock design' || norm === 'stock topic' || norm === 'stock asset' || norm === 'general';
};

function normalizeEmbedMetadata(params: EmbedMetadataParams): EmbedMetadataParams {
  const cleanTitle = (params.title || '').replace(/\s+/g, ' ').trim();
  const cleanCategory = (params.category || '').replace(/\s+/g, ' ').trim();
  const rawTopic = (params.topic || '').replace(/\s+/g, ' ').trim();
  const safeTopic = (!isPlaceholderTopic(rawTopic) ? rawTopic : cleanCategory || rawTopic || 'Stock Media').trim();
  const safeCategory = (cleanCategory || safeTopic).trim();
  const safeDesc = (params.description || '').replace(/\s+/g, ' ').trim();

  const seenKw = new Set<string>();
  const cleanKeywords: string[] = [];
  for (const rawKw of params.keywords || []) {
    const kw = String(rawKw || '')
      .replace(/[\r\n,;"]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!kw) continue;
    const lower = kw.toLowerCase();
    if (!seenKw.has(lower)) {
      seenKw.add(lower);
      cleanKeywords.push(truncateUtf8Bytes(kw, 64));
    }
  }

  return {
    ...params,
    title: cleanTitle,
    topic: safeTopic,
    category: safeCategory,
    description: safeDesc,
    keywords: cleanKeywords,
  };
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
  author?: string; // Optional: completely blank by default
  software?: string; // Optional: completely blank by default
}

export interface ExtractedExifTags {
  make?: string;
  model?: string;
  orientation?: number;
  xResolution?: [number, number];
  yResolution?: [number, number];
  resolutionUnit?: number;
  dateTime?: string;
  dateTimeOriginal?: string;
  colorSpace?: number;
}

/**
 * Extracts essential non-conflicting camera/orientation/DPI/color/date tags from a source JPEG's original EXIF APP1 segment
 */
export function extractEssentialExifFromJpeg(jpegBytes: Uint8Array): ExtractedExifTags {
  const result: ExtractedExifTags = {};
  if (!jpegBytes || jpegBytes.length < 20 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    return result;
  }

  let offset = 2;
  while (offset + 4 < jpegBytes.length) {
    if (jpegBytes[offset] !== 0xff) break;
    while (offset + 1 < jpegBytes.length && jpegBytes[offset + 1] === 0xff) {
      offset++;
    }
    if (offset + 1 >= jpegBytes.length) break;
    const marker = jpegBytes[offset + 1];
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;
    if (offset + 3 >= jpegBytes.length) break;
    const segLen = (jpegBytes[offset + 2] << 8) | jpegBytes[offset + 3];
    if (segLen < 2 || offset + 2 + segLen > jpegBytes.length) break;

    // Look for "Exif\0\0" APP1 segment
    if (
      marker === 0xe1 &&
      segLen >= 16 &&
      jpegBytes[offset + 4] === 0x45 &&
      jpegBytes[offset + 5] === 0x78 &&
      jpegBytes[offset + 6] === 0x69 &&
      jpegBytes[offset + 7] === 0x66 &&
      jpegBytes[offset + 8] === 0x00 &&
      jpegBytes[offset + 9] === 0x00
    ) {
      const tiffBase = offset + 10;
      const segEnd = offset + 2 + segLen;
      if (tiffBase + 8 > segEnd) {
        offset += 2 + segLen;
        continue;
      }

      const b0 = jpegBytes[tiffBase];
      const b1 = jpegBytes[tiffBase + 1];
      const isLE = b0 === 0x49 && b1 === 0x49;
      const isBE = b0 === 0x4d && b1 === 0x4d;
      if (!isLE && !isBE) {
        offset += 2 + segLen;
        continue;
      }

      const readU16 = (pos: number) =>
        isLE
          ? jpegBytes[pos] | (jpegBytes[pos + 1] << 8)
          : (jpegBytes[pos] << 8) | jpegBytes[pos + 1];
      const readU32 = (pos: number) =>
        isLE
          ? (jpegBytes[pos] |
              (jpegBytes[pos + 1] << 8) |
              (jpegBytes[pos + 2] << 16) |
              (jpegBytes[pos + 3] << 24)) >>> 0
          : (((jpegBytes[pos] << 24) |
              (jpegBytes[pos + 1] << 16) |
              (jpegBytes[pos + 2] << 8) |
              jpegBytes[pos + 3]) >>> 0);

      const readAsciiTag = (entryPos: number, type: number, count: number): string | undefined => {
        if (type !== 2 || count <= 0 || count > 256) return undefined;
        let dataStart = entryPos + 8;
        if (count > 4) {
          const valOffset = readU32(entryPos + 8);
          dataStart = tiffBase + valOffset;
        }
        if (dataStart < tiffBase || dataStart + count > segEnd) return undefined;
        let str = '';
        for (let i = 0; i < count; i++) {
          const ch = jpegBytes[dataStart + i];
          if (ch === 0) break;
          if (ch >= 0x20 && ch <= 0x7e) str += String.fromCharCode(ch);
        }
        return str.trim() || undefined;
      };

      const readRationalTag = (entryPos: number, type: number, count: number): [number, number] | undefined => {
        if (type !== 5 || count !== 1) return undefined;
        const valOffset = readU32(entryPos + 8);
        const dataStart = tiffBase + valOffset;
        if (dataStart < tiffBase || dataStart + 8 > segEnd) return undefined;
        const num = readU32(dataStart);
        const den = readU32(dataStart + 4);
        if (den === 0) return undefined;
        return [num, den];
      };

      const ifd0Offset = readU32(tiffBase + 4);
      const ifd0Pos = tiffBase + ifd0Offset;
      if (ifd0Pos + 2 > segEnd) break;
      const numIfd0 = Math.min(200, readU16(ifd0Pos));
      let exifSubIfdOffset = 0;

      for (let i = 0; i < numIfd0; i++) {
        const ePos = ifd0Pos + 2 + i * 12;
        if (ePos + 12 > segEnd) break;
        const tag = readU16(ePos);
        const type = readU16(ePos + 2);
        const count = readU32(ePos + 4);

        if (tag === 0x010f) result.make = readAsciiTag(ePos, type, count) ?? result.make;
        else if (tag === 0x0110) result.model = readAsciiTag(ePos, type, count) ?? result.model;
        else if (tag === 0x0112 && type === 3 && count === 1) {
          const orient = readU16(ePos + 8);
          if (orient >= 1 && orient <= 8) result.orientation = orient;
        } else if (tag === 0x011a) {
          result.xResolution = readRationalTag(ePos, type, count) ?? result.xResolution;
        } else if (tag === 0x011b) {
          result.yResolution = readRationalTag(ePos, type, count) ?? result.yResolution;
        } else if (tag === 0x0128 && type === 3 && count === 1) {
          const unit = readU16(ePos + 8);
          if (unit >= 1 && unit <= 3) result.resolutionUnit = unit;
        } else if (tag === 0x0132) result.dateTime = readAsciiTag(ePos, type, count) ?? result.dateTime;
        else if (tag === 0x8769 && (type === 4 || type === 3)) {
          exifSubIfdOffset = type === 3 ? readU16(ePos + 8) : readU32(ePos + 8);
        }
      }

      if (exifSubIfdOffset > 0 && tiffBase + exifSubIfdOffset + 2 <= segEnd) {
        const subPos = tiffBase + exifSubIfdOffset;
        const numSub = Math.min(200, readU16(subPos));
        for (let i = 0; i < numSub; i++) {
          const ePos = subPos + 2 + i * 12;
          if (ePos + 12 > segEnd) break;
          const tag = readU16(ePos);
          const type = readU16(ePos + 2);
          const count = readU32(ePos + 4);
          if (tag === 0x9003) {
            result.dateTimeOriginal = readAsciiTag(ePos, type, count) ?? result.dateTimeOriginal;
          } else if (tag === 0xa001 && type === 3 && count === 1) {
            result.colorSpace = readU16(ePos + 8);
          }
        }
      }

      break;
    }

    offset += 2 + segLen;
  }

  return result;
}

/**
 * Creates Adobe XMP XML packet
 */
export function createXmpPacket(params: EmbedMetadataParams): string {
  const { title, topic, category, description, keywords, rating = 5, author, software } = params;
  const safeTopic = (topic || category || 'Stock Topic').trim();
  const safeCategory = (category || safeTopic).trim();
  const safeDesc = (description || '').trim();

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      ${safeDesc ? `<dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(safeDesc)}</rdf:li>
        </rdf:Alt>
      </dc:description>` : ''}
      <dc:subject>
        <rdf:Bag>
          ${keywords.map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`).join('\n          ')}
        </rdf:Bag>
      </dc:subject>
      <xmp:Rating>${rating}</xmp:Rating>
      <photoshop:Headline>${escapeXml(title)}</photoshop:Headline>
      <photoshop:Category>${escapeXml(safeCategory)}</photoshop:Category>
      ${safeTopic && safeTopic !== safeCategory ? `<photoshop:SupplementalCategories><rdf:Bag><rdf:li>${escapeXml(safeTopic)}</rdf:li></rdf:Bag></photoshop:SupplementalCategories>` : ''}
      ${author ? `<dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>
      <photoshop:CaptionWriter>${escapeXml(author)}</photoshop:CaptionWriter>
      <photoshop:Credit>${escapeXml(author)}</photoshop:Credit>` : ''}
      ${software ? `<xmp:CreatorTool>${escapeXml(software)}</xmp:CreatorTool>` : ''}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Creates Little-Endian EXIF APP1 payload with Windows XP Properties (Title, Subject, Rating, Tags, Comments)
 * and preserved source camera/orientation/date tags when available.
 */
export function createExifApp1Segment(
  params: EmbedMetadataParams,
  preservedExif?: ExtractedExifTags
): Uint8Array {
  const { title, topic, category, description, keywords, rating = 5, author, software } = params;
  const safeTopic = (topic || category || 'Stock Topic').trim();
  const safeDesc = (description || '').trim();
  const tagsList = (keywords || []).join('; ');

  // Value buffers
  const xpTitleBytes = stringToUtf16LE(title || '', true);
  const xpSubjectBytes = stringToUtf16LE(safeTopic, true);
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

  // 0x010E ImageDescription (ASCII) - Only write when description is non-empty so Windows Subject isn't overwritten with Title
  if (safeDesc.length > 0) {
    const descBytes = stringToAscii(safeDesc, true);
    entries.push({
      tag: 0x010e,
      type: 2,
      count: descBytes.length,
      valueOrOffset: 0,
      extraData: descBytes,
    });
  }

  // Preserved original camera/orientation/DPI/date tags from source JPEG
  if (preservedExif?.make) {
    const makeBytes = stringToAscii(preservedExif.make, true);
    entries.push({ tag: 0x010f, type: 2, count: makeBytes.length, valueOrOffset: 0, extraData: makeBytes });
  }
  if (preservedExif?.model) {
    const modelBytes = stringToAscii(preservedExif.model, true);
    entries.push({ tag: 0x0110, type: 2, count: modelBytes.length, valueOrOffset: 0, extraData: modelBytes });
  }
  if (preservedExif?.orientation) {
    entries.push({ tag: 0x0112, type: 3, count: 1, valueOrOffset: preservedExif.orientation });
  }

  const makeRationalBytes = ([num, den]: [number, number]): Uint8Array => {
    const b = new Uint8Array(8);
    b[0] = num & 0xff;
    b[1] = (num >> 8) & 0xff;
    b[2] = (num >> 16) & 0xff;
    b[3] = (num >> 24) & 0xff;
    b[4] = den & 0xff;
    b[5] = (den >> 8) & 0xff;
    b[6] = (den >> 16) & 0xff;
    b[7] = (den >> 24) & 0xff;
    return b;
  };
  if (preservedExif?.xResolution) {
    const xResBytes = makeRationalBytes(preservedExif.xResolution);
    entries.push({ tag: 0x011a, type: 5, count: 1, valueOrOffset: 0, extraData: xResBytes });
  }
  if (preservedExif?.yResolution) {
    const yResBytes = makeRationalBytes(preservedExif.yResolution);
    entries.push({ tag: 0x011b, type: 5, count: 1, valueOrOffset: 0, extraData: yResBytes });
  }
  if (preservedExif?.resolutionUnit) {
    entries.push({ tag: 0x0128, type: 3, count: 1, valueOrOffset: preservedExif.resolutionUnit });
  }

  // 0x0131 Software (ASCII) - Only if explicitly provided; left completely blank by default
  if (software && software.trim().length > 0) {
    const softwareBytes = stringToAscii(software.trim(), true);
    entries.push({
      tag: 0x0131,
      type: 2,
      count: softwareBytes.length,
      valueOrOffset: 0,
      extraData: softwareBytes,
    });
  }

  if (preservedExif?.dateTime) {
    const dtBytes = stringToAscii(preservedExif.dateTime, true);
    entries.push({ tag: 0x0132, type: 2, count: dtBytes.length, valueOrOffset: 0, extraData: dtBytes });
  }

  // 0x013B Artist / Authors (ASCII) - Only if explicitly provided; left completely blank by default
  if (author && author.trim().length > 0) {
    const artistBytes = stringToAscii(author.trim(), true);
    entries.push({
      tag: 0x013b,
      type: 2,
      count: artistBytes.length,
      valueOrOffset: 0,
      extraData: artistBytes,
    });
  }

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

  // 0x8769 ExifIFDPointer (for DateTimeOriginal 0x9003 and ColorSpace 0xA001 when preserved from original photo)
  const subIfdEntries: TagSpec[] = [];
  if (preservedExif?.dateTimeOriginal) {
    const dtOrigBytes = stringToAscii(preservedExif.dateTimeOriginal, true);
    subIfdEntries.push({
      tag: 0x9003,
      type: 2,
      count: dtOrigBytes.length,
      valueOrOffset: 0,
      extraData: dtOrigBytes,
    });
  }
  if (preservedExif?.colorSpace !== undefined) {
    subIfdEntries.push({
      tag: 0xa001,
      type: 3,
      count: 1,
      valueOrOffset: preservedExif.colorSpace,
    });
  }
  subIfdEntries.sort((a, b) => a.tag - b.tag);

  if (subIfdEntries.length > 0) {
    entries.push({
      tag: 0x8769,
      type: 4,
      count: 1,
      valueOrOffset: 0,
    });
  }

  // 0x9C9B XPTitle (UNDEFINED) -> Windows Title
  entries.push({
    tag: 0x9c9b,
    type: 7,
    count: xpTitleBytes.length,
    valueOrOffset: 0,
    extraData: xpTitleBytes,
  });

  // 0x9C9C XPComment (UNDEFINED) -> Windows Comments (only when description is non-empty)
  if (safeDesc.length > 0) {
    const xpCommentBytes = stringToUtf16LE(safeDesc, true);
    entries.push({
      tag: 0x9c9c,
      type: 7,
      count: xpCommentBytes.length,
      valueOrOffset: 0,
      extraData: xpCommentBytes,
    });
  }

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
  const ifd0Start = 8;
  const numEntries = entries.length;
  const ifd0Size = 2 + numEntries * 12 + 4;
  const subIfdOffset = ifd0Start + ifd0Size;
  const subIfdSize = subIfdEntries.length > 0 ? 2 + subIfdEntries.length * 12 + 4 : 0;
  let currentExtraOffset = subIfdOffset + subIfdSize;

  if (subIfdEntries.length > 0) {
    const ptrEntry = entries.find((e) => e.tag === 0x8769);
    if (ptrEntry) ptrEntry.valueOrOffset = subIfdOffset;
  }

  // Assign offsets to extraData
  for (const entry of entries) {
    if (entry.extraData) {
      if (entry.extraData.length <= 4) {
        let val = 0;
        for (let i = 0; i < entry.extraData.length; i++) {
          val |= entry.extraData[i] << (i * 8);
        }
        entry.valueOrOffset = val;
      } else {
        entry.valueOrOffset = currentExtraOffset;
        currentExtraOffset += entry.extraData.length;
        if (currentExtraOffset % 2 !== 0) currentExtraOffset++;
      }
    }
  }

  for (const subEntry of subIfdEntries) {
    if (subEntry.extraData) {
      if (subEntry.extraData.length <= 4) {
        let val = 0;
        for (let i = 0; i < subEntry.extraData.length; i++) {
          val |= subEntry.extraData[i] << (i * 8);
        }
        subEntry.valueOrOffset = val;
      } else {
        subEntry.valueOrOffset = currentExtraOffset;
        currentExtraOffset += subEntry.extraData.length;
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
    segment[ptr++] = entry.tag & 0xff;
    segment[ptr++] = (entry.tag >> 8) & 0xff;
    segment[ptr++] = entry.type & 0xff;
    segment[ptr++] = (entry.type >> 8) & 0xff;
    segment[ptr++] = entry.count & 0xff;
    segment[ptr++] = (entry.count >> 8) & 0xff;
    segment[ptr++] = (entry.count >> 16) & 0xff;
    segment[ptr++] = (entry.count >> 24) & 0xff;
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

  // Write Exif Sub-IFD if preserved
  if (subIfdEntries.length > 0) {
    segment[ptr++] = subIfdEntries.length & 0xff;
    segment[ptr++] = (subIfdEntries.length >> 8) & 0xff;
    for (const subEntry of subIfdEntries) {
      segment[ptr++] = subEntry.tag & 0xff;
      segment[ptr++] = (subEntry.tag >> 8) & 0xff;
      segment[ptr++] = subEntry.type & 0xff;
      segment[ptr++] = (subEntry.type >> 8) & 0xff;
      segment[ptr++] = subEntry.count & 0xff;
      segment[ptr++] = (subEntry.count >> 8) & 0xff;
      segment[ptr++] = (subEntry.count >> 16) & 0xff;
      segment[ptr++] = (subEntry.count >> 24) & 0xff;
      segment[ptr++] = subEntry.valueOrOffset & 0xff;
      segment[ptr++] = (subEntry.valueOrOffset >> 8) & 0xff;
      segment[ptr++] = (subEntry.valueOrOffset >> 16) & 0xff;
      segment[ptr++] = (subEntry.valueOrOffset >> 24) & 0xff;
    }
    segment[ptr++] = 0;
    segment[ptr++] = 0;
    segment[ptr++] = 0;
    segment[ptr++] = 0;
  }

  // Write Extra Data
  for (const entry of entries) {
    if (entry.extraData && entry.extraData.length > 4) {
      const targetPos = tiffBase + entry.valueOrOffset;
      segment.set(entry.extraData, targetPos);
    }
  }

  for (const subEntry of subIfdEntries) {
    if (subEntry.extraData && subEntry.extraData.length > 4) {
      segment.set(subEntry.extraData, tiffBase + subEntry.valueOrOffset);
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
  const { title, topic, category, description, keywords, author } = params;
  const safeTopic = topic || category || 'Stock Topic';
  const safeCategory = category || safeTopic;

  // Build IPTC IIM records
  const iptcRecords: Uint8Array[] = [];

  const addRawRecord = (recordNum: number, datasetNum: number, dataBytes: Uint8Array) => {
    if (!dataBytes || dataBytes.length === 0) return;
    const rec = new Uint8Array(5 + dataBytes.length);
    rec[0] = 0x1c; // Tag marker
    rec[1] = recordNum;
    rec[2] = datasetNum;
    rec[3] = (dataBytes.length >> 8) & 0xff;
    rec[4] = dataBytes.length & 0xff;
    rec.set(dataBytes, 5);
    iptcRecords.push(rec);
  };

  const addRecord = (recordNum: number, datasetNum: number, dataStr: string) => {
    if (!dataStr) return;
    addRawRecord(recordNum, datasetNum, new TextEncoder().encode(dataStr));
  };

  // 1:90 Coded Character Set = UTF-8 (ESC % G = 0x1B 0x25 0x47) so all agencies read UTF-8 cleanly
  addRawRecord(1, 90, new Uint8Array([0x1b, 0x25, 0x47]));
  // 2:00 Record Version = 4
  addRawRecord(2, 0, new Uint8Array([0x00, 0x04]));
  // 2:05 Object Name (Title) - strict 64-byte word-boundary IPTC cap
  addRecord(2, 5, truncateUtf8Bytes(title, 64));
  // 2:15 Category (3-letter ASCII code per IPTC-IIM spec)
  const catCode = normalizeToAsciiSafe(safeCategory).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'STK';
  addRecord(2, 15, catCode);
  // 2:20 Supplemental Category (32-byte word-boundary IPTC cap)
  addRecord(2, 20, truncateUtf8Bytes(safeTopic, 32));
  // 2:25 Keywords (each keyword deduplicated & capped at 64 bytes per IPTC-IIM spec)
  keywords.forEach((k) => addRecord(2, 25, truncateUtf8Bytes(k, 64)));
  // 2:80 By-line (Author / Contributor Name)
  if (author && author.trim().length > 0) {
    addRecord(2, 80, truncateUtf8Bytes(author.trim(), 32));
    // 2:110 Credit
    addRecord(2, 110, truncateUtf8Bytes(author.trim(), 32));
  }
  // 2:105 Headline (256-byte word-boundary IPTC cap, preserves full title up to 200+ chars)
  addRecord(2, 105, truncateUtf8Bytes(title, 256));
  // 2:120 Caption-Abstract (only when description is non-empty; never copy Title into Caption/Subject)
  if (description && description.trim().length > 0) {
    addRecord(2, 120, truncateUtf8Bytes(description.trim(), 2000));
  }

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
  if (!jpegBytes || jpegBytes.length < 4 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    // Not a valid JPEG, return as-is
    return jpegBytes;
  }

  const normalizedMeta = normalizeEmbedMetadata(metadata);

  // Extract and preserve original camera/orientation/DPI/color/date EXIF tags before rewriting APP1
  const preservedExif = extractEssentialExifFromJpeg(jpegBytes);

  // Create segments
  const exifSegment = createExifApp1Segment(normalizedMeta, preservedExif);
  const xmpSegment = createXmpApp1Segment(normalizedMeta);
  const iptcSegment = createIptcApp13Segment(normalizedMeta);

  // Find position right after SOI (offset 2) or after JFIF/APP0 (with bounds check)
  let insertPos = 2;
  if (jpegBytes.length >= 6 && jpegBytes[2] === 0xff && jpegBytes[3] === 0xe0) {
    const app0Len = (jpegBytes[4] << 8) | jpegBytes[5];
    if (app0Len >= 2 && 4 + app0Len <= jpegBytes.length) {
      insertPos = 4 + app0Len;
    }
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

    while (offset + 1 < jpegBytes.length && jpegBytes[offset + 1] === 0xff) {
      offset++;
    }
    if (offset + 1 >= jpegBytes.length) {
      parts.push(jpegBytes.slice(offset));
      break;
    }

    const marker = jpegBytes[offset + 1];
    // Standalone / RST markers have no length field
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(jpegBytes.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    // SOS (Start of Scan) or EOI (End of Image) -> copy rest and finish
    if (marker === 0xda || marker === 0xd9) {
      parts.push(jpegBytes.slice(offset));
      break;
    }

    // Segment length includes 2 bytes of length
    if (offset + 3 >= jpegBytes.length) {
      parts.push(jpegBytes.slice(offset));
      break;
    }
    const segLen = (jpegBytes[offset + 2] << 8) | jpegBytes[offset + 3];
    const totalSegSize = 2 + segLen;
    if (segLen < 2 || offset + totalSegSize > jpegBytes.length) {
      parts.push(jpegBytes.slice(offset));
      break;
    }

    // Strip old Exif/XMP (0xFFE1) or IPTC (0xFFED)
    const isOldExifOrXmp = marker === 0xe1;
    const isOldIptc = marker === 0xed;

    if (!isOldExifOrXmp && !isOldIptc) {
      // Keep other segments intact (quantization tables, ICC color profiles, frames, comments, etc.)
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
 * Embeds XMP and tEXt chunks into a PNG binary buffer losslessly (deduplicating prior metadata chunks)
 */
export function embedMetadataInPng(
  pngBytes: Uint8Array,
  metadata: EmbedMetadataParams
): Uint8Array {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    !pngBytes ||
    pngBytes.length < 33 ||
    pngBytes[0] !== 0x89 ||
    pngBytes[1] !== 0x50 ||
    pngBytes[2] !== 0x4e ||
    pngBytes[3] !== 0x47
  ) {
    return pngBytes;
  }

  const normalizedMeta = normalizeEmbedMetadata(metadata);
  const { title, topic, category, description, keywords } = normalizedMeta;
  const safeTopic = topic || category || 'Stock Topic';

  // Helper to build a PNG chunk
  const createChunk = (type: string, data: Uint8Array): Uint8Array => {
    const chunkLen = data.length;
    const chunk = new Uint8Array(4 + 4 + chunkLen + 4);
    chunk[0] = (chunkLen >> 24) & 0xff;
    chunk[1] = (chunkLen >> 16) & 0xff;
    chunk[2] = (chunkLen >> 8) & 0xff;
    chunk[3] = chunkLen & 0xff;
    for (let i = 0; i < 4; i++) {
      chunk[4 + i] = type.charCodeAt(i);
    }
    chunk.set(data, 8);
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
    data[keyBytes.length] = 0;
    data.set(textBytes, keyBytes.length + 1);
    return createChunk('tEXt', data);
  };

  // Build XMP chunk (iTXt XML:com.adobe.xmp)
  const xmpXml = createXmpPacket(normalizedMeta);
  const xmpHeader = new TextEncoder().encode('XML:com.adobe.xmp\0\0\0\0\0');
  const xmpBody = new TextEncoder().encode(xmpXml);
  const xmpData = new Uint8Array(xmpHeader.length + xmpBody.length);
  xmpData.set(xmpHeader, 0);
  xmpData.set(xmpBody, xmpHeader.length);
  const xmpChunk = createChunk('iTXt', xmpData);

  // Standard PNG tEXt chunks
  const safeDesc = (description || '').trim();
  const chunksToAdd: Uint8Array[] = [
    createTextChunk('Title', title),
    createTextChunk('Subject', safeTopic),
    createTextChunk('Topic', safeTopic),
    createTextChunk('Keywords', (keywords || []).join(', ')),
  ];
  if (safeDesc.length > 0) {
    chunksToAdd.push(createTextChunk('Description', safeDesc));
    chunksToAdd.push(createTextChunk('Comment', safeDesc));
  }

  if (normalizedMeta.author && normalizedMeta.author.trim().length > 0) {
    chunksToAdd.push(createTextChunk('Author', normalizedMeta.author.trim()));
  }
  if (normalizedMeta.software && normalizedMeta.software.trim().length > 0) {
    chunksToAdd.push(createTextChunk('Software', normalizedMeta.software.trim()));
  }

  chunksToAdd.push(xmpChunk);

  const managedTextKeys = new Set([
    'Title', 'Subject', 'Topic', 'Description', 'Comment', 'Keywords', 'Author', 'Software',
  ]);

  // Parse existing chunks after PNG signature + IHDR so old duplicate metadata chunks are stripped cleanly
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  if (pngBytes.length < ihdrEnd) return pngBytes;

  const keptTailChunks: Uint8Array[] = [];
  let pos = ihdrEnd;
  while (pos + 12 <= pngBytes.length) {
    const chunkLen =
      ((pngBytes[pos] << 24) | (pngBytes[pos + 1] << 16) | (pngBytes[pos + 2] << 8) | pngBytes[pos + 3]) >>> 0;
    const totalChunkLen = 12 + chunkLen;
    if (pos + totalChunkLen > pngBytes.length) {
      keptTailChunks.push(pngBytes.slice(pos));
      break;
    }

    const type = String.fromCharCode(
      pngBytes[pos + 4],
      pngBytes[pos + 5],
      pngBytes[pos + 6],
      pngBytes[pos + 7]
    );
    const dataSlice = pngBytes.slice(pos + 8, pos + 8 + chunkLen);

    let shouldSkip = false;
    if (type === 'tEXt') {
      const nullIdx = dataSlice.indexOf(0);
      if (nullIdx > 0) {
        const key = new TextDecoder().decode(dataSlice.slice(0, nullIdx));
        if (managedTextKeys.has(key)) shouldSkip = true;
      }
    } else if (type === 'iTXt') {
      const nullIdx = dataSlice.indexOf(0);
      if (nullIdx > 0) {
        const key = new TextDecoder().decode(dataSlice.slice(0, nullIdx));
        if (key === 'XML:com.adobe.xmp') shouldSkip = true;
      }
    }

    if (!shouldSkip) {
      keptTailChunks.push(pngBytes.slice(pos, pos + totalChunkLen));
    }

    pos += totalChunkLen;
    if (type === 'IEND') break;
  }

  const tailSize = keptTailChunks.reduce((acc, c) => acc + c.length, 0);
  const addedSize = chunksToAdd.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(ihdrEnd + addedSize + tailSize);

  result.set(pngBytes.slice(0, ihdrEnd), 0);
  let cur = ihdrEnd;

  for (const chunk of chunksToAdd) {
    result.set(chunk, cur);
    cur += chunk.length;
  }
  for (const chunk of keptTailChunks) {
    result.set(chunk, cur);
    cur += chunk.length;
  }

  return result;
}

async function convertNonJpegBlobToJpegBytes(blob: Blob): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const jpegBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.96)
    );
    if (!jpegBlob) return null;
    return new Uint8Array(await jpegBlob.arrayBuffer());
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Master function to inject metadata into any Image File or Blob losslessly.
 * Detects real magic bytes so format-converted extensions (e.g. PNG/WebP -> .jpg) always get valid JPEG bytes + EXIF/IPTC/XMP.
 */
export async function injectMetadataIntoFile(
  fileOrBlob: Blob,
  filename: string,
  metadata: EmbedMetadataParams
): Promise<{ blob: Blob; buffer: Uint8Array; mimeType: string }> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);
  const lowerName = filename.toLowerCase();

  const isJpegBytes = rawBytes.length >= 2 && rawBytes[0] === 0xff && rawBytes[1] === 0xd8;
  const isPngBytes =
    rawBytes.length >= 4 &&
    rawBytes[0] === 0x89 &&
    rawBytes[1] === 0x50 &&
    rawBytes[2] === 0x4e &&
    rawBytes[3] === 0x47;
  const wantsJpeg = lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
  const wantsPng = lowerName.endsWith('.png');

  let processedBytes: Uint8Array = rawBytes;
  let mimeType = fileOrBlob.type || (wantsPng ? 'image/png' : 'image/jpeg');

  if (isJpegBytes) {
    processedBytes = embedMetadataInJpeg(rawBytes, metadata);
    mimeType = 'image/jpeg';
  } else if (wantsJpeg) {
    const convertedJpeg = await convertNonJpegBlobToJpegBytes(fileOrBlob);
    if (convertedJpeg && convertedJpeg[0] === 0xff && convertedJpeg[1] === 0xd8) {
      processedBytes = embedMetadataInJpeg(convertedJpeg, metadata);
      mimeType = 'image/jpeg';
    } else if (isPngBytes) {
      processedBytes = embedMetadataInPng(rawBytes, metadata);
      mimeType = 'image/png';
    }
  } else if (isPngBytes || wantsPng) {
    processedBytes = embedMetadataInPng(rawBytes, metadata);
    mimeType = 'image/png';
  }

  const newBlob = new Blob([processedBytes], { type: mimeType });

  return { blob: newBlob, buffer: processedBytes, mimeType };
}

/**
 * Downloads a single image file with lossless EXIF, IPTC, XMP and optional Contributor Author metadata
 */
export async function downloadSingleAssetWithMetadata(
  fileOrBlob: Blob,
  filename: string,
  metadata: EmbedMetadataParams
): Promise<void> {
  const { blob } = await injectMetadataIntoFile(fileOrBlob, filename, metadata);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

