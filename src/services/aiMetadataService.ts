import { StockAsset, Marketplace, GenerationSettings } from '../types';
import {
  getMarketplaceSeoProfile,
  getVideoSeoDirective,
  MediaInspectionMeta,
} from '../utils/marketplacePrompts';
import {
  sanitizeTitle,
  alignKeywordsWithTitle,
  normalizeCategoryForMarketplace,
  truncateAtWordBoundary,
} from '../utils/stockSeoSanitizer';

function drawImageOnWhiteCanvas(
  img: HTMLImageElement,
  maxDim = 1152,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  fillWhiteBackground = true
): string {
  let width = img.naturalWidth || img.width || maxDim;
  let height = img.naturalHeight || img.height || maxDim;
  if (width === 0 || height === 0) {
    width = maxDim;
    height = maxDim;
  }
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // White backdrop ensures dark transparent PNG/SVG vectors remain clearly visible to AI Vision
  if (fillWhiteBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return mime === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
}

// Extract embedded JPEG preview from Adobe Illustrator (.ai/.eps) files if present
async function extractEmbeddedVectorPreview(file: File): Promise<string> {
  try {
    const sliceSize = Math.min(file.size, 6 * 1024 * 1024);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let start = -1;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff && (bytes[i + 3] === 0xe0 || bytes[i + 3] === 0xe1 || bytes[i + 3] === 0xdb)) {
        start = i;
        break;
      }
    }
    if (start === -1) return '';
    let end = -1;
    for (let i = start + 512; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        end = i + 2;
        if (end - start >= 2048) break;
      }
    }
    if (end === -1 || end - start < 2048) return '';
    const jpgBlob = new Blob([bytes.slice(start, end)], { type: 'image/jpeg' });
    const objUrl = URL.createObjectURL(jpgBlob);
    return await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const out = drawImageOnWhiteCanvas(img, 1200, 'image/jpeg', true);
        URL.revokeObjectURL(objUrl);
        resolve(out);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve('');
      };
      img.src = objUrl;
    });
  } catch {
    return '';
  }
}

// Fast high-fidelity thumbnail converter supporting Raster Images (1600px HD), SVG Vectors (rasterized to PNG), Videos (frame capture), and EPS/AI (embedded preview)
export const fileToFastThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }

    const lowerName = file.name.toLowerCase();

    // 1. Rasterize SVG onto a 1200px white-backed PNG so Gemini/Groq Vision sees fine vector details
    if (file.type === 'image/svg+xml' || lowerName.endsWith('.svg')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const pngData = drawImageOnWhiteCanvas(img, 1200, 'image/png', true);
        URL.revokeObjectURL(url);
        resolve(pngData);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
      return;
    }

    // 2. Capture representative video frame onto 800px JPEG for Vision analysis
    if (file.type?.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(lowerName)) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve('');
        }
      }, 6000);

      video.onloadedmetadata = () => {
        const dur = video.duration && isFinite(video.duration) && video.duration > 0.2 ? video.duration : 0.5;
        const seekTime = Math.min(Math.max(0.15, dur * 0.4), Math.max(0.15, dur - 0.05));
        video.currentTime = seekTime;
      };
      video.onseeked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1280;
          let width = video.videoWidth || 1280;
          let height = video.videoHeight || 720;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            cleanup();
            resolve(dataUrl);
            return;
          }
        } catch {}
        cleanup();
        resolve('');
      };
      video.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          cleanup();
          resolve('');
        }
      };
      video.src = url;
      return;
    }

    // 3. Extract embedded JPEG preview from EPS / AI if available
    if (/\.(eps|ai)$/i.test(lowerName) || file.type.includes('postscript')) {
      extractEmbeddedVectorPreview(file).then(resolve).catch(() => resolve(''));
      return;
    }

    // 4. Standard raster images (JPG, PNG, WebP, GIF, etc.) -> single-pass objectURL decode + 1152px @ 0.85 JPEG (~3-4x smaller upload, crisp OCR)
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }

    const needsWhiteBackdrop =
      file.type === 'image/png' ||
      file.type === 'image/gif' ||
      file.type === 'image/webp' ||
      /\.(png|gif|webp)$/i.test(lowerName);

    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dataUrl = drawImageOnWhiteCanvas(img, 1152, 'image/jpeg', needsWhiteBackdrop);
      URL.revokeObjectURL(objUrl);
      resolve(dataUrl || '');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    };
    img.src = objUrl;
  });
};

const MAX_DIRECT_VIDEO_BYTES = 14 * 1024 * 1024; // 14MB raw (~19MB base64 inlineData safe limit)
const CHUNKED_PROXY_MAX_BYTES = 250 * 1024 * 1024; // 250MB max via 6MB chunked server ffmpeg proxy
const VIDEO_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB slices (well under Cloud Run 32MB request cap)

// Remembers static-host deployments (e.g. Vercel SPA rewrite returning 404/405/HTML for /api/*)
let isStaticHostMode = false;

function getNormalizedVideoMime(file: File): string {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (file.type && file.type.startsWith('video/')) return file.type;
  return 'video/mp4';
}

function fileToVideoDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      if (!raw.includes(';base64,')) {
        resolve('');
        return;
      }
      const b64 = raw.split(';base64,')[1];
      const normalizedMime = getNormalizedVideoMime(file);
      resolve(b64 ? `data:${normalizedMime};base64,${b64}` : '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function extractMetaFromImg(img: HTMLImageElement): MediaInspectionMeta | undefined {
  const width = img.naturalWidth || img.width || 0;
  const height = img.naturalHeight || img.height || 0;
  if (!width || !height) return undefined;
  const orientation: MediaInspectionMeta['orientation'] =
    width > height * 1.05 ? 'horizontal' : height > width * 1.05 ? 'vertical' : 'square';
  return { width, height, orientation };
}

async function fileToFastThumbnailWithMeta(
  file: File
): Promise<{ dataUrl: string; meta?: MediaInspectionMeta }> {
  if (!file) return { dataUrl: '' };
  const lowerName = file.name.toLowerCase();
  if (file.type?.startsWith('image/') && file.type !== 'image/svg+xml' && !lowerName.endsWith('.svg')) {
    const needsWhiteBackdrop =
      file.type === 'image/png' ||
      file.type === 'image/gif' ||
      file.type === 'image/webp' ||
      /\.(png|gif|webp)$/i.test(lowerName);

    return new Promise((resolve) => {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const meta = extractMetaFromImg(img);
        const dataUrl = drawImageOnWhiteCanvas(img, 1152, 'image/jpeg', needsWhiteBackdrop);
        URL.revokeObjectURL(objUrl);
        resolve({ dataUrl: dataUrl || '', meta });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        const reader = new FileReader();
        reader.onload = (e) => resolve({ dataUrl: (e.target?.result as string) || '' });
        reader.onerror = () => resolve({ dataUrl: '' });
        reader.readAsDataURL(file);
      };
      img.src = objUrl;
    });
  }
  const dataUrl = await fileToFastThumbnail(file);
  return { dataUrl };
}

// Extracts a 2x2 chronological storyboard (15%, 40%, 65%, 85%) plus natural resolution & duration metadata
async function extractVideoStoryboardAndMeta(
  file: File
): Promise<{ storyboardDataUrl: string; meta: MediaInspectionMeta }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = (storyboardDataUrl: string, meta: MediaInspectionMeta) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      URL.revokeObjectURL(url);
      resolve({ storyboardDataUrl, meta });
    };

    const safetyTimer = setTimeout(() => {
      finish('', {});
    }, 10000);

    const drawQuadrantBadge = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      label: string
    ) => {
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      const padX = 8;
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(11, 13, 18, 0.82)';
      ctx.fillRect(x + 8, y + 8, textW + padX * 2, 22);
      ctx.fillStyle = '#ff7744';
      ctx.fillRect(x + 8, y + 8, 3, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 8 + padX, y + 23);
      ctx.restore();
    };

    video.onloadedmetadata = async () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const orientation: MediaInspectionMeta['orientation'] =
        width > height * 1.05 ? 'horizontal' : height > width * 1.05 ? 'vertical' : 'square';

      const baseMeta: MediaInspectionMeta = {
        width,
        height,
        durationSec: duration || undefined,
        orientation,
        hasStoryboard: false,
      };

      try {
        const aspect = width / Math.max(1, height);
        const tileW = aspect >= 1 ? 768 : Math.max(360, Math.round(540 * aspect));
        const tileH = Math.max(240, Math.round(tileW / aspect));

        const positions = [
          { pct: 0.15, label: '15% START' },
          { pct: 0.40, label: '40% EARLY' },
          { pct: 0.65, label: '65% MID-LATE' },
          { pct: 0.85, label: '85% END' },
        ];

        const canvas = document.createElement('canvas');
        canvas.width = tileW * 2;
        canvas.height = tileH * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish('', baseMeta);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = '#0b0d12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const seekTo = (t: number) =>
          new Promise<void>((res) => {
            if (settled) {
              res();
              return;
            }
            let done = false;
            const onSeeked = () => {
              if (done) return;
              done = true;
              video.removeEventListener('seeked', onSeeked);
              res();
            };
            video.addEventListener('seeked', onSeeked);
            setTimeout(() => {
              if (!done) {
                done = true;
                video.removeEventListener('seeked', onSeeked);
                res();
              }
            }, 1800);
            try {
              video.currentTime = t;
            } catch {
              onSeeked();
            }
          });

        let captured = 0;
        for (let i = 0; i < positions.length; i++) {
          if (settled) break;
          const pos = positions[i];
          const targetSec =
            duration > 0.25
              ? Math.min(Math.max(0.05, duration * pos.pct), Math.max(0.08, duration - 0.05))
              : 0.1;
          await seekTo(targetSec);
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = col * tileW;
          const y = row * tileH;
          try {
            ctx.drawImage(video, x, y, tileW, tileH);
            drawQuadrantBadge(ctx, x, y, pos.label);
            captured++;
          } catch {}
        }

        if (captured === 0) {
          finish('', baseMeta);
          return;
        }

        const storyboardDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        finish(storyboardDataUrl, { ...baseMeta, hasStoryboard: true });
      } catch {
        finish('', baseMeta);
      }
    };

    video.onerror = () => {
      finish('', {});
    };

    video.src = url;
  });
}

async function composeStoryboardFromDataUrls(frameUrls: string[]): Promise<string> {
  if (!frameUrls || frameUrls.length === 0) return '';
  const loadImg = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const imgs = (await Promise.all(frameUrls.slice(0, 4).map(loadImg))).filter(Boolean) as HTMLImageElement[];
  if (imgs.length === 0) return '';

  const firstW = imgs[0].naturalWidth || 640;
  const firstH = imgs[0].naturalHeight || 360;
  const aspect = firstW / Math.max(1, firstH);
  const tileW = aspect >= 1 ? 768 : Math.max(360, Math.round(540 * aspect));
  const tileH = Math.max(240, Math.round(tileW / aspect));

  const canvas = document.createElement('canvas');
  canvas.width = tileW * 2;
  canvas.height = tileH * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return frameUrls[0];
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const labels = ['15% START', '40% EARLY', '65% MID-LATE', '85% END'];
  for (let i = 0; i < imgs.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col * tileW;
    const y = row * tileH;
    ctx.drawImage(imgs[i], x, y, tileW, tileH);

    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    const textW = ctx.measureText(labels[i] || `FRAME ${i + 1}`).width;
    ctx.fillStyle = 'rgba(11, 13, 18, 0.82)';
    ctx.fillRect(x + 8, y + 8, textW + 16, 24);
    ctx.fillStyle = '#ff7744';
    ctx.fillRect(x + 8, y + 8, 3, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labels[i] || `FRAME ${i + 1}`, x + 16, y + 25);
    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.88);
}

async function prepareServerVideoProxy(
  file: File,
  createMotionProxy: boolean
): Promise<{
  proxyId?: string;
  storyboardDataUrl: string;
  previewFrame?: string;
  meta: MediaInspectionMeta;
} | null> {
  if (isStaticHostMode || !file || file.size <= 0 || file.size > CHUNKED_PROXY_MAX_BYTES) {
    return null;
  }

  try {
    const uploadId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const totalChunks = Math.max(1, Math.ceil(file.size / VIDEO_CHUNK_SIZE));

    for (let i = 0; i < totalChunks; i++) {
      const start = i * VIDEO_CHUNK_SIZE;
      const end = Math.min(file.size, start + VIDEO_CHUNK_SIZE);
      const chunkSlice = file.slice(start, end);
      const chunkResp = await fetch('/api/video-prepare/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Id': uploadId,
          'X-Chunk-Index': String(i),
        },
        body: chunkSlice,
      });
      if (!chunkResp.ok) {
        if (chunkResp.status === 404 || chunkResp.status === 405) {
          isStaticHostMode = true;
        }
        return null;
      }
    }

    const finalizeResp = await fetch('/api/video-prepare/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        filename: file.name,
        totalChunks,
        createMotionProxy,
      }),
    });

    if (!finalizeResp.ok) return null;
    const data = await finalizeResp.json();
    const frames: string[] = Array.isArray(data.frames) ? data.frames : [];
    const storyboardDataUrl = await composeStoryboardFromDataUrls(frames);

    return {
      proxyId: data.proxyId,
      storyboardDataUrl,
      previewFrame: data.previewFrame || frames[0] || '',
      meta: data.meta || {},
    };
  } catch {
    return null;
  }
}

async function prepareMediaPayload(
  asset: StockAsset,
  preferDirectVideo: boolean,
  deepVideoProxy: boolean
): Promise<{
  imageData: string;
  videoData?: string;
  videoProxyId?: string;
  resolvedPreviewUrl?: string;
  mediaContext?: MediaInspectionMeta;
}> {
  const hasFileBlob = asset.file instanceof Blob;
  const isVideo =
    asset.fileType === 'video' ||
    Boolean(hasFileBlob && asset.file?.type?.startsWith('video/')) ||
    /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(asset.filename);

  if (isVideo && hasFileBlob && asset.file) {
    // 1. Always try ultra-fast local browser <video> storyboard first (0MB upload!)
    const localResult = await extractVideoStoryboardAndMeta(asset.file);
    let storyboardDataUrl = localResult.storyboardDataUrl;
    let meta: MediaInspectionMeta = { ...localResult.meta };
    let videoData: string | undefined;
    let videoProxyId: string | undefined;
    let resolvedPreviewUrl: string | undefined;

    if (preferDirectVideo && asset.file.size > 0 && asset.file.size <= MAX_DIRECT_VIDEO_BYTES) {
      // Case A: Small/medium clip (<=14MB) -> send raw video stream directly to Gemini
      const encodedVideo = await fileToVideoDataUrl(asset.file);
      if (encodedVideo) {
        videoData = encodedVideo;
        meta.hasDirectVideo = true;
      }
    } else if (!storyboardDataUrl || (preferDirectVideo && deepVideoProxy)) {
      // Case B: Larger clip (30-250MB H.264 MP4/MOV) with Full Video Stream enabled, OR ProRes/HEVC MOV unreadable by browser
      const serverPrep = await prepareServerVideoProxy(asset.file, preferDirectVideo);
      if (serverPrep) {
        if (!storyboardDataUrl && serverPrep.storyboardDataUrl) {
          storyboardDataUrl = serverPrep.storyboardDataUrl;
        }
        if (serverPrep.previewFrame && !asset.previewUrl) {
          resolvedPreviewUrl = serverPrep.previewFrame;
        }
        if (serverPrep.proxyId) {
          videoProxyId = serverPrep.proxyId;
        }
        meta = {
          ...meta,
          width: meta.width || serverPrep.meta.width,
          height: meta.height || serverPrep.meta.height,
          durationSec: meta.durationSec || serverPrep.meta.durationSec,
          orientation: meta.orientation || serverPrep.meta.orientation,
          hasStoryboard: Boolean(storyboardDataUrl) || Boolean(serverPrep.meta.hasStoryboard),
          hasDirectVideo: Boolean(serverPrep.proxyId),
        };
      }
    }

    let fallbackImageData = storyboardDataUrl;
    if (!fallbackImageData && asset.previewUrl && asset.previewUrl.startsWith('data:image/')) {
      fallbackImageData = asset.previewUrl;
    }

    return {
      imageData: fallbackImageData,
      videoData,
      videoProxyId,
      resolvedPreviewUrl,
      mediaContext: meta,
    };
  }

  let imageData = '';
  let mediaContext: MediaInspectionMeta | undefined;

  if (hasFileBlob && asset.file) {
    try {
      const { dataUrl, meta } = await fileToFastThumbnailWithMeta(asset.file);
      imageData = dataUrl;
      if (meta?.width && meta?.height) {
        mediaContext = meta;
      }
    } catch (e) {
      console.warn('Fast thumbnail conversion warning:', e);
    }
  } else if (asset.previewUrl) {
    try {
      if (asset.previewUrl.startsWith('data:image/') && !asset.previewUrl.startsWith('data:image/svg+xml')) {
        imageData = asset.previewUrl;
      } else if (asset.previewUrl.startsWith('blob:') || asset.previewUrl.startsWith('https://')) {
        const resp = await fetch(asset.previewUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob && blob.size > 0) {
            const safeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
            imageData = await fileToFastThumbnail(new File([blob], asset.filename, { type: safeType }));
          }
        }
      }
    } catch (e) {
      console.warn('PreviewURL thumbnail conversion warning:', e);
    }
  }

  return { imageData, mediaContext };
}

// Clean JSON response from LLM
function extractJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

const clientKeyCooldownUntil = new Map<string, number>();
const clientUnsupportedModelUntil = new Map<string, number>();

function prioritizeHealthyClientKeys(keys: string[]): string[] {
  const now = Date.now();
  const healthy: string[] = [];
  const cooled: string[] = [];
  for (const k of keys) {
    const until = clientKeyCooldownUntil.get(k) || 0;
    if (until > now) cooled.push(k);
    else healthy.push(k);
  }
  return [...healthy, ...cooled];
}

function getFastClientModelCandidates(chosen?: string): string[] {
  const chosenModel = chosen && chosen.trim() ? chosen.trim() : 'gemini-4-hydrogen';
  const baseFreeModels = [
    chosenModel,
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ];
  if (chosenModel === 'gemini-4-neon' || chosenModel === 'gemini-3.1-pro-preview') {
    baseFreeModels.push('gemini-3.1-pro-preview');
  }
  const now = Date.now();
  const unique = baseFreeModels.filter((m, idx, arr) => arr.indexOf(m) === idx);
  const supported = unique.filter((m) => (clientUnsupportedModelUntil.get(m) || 0) <= now);
  return supported.length > 0 ? supported : unique;
}

// Client-side Direct Gemini API Call (Fallback when backend is unavailable on static hosts)
async function generateViaDirectGemini(
  apiKey: string,
  model: string | undefined,
  params: {
    filename: string;
    fileType?: string;
    imageData?: string;
    videoData?: string;
    mediaContext?: MediaInspectionMeta;
    marketplace: Marketplace;
    titleLength: number;
    descLength: number;
    keywordsCount: number;
    category?: string;
    customPrompt?: string;
    advanceIsolatedTransparent?: boolean;
    advanceIsolatedWhite?: boolean;
    advanceVector?: boolean;
    advanceIllustration?: boolean;
    includeConceptualKeywords?: boolean;
    hasMoreHealthyKeys?: boolean;
  }
) {
  const modelCandidates = getFastClientModelCandidates(model);

  const profile = getMarketplaceSeoProfile(
    params.marketplace,
    params.titleLength,
    params.keywordsCount
  );

  const hasDirectVideo = Boolean(
    params.videoData &&
      params.videoData.includes('base64') &&
      params.videoData.startsWith('data:video/')
  );

  const hasVisualData = Boolean(
    params.imageData &&
      params.imageData.includes('base64') &&
      !params.imageData.startsWith('data:image/svg+xml')
  );

  const videoDirective = getVideoSeoDirective(params.mediaContext, params.fileType);
  const imageFramingNote =
    params.fileType !== 'video' && params.mediaContext?.width && params.mediaContext?.height
      ? `- Technical Framing: ${params.mediaContext.width}x${params.mediaContext.height}px (${params.mediaContext.orientation || 'horizontal'}).\n`
      : '';

  const promptText = `${profile.systemPrompt}

TASK (95-99% PIXEL-PRECISION VISUAL ACCURACY MANDATE):
${hasDirectVideo
  ? `Watch the provided video file from start to end and describe PRECISELY what happens across the clip (subjects, motion, camera movement, setting, lighting) with ZERO guesswork. Rely ONLY on the visual footage.`
  : hasVisualData
  ? params.fileType === 'video'
    ? `Inspect the provided 4-frame chronological video storyboard (15%, 40%, 65%, 85% timestamps) and describe PRECISELY the subject, action progression, camera motion, lighting, and setting with ZERO guesswork.`
    : `Perform a thorough pixel-level visual inspection across ALL zones of the image BEFORE writing Title, Category, or Keywords:
1. Main subject, materials, hardware/anatomy, uniform/clothing, and exact physical state (e.g., robotic gripper holding 4TB hot-swap SSD drive, tactical sleeve ECG/GPS wrist monitor vs sports watch, white EV autonomous cabin with panoramic glass roof and no steering wheel).
2. Exact readable labels, numbers, and printed/screen text (only include text visibly readable—e.g. "4TB", "HOT-SWAP", "AUTO DRIVE ACTIVE", "COPY SPACE"). Never use "4k" in keywords on still photos even if printed on hardware.
3. Screen/hologram UI icons & graphics (heartbeat waveform, GPS pin, shield wireframe, data chart, network globe).
4. Background setting, depth/bokeh, motion-blur effects, lighting temperature, and whether large clean negative/copy space exists (tag "copy", "space" only when clearly present).`
  : `No raster preview could be extracted for "${params.filename}" (${params.fileType || 'file'}). Base metadata ONLY on clear factual words in topic/instructions or clean filename nouns without inventing unrelated scenes.`}
${videoDirective}${imageFramingNote}
ADDITIONAL ASSET PARAMETERS:
${params.advanceIsolatedTransparent ? `- ADVANCE TITLE REQUIREMENT: The asset is on a TRANSPARENT background. Ensure title ends with "isolated on transparent background" and keywords include ${params.marketplace === 'Adobe Stock' ? '"transparent", "background", "isolated", "cutout"' : '"transparent background", "isolated", "cut out"'}.` : ''}
${params.advanceIsolatedWhite ? `- ADVANCE TITLE REQUIREMENT: The asset is on a WHITE background. Ensure title ends with "isolated on white background" and keywords include ${params.marketplace === 'Adobe Stock' ? '"white", "background", "isolated", "studio"' : '"white background", "isolated", "studio shot"'}.` : ''}
${params.advanceVector ? '- ADVANCE ART STYLE: Include "Vector" in title and vector tags in keywords.' : ''}
${params.advanceIllustration ? '- ADVANCE ART STYLE: Include "Illustration" in title and illustration tags in keywords.' : ''}
${params.includeConceptualKeywords !== false ? `- CONCEPTUAL KEYWORDS (3-5 SCENE-ACCURATE ABSTRACT TAGS):
Analyze the true commercial purpose and mood of THIS exact image (e.g., efficiency, precision, security, telemetry, diagnostics, autonomy, reliability, connectivity, protection, sustainability). Avoid lazily repeating cliché filler like "innovation" or "future" unless directly fitting.
Integrate those 3-5 top conceptual/abstract single-word keywords into the main "keywords" array AND list them separately in "conceptualKeywords".` : ''}
- Description: ${params.descLength === 0 ? 'Strictly EMPTY string "" since description length is set to 0.' : params.marketplace === 'Shutterstock' ? `Rich, complete, searchable Shutterstock title-sentence strictly within ${Math.max(120, params.descLength)} characters (max 200 chars).` : `Concise commercial description sentence under ${params.descLength} characters (never cut mid-word).`}
- Category & Topic: Pick ONE exact official ${params.marketplace} category (e.g., Transport for vehicles/EV cabins/road barriers/highways; Industry for factory robots/recycling/warehouses; Science for surgical/labs/medicine/space stations; People for human hands/portraits; Technology for servers/chips/cameras/biometrics) plus a clean 2-3 word Subject/Topic.

${params.customPrompt && params.customPrompt.trim() && params.customPrompt.trim() !== profile.systemPrompt ? `ADDITIONAL CONTRIBUTOR INSTRUCTIONS:\n${params.customPrompt.trim()}` : ''}

Output ONLY valid JSON matching this schema (keep "visualAudit" crisp, 15-25 words max):
{
  "visualAudit": "Brief 15-25 word pixel check: main subject/materials, readable labels, UI icons, setting/lighting",
  "title": "Accurate stock title",
  "topic": "Subject topic",
  "description": "Stock description",
  "keywords": ["kw1", "kw2", ... ranked keywords],
  "conceptualKeywords": ["concept1", "concept2", "concept3"],
  "category": "Official Marketplace Category"
}`;

  const parts: any[] = [];
  if (hasDirectVideo && params.videoData) {
    const [header, base64] = params.videoData.split(';base64,');
    const mimeType = header ? header.replace('data:', '') : 'video/mp4';
    parts.push({
      inlineData: {
        mimeType: mimeType || 'video/mp4',
        data: base64,
      },
    });
  } else if (hasVisualData && params.imageData) {
    const [header, base64] = params.imageData.split(';base64,');
    const mimeType = header ? header.replace('data:', '') : 'image/jpeg';
    parts.push({
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: base64,
      },
    });
  }
  parts.push({ text: promptText });

  let lastError: any = null;
  for (let mIdx = 0; mIdx < modelCandidates.length; mIdx++) {
    const currentModel = modelCandidates[mIdx];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), hasDirectVideo ? 55000 : 18000);

      const generationConfig: any = {
        responseMimeType: 'application/json',
      };
      if (hasDirectVideo) {
        generationConfig.mediaResolution = 'MEDIA_RESOLUTION_MEDIUM';
      } else if (hasVisualData) {
        generationConfig.mediaResolution = 'MEDIA_RESOLUTION_HIGH';
      }

      if (currentModel.startsWith('gemini-4')) {
        generationConfig.thinkingConfig = {
          thinkingLevel: currentModel === 'gemini-4-neon' ? 'HIGH' : 'LOW',
        };
      } else if (currentModel === 'gemini-3.1-flash-lite') {
        generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
      } else if (currentModel === 'gemini-2.5-flash') {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
        generationConfig.temperature = 0.15;
      } else {
        generationConfig.temperature = 0.15;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        lastError = new Error(errorMsg);

        if (response.status === 404 || errorMsg.toLowerCase().includes('not found')) {
          clientUnsupportedModelUntil.set(currentModel, Date.now() + 600_000);
          continue;
        }

        if (
          response.status === 429 ||
          errorMsg.toLowerCase().includes('quota') ||
          errorMsg.toLowerCase().includes('rate') ||
          errorMsg.toLowerCase().includes('resource_exhausted')
        ) {
          clientKeyCooldownUntil.set(apiKey.trim(), Date.now() + 45_000);
          // Switch immediately to next healthy key on this primary working model without stalling!
          if (params.hasMoreHealthyKeys && mIdx === 0) {
            throw lastError;
          }
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }

        if (
          response.status === 401 ||
          (response.status === 403 && !errorMsg.toLowerCase().includes('model')) ||
          (response.status === 400 && errorMsg.toLowerCase().includes('api_key'))
        ) {
          clientKeyCooldownUntil.set(apiKey.trim(), Date.now() + 600_000);
          throw lastError;
        }

        continue;
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = extractJson(rawText);
      if (!parsed) {
        throw new Error('Could not parse Gemini JSON response');
      }

      let resTitle = sanitizeTitle((parsed.title || params.filename).trim());
      if (params.titleLength > 0 && resTitle.length > params.titleLength) {
        resTitle = truncateAtWordBoundary(resTitle.replace(/\.+$/, ''), params.titleLength - 1);
        resTitle = sanitizeTitle(resTitle);
      }

      let resDesc = '';
      if (params.descLength > 0 && parsed.description) {
        resDesc = truncateAtWordBoundary(sanitizeTitle(parsed.description.trim()), params.descLength);
      }

      const rawKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      const resKeywords = alignKeywordsWithTitle(resTitle, rawKeywords, params.keywordsCount || 30, params.marketplace, params.fileType as any);
      const conceptualKeywords: string[] = Array.isArray(parsed.conceptualKeywords)
        ? parsed.conceptualKeywords.map((k: string) => String(k).toLowerCase().trim()).filter(Boolean)
        : [];

      return {
        title: resTitle,
        rawTitle: parsed.title || resTitle,
        topic: parsed.topic || params.category || 'Stock Asset',
        description: resDesc,
        rawDescription: parsed.description || '',
        keywords: resKeywords,
        rawKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : resKeywords,
        conceptualKeywords,
        category: normalizeCategoryForMarketplace(parsed.category || params.category, params.marketplace),
        source: `Google Gemini (${currentModel}) Direct AI Vision`,
      };
    } catch (err: any) {
      lastError = err;
      const errLower = String(err?.message || '').toLowerCase();
      if (err?.name === 'AbortError') {
        lastError = new Error(`Request timed out for model ${currentModel}`);
        if (params.hasMoreHealthyKeys && mIdx === 0) {
          throw lastError;
        }
        continue;
      }
      if (params.hasMoreHealthyKeys && mIdx === 0 && (errLower.includes('429') || errLower.includes('quota') || errLower.includes('rate') || errLower.includes('resource_exhausted'))) {
        throw err;
      }
      if (
        errLower.includes('not found') ||
        errLower.includes('404') ||
        errLower.includes('quota') ||
        errLower.includes('rate') ||
        errLower.includes('429')
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed');
}

// Client-side Direct Groq API Call
async function generateViaDirectGroq(
  apiKey: string,
  model: string,
  params: {
    filename: string;
    fileType?: string;
    imageData?: string;
    mediaContext?: MediaInspectionMeta;
    marketplace: Marketplace;
    titleLength: number;
    descLength: number;
    keywordsCount: number;
    category?: string;
    customPrompt?: string;
    advanceIsolatedTransparent?: boolean;
    advanceIsolatedWhite?: boolean;
    advanceVector?: boolean;
    advanceIllustration?: boolean;
    includeConceptualKeywords?: boolean;
  }
) {
  const targetModel =
    model && !model.startsWith('gemini-')
      ? model
      : 'meta-llama/llama-4-scout-17b-16e-instruct';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const profile = getMarketplaceSeoProfile(
    params.marketplace,
    params.titleLength,
    params.keywordsCount
  );

  const hasVisualData = Boolean(
    params.imageData &&
      params.imageData.includes('base64') &&
      !params.imageData.startsWith('data:image/svg+xml')
  );

  const groqVideoDirective = getVideoSeoDirective(
    params.mediaContext ? { ...params.mediaContext, hasDirectVideo: false } : undefined,
    params.fileType
  );
  const imageFramingNote =
    params.fileType !== 'video' && params.mediaContext?.width && params.mediaContext?.height
      ? `- Technical Framing: ${params.mediaContext.width}x${params.mediaContext.height}px (${params.mediaContext.orientation || 'horizontal'}).\n`
      : '';

  const userContent: any[] = [];
  if (hasVisualData && params.imageData) {
    userContent.push({
      type: 'image_url',
      image_url: { url: params.imageData },
    });
  }
  userContent.push({
    type: 'text',
    text: `${profile.systemPrompt}
TASK: ${params.fileType === 'video' ? 'Inspect the 4-frame video storyboard (15%, 40%, 65%, 85%) carefully' : 'Scan every zone of the image carefully (subject, readable labels, UI icons, copy space, lighting)'} and output metadata optimized for ${params.marketplace}.
${groqVideoDirective}${imageFramingNote}${params.advanceIsolatedTransparent ? '- Isolated on transparent background.\n' : ''}${params.advanceIsolatedWhite ? '- Isolated on white background.\n' : ''}${params.advanceVector ? '- Include Vector style tags.\n' : ''}${params.advanceIllustration ? '- Include Illustration style tags.\n' : ''}${params.customPrompt && params.customPrompt.trim() && params.customPrompt.trim() !== profile.systemPrompt ? `ADDITIONAL INSTRUCTIONS:\n${params.customPrompt.trim()}\n` : ''}Output ONLY valid JSON matching this schema: {"visualAudit": "...", "title": "...", "topic": "...", "description": "...", "keywords": ["..."], "conceptualKeywords": ["..."], "category": "..."}`,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: targetModel,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Groq API responded with status ${response.status}`);
  }

  const result = await response.json();
  const rawText = result?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(rawText);
  if (!parsed) throw new Error('Could not parse Groq JSON response');

  let resTitle = sanitizeTitle((parsed.title || params.filename).trim());
  if (params.titleLength > 0 && resTitle.length > params.titleLength) {
    resTitle = truncateAtWordBoundary(resTitle.replace(/\.+$/, ''), params.titleLength - 1);
    resTitle = sanitizeTitle(resTitle);
  }

  let resDesc = '';
  if (params.descLength > 0 && parsed.description) {
    resDesc = truncateAtWordBoundary(sanitizeTitle(parsed.description.trim()), params.descLength);
  }

  const rawKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  const resKeywords = alignKeywordsWithTitle(resTitle, rawKeywords, params.keywordsCount || 30, params.marketplace, params.fileType as any);
  const conceptualKeywords: string[] = Array.isArray(parsed.conceptualKeywords)
    ? parsed.conceptualKeywords.map((k: string) => String(k).toLowerCase().trim()).filter(Boolean)
    : [];

  return {
    title: resTitle,
    rawTitle: parsed.title || resTitle,
    topic: parsed.topic || params.category || 'Stock Asset',
    description: resDesc,
    rawDescription: parsed.description || '',
    keywords: resKeywords,
    rawKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : resKeywords,
    conceptualKeywords,
    category: normalizeCategoryForMarketplace(parsed.category || params.category, params.marketplace),
    source: `Groq Cloud (${targetModel}) Client Direct`,
  };
}

// Built-in offline fallback (ONLY used when settings.offlineModeEnabled === true)
export function generateClientFallbackMetadata(
  filename: string,
  category = 'Lifestyle',
  marketplace: Marketplace = 'Adobe Stock',
  targetKeywordsCount = 30,
  maxTitleLength = 80,
  maxDescLength = 150,
  advanceVector = false,
  advanceIllustration = false,
  customTopic = '',
  includeConceptualKeywords = true
) {
  const cleanName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const meaningfulWords = cleanName
    .split(' ')
    .filter(
      (w) =>
        w.length > 2 &&
        !/^\d+$/.test(w) &&
        !['image', 'img', 'chatgpt', 'aug', 'pm', 'am', 'file', 'photo', 'picture', 'copy', 'final', 'v1', 'v2', 'edit', 'dsc', 'asset'].includes(
          w.toLowerCase()
        )
    );

  const selectedCategory = normalizeCategoryForMarketplace(
    category && category !== 'General' ? category : customTopic || 'Lifestyle',
    marketplace
  );
  const isVectorType =
    advanceVector ||
    advanceIllustration ||
    filename.toLowerCase().endsWith('.svg') ||
    filename.toLowerCase().endsWith('.eps') ||
    filename.toLowerCase().endsWith('.ai');

  let primarySubject = '';
  if (meaningfulWords.length >= 2) {
    primarySubject = meaningfulWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  } else if (customTopic && customTopic.trim().length > 3 && !/^\d+$/.test(customTopic)) {
    primarySubject = customTopic.trim();
  } else {
    primarySubject = isVectorType ? 'Modern Graphic Design Element' : 'Commercial Stock Scene';
  }

  let fullTitle = primarySubject;
  if (isVectorType && !fullTitle.toLowerCase().includes('vector')) {
    fullTitle += ' Vector Illustration';
  }

  fullTitle = truncateAtWordBoundary(fullTitle, maxTitleLength);
  const cleanedTitle = sanitizeTitle(fullTitle);

  const finalKeywords: string[] = [];
  meaningfulWords.forEach((w) => {
    const low = w.toLowerCase();
    if (!finalKeywords.includes(low)) finalKeywords.push(low);
  });
  if (isVectorType) {
    ['vector', 'illustration', 'graphic', 'design', 'isolated'].forEach((k) => {
      if (!finalKeywords.includes(k)) finalKeywords.push(k);
    });
  }

  const fallbackDesc =
    maxDescLength === 0
      ? ''
      : truncateAtWordBoundary(
          `${cleanedTitle.replace(/\.$/, '')} suitable for commercial design, advertising, and editorial use.`,
          maxDescLength
        );

  const alignedKeywords = alignKeywordsWithTitle(cleanedTitle, finalKeywords, targetKeywordsCount, marketplace, isVectorType ? 'vector' : 'image');

  return {
    title: cleanedTitle,
    rawTitle: cleanedTitle,
    topic: selectedCategory,
    description: fallbackDesc,
    rawDescription: fallbackDesc,
    keywords: alignedKeywords,
    rawKeywords: alignedKeywords,
    conceptualKeywords: includeConceptualKeywords ? ['creativity', 'modern', 'concept'] : undefined,
    category: selectedCategory,
    source: 'Offline Smart SEO Engine',
  };
}

// Master Unified Metadata Generator (Server-first with direct static-host fallback & strict error surfacing)
export async function generateMetadataForAsset(
  asset: StockAsset,
  settings: GenerationSettings,
  marketplace: Marketplace,
  keyPoolIndex = 0
): Promise<{
  title: string;
  rawTitle?: string;
  topic: string;
  description: string;
  rawDescription?: string;
  keywords: string[];
  rawKeywords?: string[];
  conceptualKeywords?: string[];
  category: string;
  source?: string;
  resolvedPreviewUrl?: string;
}> {
  const preferDirectVideo =
    !settings.offlineModeEnabled &&
    settings.aiProvider !== 'Groq Cloud' &&
    !(settings.customApiKey || '').trim().startsWith('gsk_');

  const { imageData, videoData, videoProxyId, resolvedPreviewUrl, mediaContext } = await prepareMediaPayload(
    asset,
    preferDirectVideo,
    settings.deepVideoProxy ?? true
  );

  // Only run offline heuristic generator if user explicitly enabled Offline Mode
  if (settings.offlineModeEnabled) {
    return generateClientFallbackMetadata(
      asset.filename,
      asset.category,
      marketplace,
      settings.keywordsCount,
      settings.titleLength,
      settings.descLength,
      asset.advanceVector ?? settings.advanceVector,
      asset.advanceIllustration ?? settings.advanceIllustration,
      asset.topic || settings.defaultTopic,
      settings.includeConceptualKeywords ?? true
    );
  }

  const allPoolKeys: string[] = [];
  if (Array.isArray(settings.apiKeys) && settings.apiKeys.length > 0) {
    settings.apiKeys.forEach((k) => {
      if (k && typeof k === 'string' && k.trim().length > 5 && !allPoolKeys.includes(k.trim())) {
        allPoolKeys.push(k.trim());
      }
    });
  }
  if (
    settings.customApiKey &&
    typeof settings.customApiKey === 'string' &&
    settings.customApiKey.trim().length > 5 &&
    !allPoolKeys.includes(settings.customApiKey.trim())
  ) {
    allPoolKeys.push(settings.customApiKey.trim());
  }

  const wantsGroq = settings.aiProvider === 'Groq Cloud';
  const candidateKeys = allPoolKeys.filter((k) => (wantsGroq ? k.startsWith('gsk_') : !k.startsWith('gsk_')));

  if (candidateKeys.length === 0) {
    throw new Error(
      wantsGroq
        ? 'Groq API Key Required: Please add a Groq Cloud API key (starts with gsk_) in API Key settings.'
        : 'Gemini API Key Required: Please add your Google Gemini API Key in API Key settings.'
    );
  }

  const rotatedKeys = [
    ...candidateKeys.slice(keyPoolIndex % candidateKeys.length),
    ...candidateKeys.slice(0, keyPoolIndex % candidateKeys.length),
  ];
  const orderedCandidateKeys = prioritizeHealthyClientKeys(rotatedKeys);

  // 1. Try Backend API first (skip immediately if static hosting like Vercel already detected)
  let shouldFallbackToDirectClient = isStaticHostMode;
  let serverErrorMessage = '';

  if (!shouldFallbackToDirectClient) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (videoData || videoProxyId) ? 95000 : 65000);

      const res = await fetch('/api/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          filename: asset.filename,
          fileType: asset.fileType,
          imageData,
          videoData,
          videoProxyId,
          mediaContext,
          aiProvider: settings.aiProvider,
          model: settings.model,
          marketplace,
          titleLength: settings.titleLength,
          descLength: settings.descLength,
          keywordsCount: settings.keywordsCount,
          customPrompt: settings.customPrompt,
          category: asset.category,
          topic: asset.topic || settings.defaultTopic,
          offlineMode: false,
          apiKey: orderedCandidateKeys[0],
          apiKeys: orderedCandidateKeys,
          advanceIsolatedTransparent: asset.advanceIsolatedTransparent ?? settings.advanceIsolatedTransparent,
          advanceIsolatedWhite: asset.advanceIsolatedWhite ?? settings.advanceIsolatedWhite,
          advanceVector: asset.advanceVector ?? settings.advanceVector,
          advanceIllustration: asset.advanceIllustration ?? settings.advanceIllustration,
          includeConceptualKeywords: settings.includeConceptualKeywords ?? true,
        }),
      });

      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');
      const data = isJsonResponse ? await res.json().catch(() => ({})) : {};

      if (res.ok && data && (data.title || data.keywords)) {
        let finalTitle = sanitizeTitle((data.title || asset.filename).trim());
        if (settings.titleLength > 0 && finalTitle.length > settings.titleLength) {
          finalTitle = truncateAtWordBoundary(finalTitle.replace(/\.+$/, ''), settings.titleLength - 1);
          finalTitle = sanitizeTitle(finalTitle);
        }

        let finalDesc = '';
        if (settings.descLength > 0 && data.description) {
          finalDesc = truncateAtWordBoundary(sanitizeTitle(data.description.trim()), settings.descLength);
        }

        const rawKeywords: string[] = Array.isArray(data.keywords) ? data.keywords : [];
        const finalKeywords = alignKeywordsWithTitle(finalTitle, rawKeywords, settings.keywordsCount || 30, marketplace, asset.fileType);

        return {
          ...data,
          title: finalTitle,
          rawTitle: data.rawTitle || finalTitle,
          description: finalDesc,
          rawDescription: data.rawDescription || data.description || '',
          keywords: finalKeywords,
          rawKeywords: data.rawKeywords || data.keywords || finalKeywords,
          conceptualKeywords: Array.isArray(data.conceptualKeywords) ? data.conceptualKeywords : undefined,
          category: normalizeCategoryForMarketplace(data.category || asset.category, marketplace),
          ...(resolvedPreviewUrl ? { resolvedPreviewUrl } : {}),
        };
      }

      // Static hosts (Vercel, Netlify, Cloudflare Pages) return 404/405/HTML for /api/* POST requests
      if (
        res.status === 404 ||
        res.status === 405 ||
        res.status === 501 ||
        !isJsonResponse
      ) {
        isStaticHostMode = true;
        shouldFallbackToDirectClient = true;
      } else if ((res.status === 502 || res.status === 503 || res.status === 504) && !data?.error) {
        shouldFallbackToDirectClient = true;
      } else {
        serverErrorMessage = data?.error || `Server error (${res.status})`;
      }
    } catch (backendErr: any) {
      // Network error / static host without Express backend / aborted
      shouldFallbackToDirectClient = true;
      serverErrorMessage = backendErr?.message || 'Backend connection failed';
    }
  }

  if (!shouldFallbackToDirectClient && serverErrorMessage) {
    throw new Error(serverErrorMessage);
  }

  // 2. Client-Side Direct API Fallback (only when backend endpoint is unavailable)
  let lastDirectError: any = null;
  for (let i = 0; i < orderedCandidateKeys.length; i++) {
    const currentKey = orderedCandidateKeys[i];
    const hasMoreKeys = i < orderedCandidateKeys.length - 1;
    try {
      if (settings.aiProvider === 'Groq Cloud') {
        return await generateViaDirectGroq(currentKey, settings.model || '', {
          filename: asset.filename,
          fileType: asset.fileType,
          imageData,
          mediaContext,
          marketplace,
          titleLength: settings.titleLength,
          descLength: settings.descLength,
          keywordsCount: settings.keywordsCount,
          category: asset.category,
          customPrompt: settings.customPrompt,
          advanceIsolatedTransparent: asset.advanceIsolatedTransparent ?? settings.advanceIsolatedTransparent,
          advanceIsolatedWhite: asset.advanceIsolatedWhite ?? settings.advanceIsolatedWhite,
          advanceVector: asset.advanceVector ?? settings.advanceVector,
          advanceIllustration: asset.advanceIllustration ?? settings.advanceIllustration,
          includeConceptualKeywords: settings.includeConceptualKeywords ?? true,
        });
      } else {
        return await generateViaDirectGemini(currentKey, settings.model, {
          filename: asset.filename,
          fileType: asset.fileType,
          imageData,
          videoData,
          mediaContext,
          marketplace,
          titleLength: settings.titleLength,
          descLength: settings.descLength,
          keywordsCount: settings.keywordsCount,
          category: asset.category,
          customPrompt: settings.customPrompt,
          advanceIsolatedTransparent: asset.advanceIsolatedTransparent ?? settings.advanceIsolatedTransparent,
          advanceIsolatedWhite: asset.advanceIsolatedWhite ?? settings.advanceIsolatedWhite,
          advanceVector: asset.advanceVector ?? settings.advanceVector,
          advanceIllustration: asset.advanceIllustration ?? settings.advanceIllustration,
          includeConceptualKeywords: settings.includeConceptualKeywords ?? true,
          hasMoreHealthyKeys: hasMoreKeys,
        });
      }
    } catch (clientDirectErr: any) {
      lastDirectError = clientDirectErr;
      const errMsg = String(clientDirectErr?.message || '').toLowerCase();
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('resource_exhausted')) {
        clientKeyCooldownUntil.set(currentKey, Date.now() + 45_000);
      } else if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('api_key')) {
        clientKeyCooldownUntil.set(currentKey, Date.now() + 600_000);
      }
      // Switch to next key immediately without blocking delay
    }
  }

  throw new Error(`AI Generation Error: ${lastDirectError?.message || serverErrorMessage || 'API key rejected or quota exhausted.'}`);
}

// Unified Reverse AI Image-to-Prompt Generator (Server-first with direct Gemini fallback for static hosts like Vercel)
export async function generateImagePromptForAsset(params: {
  filename: string;
  imageData?: string;
  category?: string;
  targetGenerator?: string;
  aspectRatio?: string;
  detailLevel?: string;
  customInstructions?: string;
  apiKeys?: string[];
  customApiKey?: string;
  model?: string;
}): Promise<{
  mainPrompt: string;
  geminiPrompt: string;
  flowPrompt: string;
  midjourneyPrompt: string;
  dallePrompt: string;
  fluxPrompt: string;
  negativePrompt: string;
}> {
  const candidateKeys: string[] = [];
  if (Array.isArray(params.apiKeys)) {
    params.apiKeys.forEach((k) => {
      if (k && typeof k === 'string' && k.trim().length > 5 && !candidateKeys.includes(k.trim())) {
        candidateKeys.push(k.trim());
      }
    });
  }
  if (params.customApiKey && params.customApiKey.trim().length > 5 && !candidateKeys.includes(params.customApiKey.trim())) {
    candidateKeys.push(params.customApiKey.trim());
  }

  const orderedKeys = prioritizeHealthyClientKeys(candidateKeys);

  if (!isStaticHostMode) {
    try {
      const res = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: params.filename,
          imageData: params.imageData,
          category: params.category,
          targetGenerator: params.targetGenerator || 'gemini',
          aspectRatio: params.aspectRatio || '16:9',
          detailLevel: params.detailLevel || 'standard',
          customInstructions: params.customInstructions || '',
          apiKey: orderedKeys[0],
          apiKeys: orderedKeys,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.mainPrompt) return data;
      } else if (res.status === 404 || res.status === 405 || res.status === 501 || !contentType.includes('application/json')) {
        isStaticHostMode = true;
      }
    } catch {
      // Fallback to direct Gemini
    }
  }

  const aspectRatio = params.aspectRatio || '16:9';
  const targetGenerator = params.targetGenerator || 'gemini';
  const detailLevel = params.detailLevel || 'standard';

  const geminiKeys = orderedKeys.filter((k) => !k.startsWith('gsk_'));
  if (geminiKeys.length > 0 && params.imageData && params.imageData.includes('base64')) {
    const promptText = `Analyze this stock image carefully and write high-precision generative AI reproduction prompts.
Target Engine: ${targetGenerator}, Aspect Ratio: ${aspectRatio}, Detail Level: ${detailLevel}.
${params.customInstructions ? `Notes: ${params.customInstructions}` : ''}
Output ONLY valid JSON with keys: "mainPrompt", "geminiPrompt", "flowPrompt", "midjourneyPrompt", "dallePrompt", "fluxPrompt", "negativePrompt".`;

    const [header, base64] = params.imageData.split(';base64,');
    const mimeType = header ? header.replace('data:', '') : 'image/jpeg';
    const parts = [
      { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } },
      { text: promptText },
    ];

    const chosenModel = params.model && params.model.startsWith('gemini-') ? params.model : 'gemini-4-hydrogen';
    const modelsToTry = [chosenModel, 'gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

    for (const key of geminiKeys) {
      for (const m of modelsToTry) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
            }
          );
          if (!resp.ok) {
            if (resp.status === 429) {
              clientKeyCooldownUntil.set(key, Date.now() + 45_000);
              break;
            }
            continue;
          }
          const json = await resp.json();
          const parsed = extractJson(json?.candidates?.[0]?.content?.parts?.[0]?.text || '');
          if (parsed?.mainPrompt) {
            return {
              mainPrompt: parsed.mainPrompt || '',
              geminiPrompt: parsed.geminiPrompt || parsed.mainPrompt || '',
              flowPrompt: parsed.flowPrompt || parsed.mainPrompt || '',
              midjourneyPrompt: parsed.midjourneyPrompt || `${parsed.mainPrompt} --ar ${aspectRatio} --v 6.0`,
              dallePrompt: parsed.dallePrompt || parsed.mainPrompt || '',
              fluxPrompt: parsed.fluxPrompt || parsed.mainPrompt || '',
              negativePrompt: parsed.negativePrompt || 'blurry, low quality, watermark, text, distorted',
            };
          }
        } catch {}
      }
    }
  }

  const cleanName = params.filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() || 'commercial stock scene';
  const basePrompt = `High quality commercial stock photograph of ${cleanName}, studio lighting, clean composition, sharp focus, 8k resolution`;
  return {
    mainPrompt: basePrompt,
    geminiPrompt: `${basePrompt}, shot on 85mm lens f/1.8, natural volumetric light, clear background separation.`,
    flowPrompt: `Flow AI: ${basePrompt}, crisp commercial microstock aesthetic, balanced negative space.`,
    midjourneyPrompt: `${basePrompt} --ar ${aspectRatio} --v 6.0 --style raw --stylize 250`,
    dallePrompt: `A high-resolution commercial photograph of ${cleanName} with diffused studio lighting and clean framing.`,
    fluxPrompt: `Cinematic photo of ${cleanName}, photorealistic textures, natural lighting, 8k uhd.`,
    negativePrompt: 'blurry, low quality, distorted anatomy, text, watermark, signature, artifacts',
  };
}

