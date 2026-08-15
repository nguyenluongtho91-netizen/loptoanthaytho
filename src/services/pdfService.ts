import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: 'Không có file' };
  if (!file.name.toLowerCase().endsWith('.pdf')) return { valid: false, error: 'File không phải PDF' };
  if (file.type && file.type !== 'application/pdf') {
    // Some browsers may return empty type; allow that
    return { valid: false, error: `MIME type không đúng (${file.type})` };
  }
  // 50MB hard guard
  if (file.size > 50 * 1024 * 1024) return { valid: false, error: 'PDF quá lớn (>50MB)' };
  return { valid: true };
}

export async function getPdfMetadata(file: File): Promise<{
  totalPages: number;
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  return {
    totalPages,
    fileName: file.name,
    fileSize: file.size,
    fileSizeFormatted: formatBytes(file.size)
  };
}

export async function pdfToPageImages(
  file: File,
  options?: { scale?: number; maxPages?: number; pageNumbers?: number[] }
): Promise<Array<{ pageNumber: number; base64: string; mimeType: string }>> {
  const scale = options?.scale ?? 2;
  const maxPages = options?.maxPages ?? 10;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const total = pdf.numPages;

  const targetPages = options?.pageNumbers?.length
    ? options.pageNumbers.filter(p => p >= 1 && p <= total)
    : Array.from({ length: Math.min(total, maxPages) }, (_, i) => i + 1);

  const out: Array<{ pageNumber: number; base64: string; mimeType: string }> = [];

  for (const pageNo of targetPages) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không tạo được canvas context');

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx as any, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    out.push({ pageNumber: pageNo, base64, mimeType: 'image/png' });
  }

  return out;
}

/**
 * ✅ Backward-compatible alias:
 * Nhiều chỗ cũ đang gọi pdfToBase64Images(file, maxPagesOrTotalPages)
 * -> map sang pdfToPageImages.
 */
export async function pdfToBase64Images(
  file: File,
  maxPagesOrTotalPages = 10,
  scale = 2
): Promise<Array<{ pageNumber: number; base64: string; mimeType: string }>> {
  return pdfToPageImages(file, { maxPages: maxPagesOrTotalPages, scale });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = bytes / Math.pow(k, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}
