// src/components/TikzDrawView.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  PenTool,
  BarChart3,
  Box,
  Copy,
  Check,
  ArrowRight,
  Wand2,
  RotateCcw,
  Loader2,
  Eye,
} from 'lucide-react';
import { Coefficients, GeoParams } from '../types';
import {
  generateBBT,
  generateGraph,
  generateGeometry,
  generateCustomGraphCode,
} from '../utils/latexGenerator';
import { compileTikzToImage, extractTikzCode } from '../services/api';

// ============ LOCAL TYPES ============
type DrawMode = 'bbt' | 'graph' | 'geometry' | 'custom';

type FuncType =
  | 'bac_nhat'
  | 'bac_hai'
  | 'bac_ba'
  | 'trung_phuong'
  | 'mot_mot'
  | 'hai_mot';

type GeoType =
  | 'tu_dien'
  | 'khoi_non'
  | 'khoi_tru'
  | 'khoi_cau'
  | 'lang_tru_dung'
  | 'hinh_hop';

// ============ CONFIG ============
const FUNC_TYPES: { value: FuncType; label: string; fields: (keyof Coefficients)[] }[] = [
  { value: 'bac_nhat', label: 'Bậc nhất: y = ax + b', fields: ['a', 'b'] },
  { value: 'bac_hai', label: 'Bậc hai: y = ax² + bx + c', fields: ['a', 'b', 'c'] },
  { value: 'bac_ba', label: 'Bậc ba: y = ax³ + bx² + cx + d', fields: ['a', 'b', 'c', 'd'] },
  { value: 'trung_phuong', label: 'Trùng phương: y = ax⁴ + bx² + c', fields: ['a', 'b', 'c'] },
  { value: 'mot_mot', label: 'Phân thức 1/1: y = (ax+b)/(cx+d)', fields: ['a', 'b', 'c', 'd'] },
  { value: 'hai_mot', label: 'Phân thức 2/1: y = (ax²+bx+c)/(mx+n)', fields: ['a', 'b', 'c', 'm', 'n'] },
];

const GEO_TYPES: { value: GeoType; label: string; fields: string[] }[] = [
  { value: 'tu_dien', label: 'Tứ diện ABCD', fields: ['A', 'B', 'C', 'D'] },
  { value: 'khoi_non', label: 'Khối nón', fields: ['h', 'R'] },
  { value: 'khoi_tru', label: 'Khối trụ', fields: ['h', 'R'] },
  { value: 'khoi_cau', label: 'Khối cầu', fields: ['R'] },
  { value: 'lang_tru_dung', label: 'Lăng trụ đứng ABC.MNP', fields: ['A', 'B', 'C', 'M', 'N', 'P'] },
  { value: 'hinh_hop', label: 'Hình hộp ABCD.MNPQ', fields: ['A', 'B', 'C', 'D', 'M', 'N', 'P', 'Q'] },
];

const FIELD_LABELS: Record<string, string> = {
  a: 'a',
  b: 'b',
  c: 'c',
  d: 'd',
  m: 'm',
  n: 'n',
  A: 'Đỉnh A',
  B: 'Đỉnh B',
  C: 'Đỉnh C',
  D: 'Đỉnh D',
  M: 'Đỉnh M',
  N: 'Đỉnh N',
  P: 'Đỉnh P',
  Q: 'Đỉnh Q',
  h: 'Chiều cao h',
  R: 'Bán kính R',
  xmin: 'x min',
  xmax: 'x max',
  ymin: 'y min',
  ymax: 'y max',
  hsf: 'Hàm số f(x)',
  gtx: 'Giá trị x (cách dấu ,)',
  gty: 'Giá trị y (cách dấu ,)',
};

// ============ COMPONENT ============
interface Props {
  onTransferToCompile: (tikzCode: string) => void;
}

const TikzDrawView: React.FC<Props> = ({ onTransferToCompile }) => {
  // State
  const [drawMode, setDrawMode] = useState<DrawMode>('bbt');
  const [funcType, setFuncType] = useState<FuncType>('bac_hai');
  const [geoType, setGeoType] = useState<GeoType>('tu_dien');

  const [coefficients, setCoefficients] = useState<Coefficients>({
    a: 1,
    b: -2,
    c: 1,
    d: 0,
    m: 1,
    n: 1,
  });

  const [geoParams, setGeoParams] = useState<GeoParams>({
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    M: "A'",
    N: "B'",
    P: "C'",
    Q: "D'",
    h: '3',
    R: '2',
  });

  const [customParams, setCustomParams] = useState({
    xmin: '-5',
    xmax: '5',
    ymin: '-5',
    ymax: '5',
    hsf: '(\\x)^2-2*(\\x)+1',
    gtx: '',
    gty: '',
  });

  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  // Preview states (blob/objectURL)
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Handlers
  const handleCoeffChange = useCallback((field: string, value: string) => {
    const num = parseFloat(value);
    setCoefficients((prev) => ({
      ...prev,
      [field]: Number.isFinite(num) ? num : 0,
    }));
  }, []);

  const handleGeoChange = useCallback((field: string, value: string) => {
    setGeoParams((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCustomChange = useCallback((field: string, value: string) => {
    setCustomParams((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    let result = '';
    try {
      switch (drawMode) {
        case 'bbt':
          result = generateBBT(funcType, coefficients);
          break;
        case 'graph':
          result = generateGraph(funcType, coefficients);
          break;
        case 'geometry':
          result = generateGeometry(geoType, geoParams);
          break;
        case 'custom':
          result = generateCustomGraphCode({
            xmin: parseFloat(customParams.xmin) || -5,
            xmax: parseFloat(customParams.xmax) || 5,
            ymin: parseFloat(customParams.ymin) || -5,
            ymax: parseFloat(customParams.ymax) || 5,
            hsf: customParams.hsf,
            gtx: customParams.gtx,
            gty: customParams.gty,
          });
          break;
      }
    } catch (e: any) {
      result = `% Lỗi: ${e?.message || 'Không rõ'}`;
    }

    setOutput(result);

    // reset preview state
    setShowPreview(false);
    setPreviewError('');
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  }, [drawMode, funcType, geoType, coefficients, geoParams, customParams, previewUrl]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [output]);

  /**
   * ✅ Preview TikZ → PNG (robust)
   * - extract tikzpicture nếu có
   * - compile bằng compileTikzToImage (đọc đúng image_base64/png_base64)
   * - tạo blob/objectURL để hiển thị ổn định
   */
  const handlePreview = useCallback(async () => {
    if (!output.trim()) return;

    setPreviewLoading(true);
    setPreviewError('');
    setShowPreview(false);

    // cleanup url cũ
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');

    try {
      const tikzCode = extractTikzCode(output) || output;

      const result = await compileTikzToImage(tikzCode);

      if (!result.success || !result.image) {
        setPreviewError(result.error || 'Compile thất bại — không có dữ liệu ảnh trả về.');
        setShowPreview(false);
        return;
      }

      // blob/objectURL (tránh data URI quá dài)
      try {
        const byteChars = atob(result.image);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setShowPreview(true);
      } catch {
        // fallback data URI
        setPreviewUrl(`data:image/png;base64,${result.image}`);
        setShowPreview(true);
      }
    } catch (e: any) {
      setPreviewError(`Lỗi kết nối: ${e?.message || 'Không rõ'}`);
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  }, [output, previewUrl]);

  const handleReset = useCallback(() => {
    setOutput('');
    setPreviewError('');
    setShowPreview(false);
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setCoefficients({ a: 1, b: -2, c: 1, d: 0, m: 1, n: 1 });
  }, [previewUrl]);

  // Render helpers
  const currentFuncConfig = useMemo(
    () => FUNC_TYPES.find((f) => f.value === funcType),
    [funcType]
  );
  const currentGeoConfig = useMemo(
    () => GEO_TYPES.find((g) => g.value === geoType),
    [geoType]
  );

  const renderCoeffInputs = () => {
    if (!currentFuncConfig) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {currentFuncConfig.fields.map((field) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {FIELD_LABELS[field] || String(field)}
            </label>
            <input
              type="number"
              step="any"
              value={coefficients[field] ?? 0}
              onChange={(e) => handleCoeffChange(String(field), e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderGeoInputs = () => {
    if (!currentGeoConfig) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        {currentGeoConfig.fields.map((field) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {FIELD_LABELS[field] || field}
            </label>
            <input
              type="text"
              value={(geoParams as any)[field] ?? ''}
              onChange={(e) => handleGeoChange(field, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderCustomInputs = () => (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['xmin', 'xmax', 'ymin', 'ymax'] as const).map((field) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {FIELD_LABELS[field]}
            </label>
            <input
              type="number"
              step="any"
              value={customParams[field]}
              onChange={(e) => handleCustomChange(field, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Hàm số f(x) — dùng cú pháp TikZ, vd: (\\x)^2-2*(\\x)+1
        </label>
        <input
          type="text"
          value={customParams.hsf}
          onChange={(e) => handleCustomChange('hsf', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="(\\x)^2 - 2*(\\x) + 1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Giá trị x hiển thị (cách dấu phẩy)
          </label>
          <input
            type="text"
            value={customParams.gtx}
            onChange={(e) => handleCustomChange('gtx', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="-2,-1,1,2"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Giá trị y hiển thị (cách dấu phẩy)
          </label>
          <input
            type="text"
            value={customParams.gty}
            onChange={(e) => handleCustomChange('gty', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="-2,-1,1,2"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ===== LEFT: Input Panel ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="font-extrabold text-slate-800 flex items-center gap-2">
          <PenTool className="text-teal-600" size={18} />
          Vẽ hình TikZ
        </div>

        {/* Draw Mode Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'bbt' as DrawMode, label: 'Bảng biến thiên', icon: <BarChart3 size={14} /> },
            { value: 'graph' as DrawMode, label: 'Đồ thị', icon: <BarChart3 size={14} /> },
            { value: 'geometry' as DrawMode, label: 'Hình học KG', icon: <Box size={14} /> },
            { value: 'custom' as DrawMode, label: 'Tùy chỉnh', icon: <PenTool size={14} /> },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setDrawMode(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                drawMode === tab.value
                  ? 'bg-teal-100 text-teal-700 ring-1 ring-teal-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Function Type Selector (for bbt & graph) */}
        {(drawMode === 'bbt' || drawMode === 'graph') && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Loại hàm số</label>
            <select
              value={funcType}
              onChange={(e) => setFuncType(e.target.value as FuncType)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              {FUNC_TYPES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {renderCoeffInputs()}
          </div>
        )}

        {/* Geometry Type Selector */}
        {drawMode === 'geometry' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Loại hình</label>
            <select
              value={geoType}
              onChange={(e) => setGeoType(e.target.value as GeoType)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              {GEO_TYPES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {renderGeoInputs()}
          </div>
        )}

        {/* Custom Graph Inputs */}
        {drawMode === 'custom' && renderCustomInputs()}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center gap-2"
          >
            <Wand2 size={16} />
            Tạo mã TikZ
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Nhập hệ số → Tạo mã TikZ → Xem trước hoặc chuyển qua tab Biên dịch LaTeX.
        </p>
      </div>

      {/* ===== RIGHT: Output Panel ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="font-extrabold text-slate-800 flex items-center gap-2">
          <PenTool className="text-teal-600" size={18} />
          Kết quả TikZ
        </div>

        <textarea
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          className="w-full h-[340px] p-3 rounded-xl border border-slate-300 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-slate-50"
          placeholder="Mã TikZ sẽ hiển thị ở đây sau khi bấm 'Tạo mã TikZ'..."
        />

        {/* Action row */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            disabled={!output}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm text-slate-700 flex items-center gap-2 disabled:opacity-50"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            {copied ? 'Đã copy!' : 'Copy'}
          </button>

          <button
            onClick={handlePreview}
            disabled={!output || previewLoading}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm text-slate-700 flex items-center gap-2 disabled:opacity-50"
          >
            {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Xem trước (PNG)
          </button>

          <button
            onClick={() => onTransferToCompile(output)}
            disabled={!output}
            className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowRight size={14} />
            Chuyển qua Biên dịch
          </button>
        </div>

        {/* ✅ Preview Error */}
        {previewError && (
          <div className="border border-red-200 rounded-xl p-3 bg-red-50">
            <div className="text-xs font-semibold text-red-600 mb-1">❌ Lỗi compile TikZ:</div>
            <pre className="text-xs text-red-800 whitespace-pre-wrap max-h-[200px] overflow-auto font-mono">
              {previewError}
            </pre>
          </div>
        )}

        {/* ✅ Preview Image */}
        {showPreview && previewUrl && (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-500 mb-2">Xem trước:</div>
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="TikZ Preview"
                className="max-w-full max-h-[300px] object-contain rounded-lg"
                style={{
                  background:
                    'repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 50% / 16px 16px',
                }}
                onError={() => {
                  setPreviewError(
                    'Không thể hiển thị ảnh. Thử chuyển qua tab Biên dịch LaTeX để compile PDF.'
                  );
                  setShowPreview(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TikzDrawView;
