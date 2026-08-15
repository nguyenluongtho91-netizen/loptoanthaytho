// src/services/api.ts
import { TikZRequest, TikZResponse } from '../types';

// API Configuration
const TIKZ_API_URL = 'https://tikz-fly.fly.dev';
const PANDOC_API_URL = 'https://pandoc-fly.fly.dev/convert';

/**
 * Utils
 */
function normalizeBase64(input?: string | null): string {
  if (!input) return '';
  // hỗ trợ cả dạng "data:application/pdf;base64,...."
  if (input.includes(',')) return input.split(',')[1] || '';
  return input;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // chunk để tránh callstack lớn
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Compile TikZ/LaTeX snippet → PNG (JSON hoặc binary)
 *
 * ✅ Robust (tham khảo logic compileFullTex):
 * - Backend có thể trả JSON { ok, base64, mimeType, ... }
 * - Backend có thể trả ảnh trực tiếp (Content-Type: image/png, image/svg+xml, ...)
 * - Backend có thể dùng key khác: imageBase64 / image_base64 / file / result.base64 ...
 * - base64 có thể chứa prefix "data:image/png;base64,..." → cần normalize
 */
export async function compileTikz(payload: TikZRequest): Promise<TikZResponse> {
  try {
    const response = await fetch(`${TIKZ_API_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: payload.source,
        mode: payload.mode || 'auto',
        format: payload.format || 'png',
        density: payload.density || 300,
        packages: payload.packages || null,
        preamble: payload.preamble || '',
        transparent: payload.transparent ?? true,
        return_log: payload.returnLog ?? false,
      }),
    });

    const ct = (response.headers.get('content-type') || '').toLowerCase();

    // ✅ Case 1: Server trả thẳng binary image (image/png, image/svg+xml, application/pdf, ...)
    if (ct.includes('image/') || (ct.includes('application/pdf') && payload.format === 'pdf')) {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      // Xác định mimeType từ Content-Type header
      const mimeType = ct.includes('image/svg') ? 'image/svg+xml'
        : ct.includes('image/png') ? 'image/png'
        : ct.includes('image/jpeg') ? 'image/jpeg'
        : ct.includes('application/pdf') ? 'application/pdf'
        : `image/${payload.format || 'png'}`;

      return {
        ok: true,
        base64,
        mimeType,
      };
    }

    // ✅ Case 2: Server trả JSON
    const data = await response.json().catch(async () => {
      // Nếu không parse được JSON, thử đọc text
      const text = await response.text().catch(() => '');
      return { ok: false, detail: text || 'Response is not JSON' };
    });

    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }

    // ✅ Chuẩn hoá nhiều key base64 có thể có (tham khảo compileFullTex)
    const rawBase64 =
      data?.base64 ||
      data?.imageBase64 ||
      data?.image_base64 ||
      data?.fileBase64 ||
      data?.file_base64 ||
      data?.pngBase64 ||
      data?.png_base64 ||
      data?.svgBase64 ||
      data?.svg_base64 ||
      data?.image ||
      data?.file ||
      data?.result?.base64 ||
      data?.result?.imageBase64 ||
      data?.result?.image_base64 ||
      data?.output?.base64 ||
      data?.output?.imageBase64 ||
      data?.output?.image_base64 ||
      '';

    // ✅ Nếu server trả URL thay vì base64
    const imageUrl =
      data?.imageUrl ||
      data?.image_url ||
      data?.url ||
      data?.fileUrl ||
      data?.file_url ||
      data?.downloadUrl ||
      data?.download_url ||
      '';

    if (!rawBase64 && imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Fetch image url failed: HTTP ${imgRes.status}`);
      const imgBlob = await imgRes.blob();
      const b64 = await blobToBase64(imgBlob);
      return {
        ...data,
        ok: true,
        base64: b64,
        mimeType: data?.mimeType || `image/${payload.format || 'png'}`,
      };
    }

    // ✅ Normalize base64 (strip data URI prefix nếu có)
    if (rawBase64) {
      return {
        ...data,
        ok: data?.ok !== false, // giữ ok nếu có, default true
        base64: normalizeBase64(rawBase64),
        mimeType: data?.mimeType || `image/${payload.format || 'png'}`,
      };
    }

    // Nếu compile OK mà vẫn không có base64 → trả nguyên data
    return data as TikZResponse;
  } catch (error) {
    console.error('TikZ Compile Error:', error);
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compile full .tex document → PDF
 *
 * ✅ Robust:
 * - Backend có thể trả JSON { ok, base64/log } hoặc trả PDF trực tiếp (Content-Type: application/pdf)
 * - Backend có thể dùng key khác: pdfBase64 / pdf_base64 / fileBase64 / pdf / result.pdf_base64 ...
 * - Backend có thể trả link: pdfUrl / url / fileUrl ... -> tự fetch về base64 để FE download như cũ
 *
 * Trả về object "giống cũ" để App.tsx không cần đổi:
 * - { ok: true, base64: "...", log?: "...", detail?: "..." }
 * - { ok: false, detail?: "...", log?: "..." }
 */
export async function compileFullTex({
  tex,
  engine = 'pdflatex',
  returnLog = false,
  assets = null,
}: {
  tex: string;
  engine?: string;
  returnLog?: boolean;
  assets?: any;
}): Promise<any> {
  try {
    const response = await fetch(`${TIKZ_API_URL}/compile-tex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tex,
        engine,
        return_log: returnLog,
        assets,
      }),
    });

    const ct = (response.headers.get('content-type') || '').toLowerCase();

    // ✅ Case 1: server trả thẳng PDF
    if (ct.includes('application/pdf')) {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }
      const pdfBlob = await response.blob();
      const base64 = await blobToBase64(pdfBlob);
      return {
        ok: true,
        base64, // để App.tsx downloadBase64File(...) chạy y như cũ
        log: '',
      };
    }

    // ✅ Case 2: JSON (hoặc text-json)
    const data = await response.json().catch(async () => {
      const text = await response.text().catch(() => '');
      return { ok: false, detail: text || 'Response is not JSON' };
    });

    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }

    // Chuẩn hoá nhiều key base64 có thể có
    const base64 =
      data?.base64 ||
      data?.pdfBase64 ||
      data?.pdf_base64 ||
      data?.fileBase64 ||
      data?.file_base64 ||
      data?.pdf ||
      data?.result?.base64 ||
      data?.result?.pdfBase64 ||
      data?.result?.pdf_base64 ||
      data?.output?.base64 ||
      data?.output?.pdfBase64 ||
      data?.output?.pdf_base64 ||
      '';

    // Nếu server trả link pdf, tự fetch về (để user vẫn nhận file)
    const pdfUrl =
      data?.pdfUrl ||
      data?.pdf_url ||
      data?.url ||
      data?.fileUrl ||
      data?.file_url ||
      data?.downloadUrl ||
      data?.download_url ||
      '';

    if (!base64 && pdfUrl) {
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error(`Fetch PDF url failed: HTTP ${pdfRes.status}`);
      const pdfBlob = await pdfRes.blob();
      const b64 = await blobToBase64(pdfBlob);
      return {
        ...data,
        ok: true,
        base64: b64,
      };
    }

    // Trả data nhưng đảm bảo có field base64 nếu tìm thấy
    if (base64 && !data?.base64) {
      return { ...data, ok: true, base64: normalizeBase64(base64) };
    }

    // Nếu compile OK mà vẫn không có base64 -> trả nguyên data để bạn xem log/detail
    return data;
  } catch (error) {
    console.error('Full Tex Compile Error:', error);
    // giữ behavior ném lỗi như file cũ (App.tsx đang catch và alert)
    throw error;
  }
}

/**
 * Convert Markdown to DOCX using Pandoc API
 */
export async function convertMarkdownToDocx(markdown: string): Promise<Blob> {
  const response = await fetch(PANDOC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ markdown }),
  });

  if (!response.ok) {
    throw new Error(`Pandoc Server Error: ${response.status}`);
  }

  return await response.blob();
}

/**
 * Helper to download Blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert base64 to Blob
 */
export function base64ToBlob(base64: string, mimeType: string) {
  const pure = normalizeBase64(base64);
  const byteCharacters = atob(pure);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Download file from base64
 */
export function downloadBase64File(base64: string, filename: string, mimeType: string) {
  const blob = base64ToBlob(base64, mimeType);
  downloadBlob(blob, filename);
}
/* =========================================================
   EXTRA EXPORTS (dùng chung cho project lớn)
   ========================================================= */

export function extractTikzCode(fullText: string): string | null {
  if (!fullText) return null;
  const match = fullText.match(
    /\\begin\s*\{tikzpicture\}[\s\S]*?\\end\s*\{tikzpicture\}/
  );
  return match ? match[0] : null;
}

export interface CompileResult {
  success: boolean;
  image?: string; // base64 png (không kèm prefix data:)
  error?: string;
  log?: string;
}

function pickErrorLine(text?: string): string | null {
  if (!text) return null;
  const m = text.match(/^!.*$/m);
  return m?.[0] ?? null;
}

/**
 * Wrapper compile TikZ → PNG (ổn định như "component ok")
 * - auto extract base64 từ mọi key: base64/image_base64/png_base64...
 * - normalize data-uri prefix nếu có
 */
export async function compileTikzToImage(source: string): Promise<CompileResult> {
  try {
    const res: any = await compileTikz({
      source,
      mode: 'auto',          // ✅ giống bản OK (tránh backend không hiểu "tikz")
      format: 'png',
      density: 300,
      packages: null,
      preamble: '',
      transparent: true,
      returnLog: true,
    } as any);

    // ✅ lấy base64 theo nhiều key (tương thích mọi backend)
    const raw =
      res?.image_base64 ||
      res?.png_base64 ||
      res?.base64 ||
      res?.imageBase64 ||
      res?.pngBase64 ||
      res?.fileBase64 ||
      res?.file_base64 ||
      res?.result?.image_base64 ||
      res?.result?.png_base64 ||
      res?.result?.base64 ||
      res?.output?.image_base64 ||
      res?.output?.png_base64 ||
      res?.output?.base64 ||
      '';

    const imageBase64 = normalizeBase64(raw);

    if (!res?.ok || !imageBase64) {
      const rawText = (res?.log || res?.detail || '') as string;
      return {
        success: false,
        error: pickErrorLine(rawText) || res?.detail || 'Không nhận được base64 ảnh từ server.',
        log: rawText,
      };
    }

    return { success: true, image: imageBase64, log: res?.log || '' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Lỗi biên dịch/ kết nối.' };
  }
}
