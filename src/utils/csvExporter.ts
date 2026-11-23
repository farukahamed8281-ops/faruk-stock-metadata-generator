import { Marketplace, StockAsset } from '../types';
import { normalizeCategoryForMarketplace, truncateAtWordBoundary } from './stockSeoSanitizer';

/**
 * Generates a clean, filesystem-safe filename from asset title
 * e.g. "Architect reviewing blueprints" -> "Architect_reviewing_blueprints.jpg"
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

/**
 * Ensures exported filenames never collide inside a ZIP or CSV batch (adds _2, _3 before extension on duplicates)
 */
export function resolveUniqueFilename(candidate: string, usedLowerNames: Set<string>): string {
  const lower = candidate.toLowerCase();
  if (!usedLowerNames.has(lower)) {
    usedLowerNames.add(lower);
    return candidate;
  }

  const dotIdx = candidate.lastIndexOf('.');
  const stem = dotIdx > 0 ? candidate.slice(0, dotIdx) : candidate;
  const ext = dotIdx > 0 ? candidate.slice(dotIdx) : '';

  let counter = 2;
  while (true) {
    const attempt = `${stem}_${counter}${ext}`;
    const attemptLower = attempt.toLowerCase();
    if (!usedLowerNames.has(attemptLower)) {
      usedLowerNames.add(attemptLower);
      return attempt;
    }
    counter++;
  }
}

export function resolveBatchExportFilenames(
  assets: StockAsset[],
  targetExtension?: string,
  autoRenameToTitle: boolean = true,
  includeTimestamp: boolean = false
): string[] {
  const usedLowerNames = new Set<string>();
  const cleanExtOverride =
    targetExtension && targetExtension.trim() && targetExtension.toLowerCase() !== 'default'
      ? targetExtension.trim().replace(/^\./, '')
      : null;

  return assets.map((asset) => {
    let baseName: string;
    if (autoRenameToTitle && asset.title) {
      baseName = generateRenamedFilename(asset.filename, asset.title, targetExtension, includeTimestamp);
    } else if (cleanExtOverride) {
      baseName = asset.filename.replace(/\.[^/.]+$/, '') + '.' + cleanExtOverride;
    } else {
      baseName = asset.filename;
    }
    return resolveUniqueFilename(baseName, usedLowerNames);
  });
}

export function generateCsvContent(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  autoRenameToTitle: boolean = true,
  includeTimestamp: boolean = false,
  preResolvedFilenames?: string[]
): string {
  if (!assets || assets.length === 0) return '';

  const exportNames =
    preResolvedFilenames && preResolvedFilenames.length === assets.length
      ? preResolvedFilenames
      : resolveBatchExportFilenames(assets, targetExtension, autoRenameToTitle, includeTimestamp);

  let csvContent = '';
  const sanitize = (text: string) => {
    if (!text) return '""';
    const cleaned = text.replace(/"/g, '""');
    return `"${cleaned}"`;
  };

  const formatCsvTitle = (rawTitle: string, maxLen: number = 200) => {
    const trimmed = (rawTitle || '').trim();
    if (!trimmed) return '';
    if (trimmed.length <= maxLen) return trimmed;
    const truncated = truncateAtWordBoundary(trimmed.replace(/\.+$/, ''), maxLen - 1);
    return truncated ? `${truncated}.` : '';
  };

  if (marketplace === 'Adobe Stock') {
    const headers = ['Filename', 'Title', 'Keywords', 'Category'];
    const rows = assets.map((asset, idx) => {
      const keywordsStr = (asset.keywords || []).slice(0, 49).join(', ');
      const adobeCat = normalizeCategoryForMarketplace(asset.category, 'Adobe Stock');
      return [
        sanitize(exportNames[idx]),
        sanitize(formatCsvTitle(asset.title || asset.filename, 200)),
        sanitize(keywordsStr),
        sanitize(adobeCat),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else if (marketplace === 'Shutterstock') {
    const headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature'];
    const rows = assets.map((asset, idx) => {
      const keywordsStr = (asset.keywords || []).slice(0, 50).join(', ');
      const primaryDesc =
        asset.description && asset.description.length >= (asset.title?.length || 0)
          ? asset.description
          : asset.title || asset.description || asset.filename;
      const ssDesc = truncateAtWordBoundary(primaryDesc, 200);
      const ssCat = normalizeCategoryForMarketplace(asset.category, 'Shutterstock');
      return [
        sanitize(exportNames[idx]),
        sanitize(ssDesc),
        sanitize(keywordsStr),
        sanitize(ssCat),
        '"no"',
        '"no"',
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else if (marketplace === 'Magnific') {
    const headers = ['Filename', 'Title', 'Keywords'];
    const rows = assets.map((asset, idx) => {
      const keywordsStr = (asset.keywords || []).slice(0, 50).map((k) => k.toLowerCase()).join(', ');
      return [
        sanitize(exportNames[idx]),
        sanitize(formatCsvTitle(asset.title || asset.filename, 200)),
        sanitize(keywordsStr),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else {
    const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category', 'Platform'];
    const rows = assets.map((asset, idx) => {
      const keywordsStr = (asset.keywords || []).join(', ');
      const normalizedCat = normalizeCategoryForMarketplace(asset.category, marketplace);
      return [
        sanitize(exportNames[idx]),
        sanitize(asset.title),
        sanitize(asset.description),
        sanitize(keywordsStr),
        sanitize(normalizedCat),
        sanitize(marketplace),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  }

  // Only add UTF-8 BOM when non-ASCII characters are present so strict ASCII CSV parsers see clean "Filename" header
  if (/[^\x00-\x7F]/.test(csvContent)) {
    return '\uFEFF' + csvContent;
  }
  return csvContent;
}

export function exportAssetsToCsv(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  autoRenameToTitle: boolean = true,
  includeTimestamp: boolean = false
): void {
  const csvContent = generateCsvContent(assets, marketplace, targetExtension, autoRenameToTitle, includeTimestamp);
  if (!csvContent) return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeMarketplace = marketplace.toLowerCase().replace(/\s+/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeMarketplace}_metadata.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAssetsToJson(assets: StockAsset[]): void {
  const data = JSON.stringify(assets, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'metadata_export.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
