import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker to local bundled file via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Converts PDF file pages into base64 JPEG image strings.
 * @param file - The PDF File object
 * @param maxPages - Maximum pages to convert (default 50)
 * @param scale - Render scale for quality (default 2.0)
 * @param onPageConverted - Optional callback after each page
 */
export async function convertPdfToImages(
  file: File,
  maxPages = 50,
  scale = 2.0,
  onPageConverted?: (pageNum: number, total: number) => void
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport } as any).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));
    onPageConverted?.(i, numPages);
  }

  return images;
}

/**
 * Returns total page count of a PDF without rendering.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

/**
 * Crops a region from a base64 image using normalized coordinates [0,1].
 */
export async function cropImage(
  base64Image: string,
  y1: number,
  x1: number,
  y2: number,
  x2: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));

      const xmin = Math.min(x1, x2);
      const xmax = Math.max(x1, x2);
      const ymin = Math.min(y1, y2);
      const ymax = Math.max(y1, y2);

      let width = (xmax - xmin) * img.width;
      let height = (ymax - ymin) * img.height;

      if (width <= 0) width = img.width;
      if (height <= 0) height = img.height;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(
        img,
        xmin * img.width,
        ymin * img.height,
        width,
        height,
        0,
        0,
        width,
        height
      );

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64Image;
  });
}
