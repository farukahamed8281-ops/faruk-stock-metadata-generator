import JSZip from 'jszip';
import { StockAsset, Marketplace } from '../types';
import { injectMetadataIntoFile } from './metadataEmbedder';

export interface ZipExportOptions {
  marketplace?: Marketplace;
  targetExtension?: string;
  autoRenameToTitle?: boolean;
  includeTimestamp?: boolean;
  embedExifMetadata?: boolean;
  defaultTopic?: string;
  saveJpegInFolder?: boolean;
}

/**
 * Generates a clean, filesystem-safe filename from asset title
 * e.g. "Architect reviewing blueprints" -> "Architect_reviewing_blueprints_202608290431.jpeg"
 */
export function generateRenamedFilename(
  originalFilename: string,
  title: string,
  targetExtension?: string,
  includeTimestamp: boolean = false
): string {
  const originalExt = originalFilename.split('.').pop() || 'jpg';
  const cleanExt = targetExtension && targetExtension.toLowerCase() !== 'default'
    ? targetExtension.trim().replace(/^\./, '')
    : originalExt;

  if (!title || !title.trim()) {
    return originalFilename.replace(/\.[^/.]+$/, '') + '.' + cleanExt;
  }

  // Clean title for safe filesystem name
  let cleanTitle = title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
    .replace(/_+$/, '');

  if (!cleanTitle) cleanTitle = 'Stock_Asset';

  if (includeTimestamp) {
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${cleanTitle}_${ts}.${cleanExt}`;
  }

  return `${cleanTitle}.${cleanExt}`;
}

export async function exportAssetsToZip(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  options?: ZipExportOptions
): Promise<void> {
  if (!assets || assets.length === 0) return;

  const zip = new JSZip();
  const autoRename = options?.autoRenameToTitle ?? true;
  const includeTimestamp = options?.includeTimestamp ?? false;
  const embedExif = options?.embedExifMetadata ?? true;
  const defaultTopic = options?.defaultTopic || 'Stock Design';
  const saveJpegInFolder = options?.saveJpegInFolder ?? false;

  const getExportFilename = (asset: StockAsset) => {
    if (autoRename && asset.title) {
      return generateRenamedFilename(asset.filename, asset.title, targetExtension, includeTimestamp);
    }
    const cleanExt = targetExtension && targetExtension.toLowerCase() !== 'default'
      ? targetExtension.trim().replace(/^\./, '')
      : null;
    if (!cleanExt) return asset.filename;
    return asset.filename.replace(/\.[^/.]+$/, '') + '.' + cleanExt;
  };

  // 1. Generate and add marketplace CSV file to ZIP
  let csvContent = '';
  const sanitize = (text: string = '') => {
    const cleaned = (text || '').replace(/"/g, '""').trim();
    return `"${cleaned}"`;
  };

  if (marketplace === 'Adobe Stock') {
    csvContent += 'Filename,Title,Keywords,Category\n';
    const rows = assets.map((asset) => {
      const exportName = getExportFilename(asset);
      const keywordsStr = (asset.keywords || []).join(', ');
      return [
        sanitize(exportName),
        sanitize(asset.title || asset.filename),
        sanitize(keywordsStr),
        sanitize(asset.category || 'Graphic Resources'),
      ].join(',');
    });
    csvContent += rows.join('\n');
  } else if (marketplace === 'Shutterstock') {
    csvContent += 'Filename,Description,Keywords,Categories\n';
    const rows = assets.map((asset) => {
      const exportName = getExportFilename(asset);
      const keywordsStr = (asset.keywords || []).join(', ');
      return [
        sanitize(exportName),
        sanitize(asset.description || asset.title || asset.filename),
        sanitize(keywordsStr),
        sanitize(asset.category || 'Abstract'),
      ].join(',');
    });
    csvContent += rows.join('\n');
  } else if (marketplace === 'Magnific') {
    csvContent += 'Filename,Title,Tags\n';
    const rows = assets.map((asset) => {
      const exportName = getExportFilename(asset);
      const tagsStr = (asset.keywords || []).map((k) => k.toLowerCase()).join(',');
      return [
        sanitize(exportName),
        sanitize(asset.title || asset.filename),
        sanitize(tagsStr),
      ].join(',');
    });
    csvContent += rows.join('\n');
  } else {
    csvContent += 'Filename,Title,Description,Keywords,Category,Topic\n';
    const rows = assets.map((asset) => {
      const exportName = getExportFilename(asset);
      const keywordsStr = (asset.keywords || []).join(', ');
      return [
        sanitize(exportName),
        sanitize(asset.title),
        sanitize(asset.description),
        sanitize(keywordsStr),
        sanitize(asset.category || 'General'),
        sanitize(asset.topic || defaultTopic),
      ].join(',');
    });
    csvContent += rows.join('\n');
  }

  const csvName = `${marketplace.toLowerCase().replace(/\s+/g, '_')}_metadata.csv`;
  zip.file(csvName, csvContent);

  // 2. Add individual metadata text/json documentation folder
  const metadataFolder = zip.folder('metadata_files');
  assets.forEach((asset) => {
    const exportName = getExportFilename(asset);
    const baseName = exportName.replace(/\.[^/.]+$/, '');
    const safeTopic = asset.topic || asset.category || defaultTopic;

    const txtContent = `=== FarukStock AI Metadata ===
Target Marketplace: ${marketplace}
Exported Filename: ${exportName}
Original Filename: ${asset.filename}

Title (XPTitle / Headline):
${asset.title}

Topic / Subject (XPSubject / Category):
${safeTopic}

Rating: 5 Stars (⭐⭐⭐⭐⭐)

Description (Comments / XPComment):
${asset.description}

Tags / Keywords (${asset.keywords?.length || 0} items):
${(asset.keywords || []).join(', ')}

Embedded Formats:
- Windows EXIF: XPTitle, XPSubject, Rating=5, XPKeywords, XPComment
- IPTC-IIM: ObjectName, Headline, Category, Keywords, Caption
- Adobe XMP: dc:title, dc:subject, dc:description, xmp:Rating=5, photoshop:Category
`;
    metadataFolder?.file(`${baseName}_metadata.txt`, txtContent);
  });

  // 3. Losslessly embed EXIF/IPTC/XMP into actual image files and bundle in ZIP
  const targetFolder = saveJpegInFolder ? zip.folder('images') || zip : zip;

  for (const asset of assets) {
    const exportName = getExportFilename(asset);
    const safeTopic = asset.topic || asset.category || defaultTopic;

    let sourceBlob: Blob | null = null;

    if (asset.file) {
      sourceBlob = asset.file;
    } else if (asset.previewUrl && asset.previewUrl.startsWith('data:')) {
      // Convert data URL to Blob
      try {
        const res = await fetch(asset.previewUrl);
        sourceBlob = await res.blob();
      } catch {
        sourceBlob = null;
      }
    }

    if (sourceBlob) {
      if (embedExif) {
        try {
          // Inject lossless EXIF / IPTC / XMP metadata (0% quality loss)
          const { buffer } = await injectMetadataIntoFile(sourceBlob, exportName, {
            title: asset.title || asset.filename,
            topic: safeTopic,
            category: asset.category,
            description: asset.description || asset.title || asset.filename,
            keywords: asset.keywords || [],
            rating: 5,
          });
          targetFolder.file(exportName, buffer);
        } catch (embedErr) {
          console.warn('Fallback embedding for file:', exportName, embedErr);
          const rawBuffer = await sourceBlob.arrayBuffer();
          targetFolder.file(exportName, rawBuffer);
        }
      } else {
        const rawBuffer = await sourceBlob.arrayBuffer();
        targetFolder.file(exportName, rawBuffer);
      }
    }
  }

  // 4. Generate the ZIP blob and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeMarketplace = marketplace.toLowerCase().replace(/\s+/g, '_');
  link.setAttribute('download', `FarukStock_${safeMarketplace}_Package.zip`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
