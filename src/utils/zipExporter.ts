import JSZip from 'jszip';
import { StockAsset, Marketplace } from '../types';
import { injectMetadataIntoFile } from './metadataEmbedder';
import {
  generateCsvContent,
  generateRenamedFilename,
  resolveBatchExportFilenames,
} from './csvExporter';
import { normalizeCategoryForMarketplace } from './stockSeoSanitizer';

const isPlaceholderTopic = (val?: string): boolean => {
  const norm = (val || '').trim().toLowerCase();
  return !norm || norm === 'general stock' || norm === 'stock design' || norm === 'stock topic' || norm === 'stock asset' || norm === 'general';
};

const resolveCleanTopic = (...candidates: (string | undefined)[]): string => {
  for (const c of candidates) {
    const trimmed = (c || '').trim();
    if (trimmed && !isPlaceholderTopic(trimmed)) return trimmed;
  }
  return 'Stock Media';
};

export { generateRenamedFilename };

export interface ZipExportOptions {
  marketplace?: Marketplace;
  targetExtension?: string;
  autoRenameToTitle?: boolean;
  includeTimestamp?: boolean;
  embedExifMetadata?: boolean;
  authorName?: string;
  defaultTopic?: string;
  saveJpegInFolder?: boolean;
  includeMetadataTxt?: boolean;
}

export interface ZipExportResult {
  packagedCount: number;
  missingRawFilesCount: number;
}

export async function exportAssetsToZip(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  options?: ZipExportOptions
): Promise<ZipExportResult> {
  if (!assets || assets.length === 0) {
    return { packagedCount: 0, missingRawFilesCount: 0 };
  }

  const zip = new JSZip();
  const autoRename = options?.autoRenameToTitle ?? true;
  const includeTimestamp = options?.includeTimestamp ?? false;
  const embedExif = options?.embedExifMetadata ?? true;
  const defaultTopic = options?.defaultTopic || 'Stock Design';
  const saveJpegInFolder = options?.saveJpegInFolder ?? false;
  const includeMetadataTxt = options?.includeMetadataTxt ?? false;

  // Resolve guaranteed collision-free filenames shared identically between CSV rows and image files inside ZIP
  const exportFilenames = resolveBatchExportFilenames(
    assets,
    targetExtension,
    autoRename,
    includeTimestamp
  );

  // 1. Generate and add marketplace CSV file to ZIP
  const csvContent = generateCsvContent(
    assets,
    marketplace,
    targetExtension,
    autoRename,
    includeTimestamp,
    exportFilenames
  );
  const csvName = `${marketplace.toLowerCase().replace(/\s+/g, '_')}_metadata.csv`;
  zip.file(csvName, csvContent);

  // 2. Optional text documentation folder (disabled by default to keep ZIP clean & marketplace-ready)
  if (includeMetadataTxt) {
    const metadataFolder = zip.folder('metadata_files');
    assets.forEach((asset, idx) => {
      const exportName = exportFilenames[idx];
      const baseName = exportName.replace(/\.[^/.]+$/, '');
      const cleanCategory = normalizeCategoryForMarketplace(asset.category, marketplace);
      const safeTopic = resolveCleanTopic(asset.topic, cleanCategory, defaultTopic);
      const resolvedAuthor = asset.author || options?.authorName?.trim() || '';

      const txtContent = `=== FarukStock AI Metadata ===
Target Marketplace: ${marketplace}
Exported Filename: ${exportName}
Original Filename: ${asset.filename}
Contributor / Author: ${resolvedAuthor || '(Blank)'}

Title (XPTitle / Headline):
${asset.title}

Topic / Subject (XPSubject / Category):
${safeTopic}

Rating: 5 Stars (⭐⭐⭐⭐⭐)

Description (Comments / XPComment):
${asset.description || '(None)'}

Tags / Keywords (${asset.keywords?.length || 0} items):
${(asset.keywords || []).join(', ')}

Embedded Formats:
- Windows EXIF: XPTitle, XPSubject, Rating=5, XPKeywords${asset.description ? ', XPComment' : ''}${resolvedAuthor ? `, Artist (${resolvedAuthor})` : ''}
- IPTC-IIM: ObjectName, Headline, Category, Keywords${asset.description ? ', Caption' : ''}${resolvedAuthor ? `, By-line (${resolvedAuthor})` : ''}
- Adobe XMP: dc:title, dc:subject${asset.description ? ', dc:description' : ''}, xmp:Rating=5, photoshop:Category${resolvedAuthor ? `, dc:creator (${resolvedAuthor})` : ''}
`;
      metadataFolder?.file(`${baseName}_metadata.txt`, txtContent);
    });
  }

  // 3. Losslessly embed EXIF/IPTC/XMP into actual image files and bundle in ZIP
  const targetFolder = saveJpegInFolder ? zip.folder('images') || zip : zip;
  const maxKeywordsLimit = marketplace === 'Adobe Stock' ? 49 : 50;
  const requiresCaption = ['Shutterstock', 'Getty Images', 'iStock', 'Dreamstime'].includes(marketplace);
  let packagedCount = 0;
  let missingRawFilesCount = 0;

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const exportName = exportFilenames[i];
    const cleanCategory = normalizeCategoryForMarketplace(asset.category, marketplace);
    const safeTopic = resolveCleanTopic(asset.topic, cleanCategory, defaultTopic);
    const assetAuthor = asset.author || options?.authorName?.trim() || undefined;
    const cappedKeywords = (asset.keywords || []).slice(0, maxKeywordsLimit);
    const embedDesc = (asset.description || '').trim() || (requiresCaption ? (asset.title || '') : '');

    let sourceBlob: Blob | null = null;

    if (asset.file instanceof Blob) {
      sourceBlob = asset.file;
    } else if (asset.previewUrl && (asset.previewUrl.startsWith('data:') || asset.previewUrl.startsWith('https://'))) {
      try {
        const res = await fetch(asset.previewUrl);
        if (res.ok) {
          const fetched = await res.blob();
          if (fetched.size > 0) sourceBlob = fetched;
        }
      } catch {
        sourceBlob = null;
      }
    }

    if (sourceBlob) {
      if (embedExif) {
        try {
          // Inject lossless EXIF / IPTC / XMP metadata without falling back to Title for Description on Adobe Stock
          const { buffer } = await injectMetadataIntoFile(sourceBlob, exportName, {
            title: asset.title || asset.filename,
            topic: safeTopic,
            category: cleanCategory,
            description: embedDesc,
            keywords: cappedKeywords,
            rating: 5,
            author: assetAuthor,
          });
          targetFolder.file(exportName, buffer);
          packagedCount++;
        } catch (embedErr) {
          console.warn('Fallback embedding for file:', exportName, embedErr);
          const rawBuffer = await sourceBlob.arrayBuffer();
          targetFolder.file(exportName, rawBuffer);
          packagedCount++;
        }
      } else {
        const rawBuffer = await sourceBlob.arrayBuffer();
        targetFolder.file(exportName, rawBuffer);
        packagedCount++;
      }
    } else {
      missingRawFilesCount++;
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

  return { packagedCount, missingRawFilesCount };
}
