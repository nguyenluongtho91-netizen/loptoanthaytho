// @ts-nocheck
import { useEffect, useRef } from 'react';

// ============================================================
// FeedbackRenderer – Markdown (Showdown) + LaTeX (MathJax)
// KHÔNG import file CSS riêng – style inject qua JS để
// tránh lỗi build trên Vercel/Netlify
// ============================================================

const SHOWDOWN_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/showdown/2.1.0/showdown.min.js';
const MATHJAX_CDN =
  'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';

// ── Placeholder an toàn: chỉ gồm chữ hoa + số, không có _*[]$\
const DISP_PH = (i: number) => `MXDSP${i}MXEND`;
const INLN_PH = (i: number) => `MXINL${i}MXEND`;
const DISP_RE = /MXDSP(\d+)MXEND/g;
const INLN_RE = /MXINL(\d+)MXEND/g;

// CSS inject 1 lần vào <head>
const FEEDBACK_CSS = `
.fb-render { font-size: 0.875rem; color: #374151; line-height: 1.75; }
.fb-render h1 { font-size: 1.15em; font-weight: 700; color: #111827; margin: 1em 0 0.4em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.2em; }
.fb-render h2 { font-size: 1.05em; font-weight: 700; color: #0d9488; margin: 0.9em 0 0.35em; }
.fb-render h3 { font-size: 0.95em; font-weight: 700; color: #0f766e; margin: 0.8em 0 0.3em; }
.fb-render p  { margin: 0.4em 0; }
.fb-render ul, .fb-render ol { margin: 0.4em 0; padding-left: 1.4em; }
.fb-render ul { list-style: disc; }
.fb-render ol { list-style: decimal; }
.fb-render li { margin: 0.2em 0; }
.fb-render strong { font-weight: 700; color: #111827; }
.fb-render em { font-style: italic; color: #4b5563; }
.fb-render blockquote {
  border-left: 4px solid #0d9488; margin: 0.6em 0;
  padding: 0.2em 0.75em; background: #f0fdfa;
  border-radius: 0 8px 8px 0; color: #134e4a;
}
.fb-render code {
  font-family: 'Courier New', monospace; font-size: 0.85em;
  background: #f3f4f6; border: 1px solid #e5e7eb;
  border-radius: 4px; padding: 0.1em 0.3em; color: #7c3aed;
}
.fb-render pre {
  background: #1f2937; color: #f9fafb; border-radius: 10px;
  padding: 1em; overflow-x: auto; margin: 0.6em 0;
}
.fb-render pre code { background: none; border: none; color: inherit; padding: 0; }
.fb-render table { width: 100%; border-collapse: collapse; margin: 0.6em 0; font-size: 0.875em; }
.fb-render th { background: #0d9488; color: white; font-weight: 600; padding: 0.4em 0.7em; text-align: left; }
.fb-render td { padding: 0.35em 0.7em; border: 1px solid #e5e7eb; }
.fb-render tr:nth-child(even) td { background: #f9fafb; }
.fb-render hr { border: none; border-top: 2px solid #e5e7eb; margin: 0.8em 0; }
.fb-render mjx-container[display="true"] { display: block; text-align: center; margin: 0.6em 0; overflow-x: auto; }
`;

function injectStyles() {
  if (window.__feedbackStyleInjected) return;
  const style = document.createElement('style');
  style.setAttribute('data-id', 'feedback-renderer');
  style.textContent = FEEDBACK_CSS;
  document.head.appendChild(style);
  window.__feedbackStyleInjected = true;
}

const loadScript = (src: string, id?: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) { resolve(); return; }
    if (!id && document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    if (id) s.id = id;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });

function configureMathJax() {
  if (window.__mathJaxConfigured) return;
  if (!window.MathJax) {
    window.MathJax = {};
  }
  Object.assign(window.MathJax, {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
    },
    startup: {
      typeset: false,
    },
  });
  window.__mathJaxConfigured = true;
}

async function ensureMathJax(): Promise<void> {
  configureMathJax();
  if (!window.MathJax?.typesetPromise) {
    await loadScript(MATHJAX_CDN, 'mathjax3-script');
    await (window.MathJax?.startup?.promise ?? Promise.resolve());
  }
}

interface FeedbackRendererProps {
  content: string;
  className?: string;
}

const FeedbackRenderer = ({ content, className = '' }: FeedbackRendererProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectStyles();
    configureMathJax();
  }, []);

  useEffect(() => {
    if (!content || !ref.current) return;

    let cancelled = false;

    const render = async () => {
      if (!window.showdown) {
        await loadScript(SHOWDOWN_CDN);
      }
      if (cancelled || !ref.current) return;

      const mathBlocks: string[] = [];

      const protect = (str: string) =>
        str
          .replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (_, a, b) => {
            const idx = mathBlocks.length;
            mathBlocks.push(`$$${a ?? b}$$`);
            return DISP_PH(idx);
          })
          .replace(/\$([^$\n]+?)\$|\\\(([^)]+?)\\\)/g, (_, a, b) => {
            const idx = mathBlocks.length;
            mathBlocks.push(`$${a ?? b}$`);
            return INLN_PH(idx);
          });

      const processed = protect(content);

      const converter = new window.showdown.Converter({
        tables: true,
        strikethrough: true,
        ghCodeBlocks: true,
        tasklists: true,
        simpleLineBreaks: true,
      });

      let html = converter.makeHtml(processed);

      html = html
        .replace(DISP_RE, (_, i) => mathBlocks[+i] ?? '')
        .replace(INLN_RE, (_, i) => mathBlocks[+i] ?? '');

      ref.current.innerHTML = html;

      const typeset = async () => {
        try {
          await ensureMathJax();
          if (ref.current && window.MathJax?.typesetPromise) {
            await window.MathJax.typesetPromise([ref.current]);
          }
        } catch {
          // ignore error
        }
      };

      if (!cancelled) await typeset();
    };

    render();
    return () => { cancelled = true; };
  }, [content]);

  return (
    <div
      ref={ref}
      className={`fb-render ${className}`}
      style={{ lineHeight: 1.75 }}
    />
  );
};

export default FeedbackRenderer;
