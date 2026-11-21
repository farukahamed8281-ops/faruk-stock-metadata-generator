import { Marketplace, StockAsset } from '../types';
import { generateRenamedFilename } from './zipExporter';
import { normalizeCategoryForMarketplace, truncateAtWordBoundary } from './stockSeoSanitizer';

export function generateCsvContent(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  autoRenameToTitle: boolean = true
): string {
  if (!assets || assets.length === 0) return '';

  let csvContent = '';
  const sanitize = (text: string) => {
    if (!text) return '""';
    const cleaned = text.replace(/"/g, '""');
    return `"${cleaned}"`;
  };

  const getExportFilename = (asset: StockAsset) => {
    if (autoRenameToTitle && asset.title) {
      return generateRenamedFilename(asset.filename, asset.title, targetExtension, false);
    }
    if (!targetExtension || !targetExtension.trim() || targetExtension.toLowerCase() === 'default') return asset.filename;
    const cleanExt = targetExtension.trim().replace(/^\./, '');
    return asset.filename.replace(/\.[^/.]+$/, '') + '.' + cleanExt;
  };

  if (marketplace === 'Adobe Stock') {
    const headers = ['Filename', 'Title', 'Keywords', 'Category'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).slice(0, 49).join(', ');
      const adobeCat = normalizeCategoryForMarketplace(asset.category, 'Adobe Stock');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(truncateAtWordBoundary(asset.title || asset.filename, 200)),
        sanitize(keywordsStr),
        sanitize(adobeCat),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else if (marketplace === 'Shutterstock') {
    const headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).slice(0, 50).join(', ');
      // On Shutterstock, Description IS the primary searchable title (up to 200 chars).
      // Pick the richer descriptive field so it is never crippled at 57 chars.
      const primaryDesc =
        asset.description && asset.description.length >= (asset.title?.length || 0)
          ? asset.description
          : asset.title || asset.description || asset.filename;
      const ssDesc = truncateAtWordBoundary(primaryDesc, 200);
      const ssCat = normalizeCategoryForMarketplace(asset.category, 'Shutterstock');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(ssDesc),
        sanitize(keywordsStr),
        sanitize(ssCat),
        '"no"',
        '"no"',
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else if (marketplace === 'Magnific') {
    // Freepik / Magnific Contributor official CSV schema
    const headers = ['Filename', 'Title', 'Keywords'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).slice(0, 50).map((k) => k.toLowerCase()).join(', ');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(truncateAtWordBoundary(asset.title || asset.filename, 200)),
        sanitize(keywordsStr),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else {
    const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category', 'Platform'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).join(', ');
      const normalizedCat = normalizeCategoryForMarketplace(asset.category, marketplace);
      return [
        sanitize(getExportFilename(asset)),
        sanitize(asset.title),
        sanitize(asset.description),
        sanitize(keywordsStr),
        sanitize(normalizedCat),
        sanitize(marketplace),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  }

  return csvContent;
}

export function exportAssetsToCsv(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  autoRenameToTitle: boolean = true
): void {
  const csvContent = generateCsvContent(assets, marketplace, targetExtension, autoRenameToTitle);
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
