/**
 * TikZ Compilation Service
 * Compile TikZ/LaTeX code to PNG/PDF images via API
 */

const API_BASE_URL = 'https://tikz-fly.fly.dev';

export interface CompileTikzOptions {
  source: string;
  mode?: 'auto' | 'tikz' | 'latex';
  format?: 'png' | 'pdf';
  density?: number;
  packages?: string[] | null;
  preamble?: string;
  transparent?: boolean;
  returnLog?: boolean;
}

export interface CompileSmartOptions extends CompileTikzOptions {
  autoDetectPackages?: boolean;
  customPreamble?: string;
  assets?: Record<string, string> | null;
}

export interface CompileResult {
  ok: boolean;
  base64?: string;
  width?: number;
  height?: number;
  log?: string;
  detail?: string;
}

const DEFAULT_EXAM_PACKAGES = [
  'amsmath',
  'amssymb',
  'amsfonts',
  'tikz',
  'pgfplots',
  'geometry',
  'graphicx',
  'xcolor',
];

function normalizeBase64FromResponse(data: any): string {
  return (
    data?.base64 ||
    data?.image ||
    data?.image_base64 ||    
    data?.png ||
    data?.png_base64 ||      
    data?.pngBase64 ||
    data?.fileBase64 ||
    data?.file_base64 ||
    data?.pdf_base64 ||      
    data?.result?.base64 ||
    data?.result?.image ||
    data?.result?.image_base64 ||  
    data?.result?.png ||
    data?.output?.base64 ||
    data?.output?.image ||
    data?.output?.image_base64 ||  
    data?.output?.png ||
    ''
  );
}

export async function compileTikz(options: CompileTikzOptions): Promise<CompileResult> {
  const {
    source,
    mode = 'auto',
    format = 'png',
    density = 300,
    packages = null,
    preamble = '',
    transparent = true,
    returnLog = false,
  } = options;

  try {
    const response = await fetch(`${API_BASE_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        mode,
        format,
        density,
        packages,
        preamble,
        transparent,
        return_log: returnLog,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }

    const base64 = normalizeBase64FromResponse(data);

    const result: CompileResult = {
      ok: data?.ok !== false && !!base64,
      base64: base64 || undefined,
      width: data?.width,
      height: data?.height,
      log: data?.log,
      detail: data?.detail,
    };

    return result;
  } catch (error) {
    console.error('TikZ compilation error:', error);
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function compileSmart(options: CompileSmartOptions): Promise<CompileResult> {
  const {
    source,
    mode = 'auto',
    packages = null,
    autoDetectPackages = true,
    customPreamble = '',
    format = 'png',
    density = 300,
    transparent = true,
    returnLog = false,
  } = options; // ✅ Đã xóa destructuring 'assets' bị thừa

  const finalPackages = autoDetectPackages && !packages
    ? DEFAULT_EXAM_PACKAGES
    : packages;

  try {
    const response = await fetch(`${API_BASE_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        mode,
        format,
        density,
        packages: finalPackages,
        preamble: customPreamble,
        transparent,
        return_log: returnLog,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }

    const base64 = normalizeBase64FromResponse(data);

    const result: CompileResult = {
      ok: data?.ok !== false && !!base64,
      base64: base64 || undefined,
      width: data?.width,
      height: data?.height,
      log: data?.log,
      detail: data?.detail,
    };

    return result;
  } catch (error) {
    console.error('Smart compilation error:', error);
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function compileExamTikz(
  source: string,
  options?: Partial<CompileTikzOptions>
): Promise<CompileResult> {
  const detectedPackages = [...DEFAULT_EXAM_PACKAGES];
  
  if (source.includes('\\draw') && source.includes('(') && source.includes('to[')) {
    detectedPackages.push('circuitikz');
  }
  if (source.includes('tikzcd') || source.includes('\\arrow')) {
    detectedPackages.push('tikz-cd');
  }

  const libraries: string[] = [];
  if (source.includes('calc')) libraries.push('calc');
  if (source.includes('positioning')) libraries.push('positioning');
  if (source.includes('arrows')) libraries.push('arrows.meta');
  if (source.includes('patterns')) libraries.push('patterns');
  if (source.includes('shapes')) libraries.push('shapes.geometric');

  const libraryPreamble = libraries.length > 0
    ? `\\usetikzlibrary{${libraries.join(',')}}`
    : '';

  const finalPreamble = options?.preamble
    ? `${libraryPreamble}\n${options.preamble}`
    : libraryPreamble;

  return compileTikz({
    source,
    mode: 'auto',
    format: 'png',
    density: 300,
    transparent: true,
    ...options,
    packages: detectedPackages,
    preamble: finalPreamble,
  });
}

function normalizeBase64(input?: string | null): string {
  if (!input) return '';
  if (input.includes(',')) return input.split(',')[1] || '';
  return input;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const pure = normalizeBase64(base64);
  const byteCharacters = atob(pure);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export function createImageUrl(base64: string, mimeType: string = 'image/png'): string {
  const pure = normalizeBase64(base64);
  return `data:${mimeType};base64,${pure}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBase64File(base64: string, filename: string, mimeType: string): void {
  const blob = base64ToBlob(base64, mimeType);
  downloadBlob(blob, filename);
}
