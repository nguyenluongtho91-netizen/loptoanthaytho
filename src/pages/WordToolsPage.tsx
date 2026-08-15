import { useState } from 'react';
import { FileType, Calculator, Copy, FileText } from 'lucide-react';

import WordExamGeneratorView from '@/components/WordExamGeneratorView';
import WordSolveView from '@/components/WordSolveView';
import WordSimilarView from '@/components/WordSimilarView';

type WordTab = 'generate' | 'solve' | 'similar';

export default function WordToolsPage() {
  const [activeTab, setActiveTab] = useState<WordTab>('generate');

  const tabs = [
    {
      id: 'generate' as WordTab,
      label: 'Soạn đề Word',
      icon: FileType,
      activeClass: 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-100',
      iconClass: 'text-teal-600'
    },
    {
      id: 'solve' as WordTab,
      label: 'Giải toán AI',
      icon: Calculator,
      activeClass: 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-100',
      iconClass: 'text-teal-600'
    },
    {
      id: 'similar' as WordTab,
      label: 'Tạo bài tương tự',
      icon: Copy,
      activeClass: 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-100',
      iconClass: 'text-teal-600'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header chính - chỉ để ở WordToolsPage */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/70 to-cyan-50 p-6 shadow-sm">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-24 w-24 rounded-full bg-cyan-200/30 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
              <FileText className="h-7 w-7" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-teal-950">
                Hệ thống Công cụ Word
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Soạn ma trận, giải bài tập và tạo đề tương tự xuất chuẩn Word Equation.
              </p>
            </div>
          </div>

          <div className="hidden rounded-2xl border border-teal-100 bg-white/70 px-4 py-3 text-xs font-semibold text-teal-700 shadow-sm backdrop-blur md:block">
            Word Tools · AI hỗ trợ soạn đề
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rounded-3xl border border-teal-100 bg-white p-2 shadow-sm">
        <div className="flex w-fit flex-wrap gap-2 rounded-2xl bg-teal-50 p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ' +
                  (isActive
                    ? tab.activeClass
                    : 'text-slate-500 hover:bg-white/70 hover:text-teal-700')
                }
              >
                <Icon
                  className={
                    'h-4 w-4 transition-colors ' +
                    (isActive ? tab.iconClass : 'text-slate-400')
                  }
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nội dung tab - không lặp header/tabs ở đây */}
      <div className="rounded-3xl border border-teal-100 bg-white/95 p-5 shadow-sm md:p-6">
        {activeTab === 'generate' && <WordExamGeneratorView />}
        {activeTab === 'solve' && <WordSolveView />}
        {activeTab === 'similar' && <WordSimilarView />}
      </div>
    </div>
  );
}
