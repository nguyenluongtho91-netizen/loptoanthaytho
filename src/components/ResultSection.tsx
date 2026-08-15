import React, { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface ResultSectionProps {
  title: string;
  content: string;
}

const ResultSection: React.FC<ResultSectionProps> = ({ title, content }) => {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => content.split('\n').length, [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert('Không thể copy. Hãy thử copy thủ công.');
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white/25 backdrop-blur-md rounded-2xl border border-white/40 shadow-xl">
      <div className="p-4 border-b border-white/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-600">{lines} dòng</p>
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-2 rounded-lg bg-white/60 hover:bg-white text-slate-800 font-semibold text-sm flex items-center gap-2"
        >
          {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          {copied ? 'Đã copy' : 'Copy'}
        </button>
      </div>

      <textarea
        value={content}
        readOnly
        className="flex-1 w-full p-4 bg-white/50 text-slate-900 font-mono text-sm resize-none outline-none"
      />
    </div>
  );
};

export default ResultSection;
