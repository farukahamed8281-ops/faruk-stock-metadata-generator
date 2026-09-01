import { Marketplace, StockAsset } from '../types';
import { generateRenamedFilename } from './zipExporter';

export function exportAssetsToCsv(
  assets: StockAsset[],
  marketplace: Marketplace = 'Adobe Stock',
  targetExtension?: string,
  autoRenameToTitle: boolean = true
): void {
  if (!assets || assets.length === 0) return;

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
    // Adobe Stock CSV Standard:
    // Filename, Title, Keywords, Category
    const headers = ['Filename', 'Title', 'Keywords', 'Category'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).join(', ');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(asset.title || asset.filename),
        sanitize(keywordsStr),
        sanitize(asset.category || 'Graphic Resources'),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else if (marketplace === 'Shutterstock') {
    // Shutterstock CSV Standard:
    // Filename, Description, Keywords, Categories, Editorial, Mature Content, Illustration
    const headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).join(', ');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(asset.description || asset.title || asset.filename),
        sanitize(keywordsStr),
        sanitize(asset.category || 'Abstract'),
        '"no"',
        '"no"',
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else if (marketplace === 'Magnific' || (marketplace as string) === 'Freepik') {
    // Magnific / Freepik CSV:
    // File, Title, Tags
    const headers = ['File', 'Title', 'Tags'];
    const rows = assets.map((asset) => {
      const tagsStr = (asset.keywords || []).map((k) => k.toLowerCase()).join(',');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(asset.title || asset.filename),
        sanitize(tagsStr),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  } else {
    // Universal General CSV
    const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category', 'Platform'];
    const rows = assets.map((asset) => {
      const keywordsStr = (asset.keywords || []).join(', ');
      return [
        sanitize(getExportFilename(asset)),
        sanitize(asset.title),
        sanitize(asset.description),
        sanitize(keywordsStr),
        sanitize(asset.category),
        sanitize(marketplace),
      ].join(',');
    });
    csvContent = [headers.join(','), ...rows].join('\r\n');
  }

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
