// src/components/SampleQuestionsView.tsx
import React, { useState, useCallback } from 'react';
import {
  BookOpen,
  CheckSquare,
  MessageSquare,
  PenLine,
  Copy,
  Check,
  ChevronRight,
  Code,
  Wand2,
  Download,
  ExternalLink,
  X,
  Loader2,
  Eye,
  ArrowRight,
  LayoutGrid,
} from 'lucide-react';
import { compileFullTex, base64ToBlob, downloadBlob } from '../services/api';
import { EX_TEST_DETHI_TEMPLATE } from '../constants';

// ─── Types ───────────────────────────────────────────────────────────────────

type QuestionCategory = 'multichoice' | 'truefalse' | 'shortans' | 'essay';

interface SampleQuestion {
  id: string;
  title: string;
  description: string;
  latex: string; // chỉ chứa \begin{ex}...\end{ex}
  hasFigure: boolean;
}

// ─── Build full .tex để compile ───────────────────────────────────────────────

const TEMPLATE_MARKER = '%=== THÊM CÂU HỎI TẠI ĐÂY ===';

function buildFullTex(body: string): string {
  const parts = EX_TEST_DETHI_TEMPLATE.split(TEMPLATE_MARKER);
  if (parts.length >= 2) {
    return `${parts[0]}\n\n${body}\n\n${parts.slice(1).join(TEMPLATE_MARKER)}`;
  }
  return `${EX_TEST_DETHI_TEMPLATE}\n\n${body}`;
}

// ─── Dữ liệu câu hỏi mẫu ─────────────────────────────────────────────────────

const SAMPLE_MULTICHOICE: SampleQuestion[] = [
  {
    id: 'mc1',
    title: 'Đạo hàm hàm hợp',
    description: 'Tính đạo hàm của y = sin(3x²+1)',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Đạo hàm]
  Đạo hàm của hàm số $y = \sin(3x^2 + 1)$ là
  \choice
    {$y' = \cos(3x^2+1)$}
    {\True $y' = 6x\cos(3x^2+1)$}
    {$y' = -6x\cos(3x^2+1)$}
    {$y' = 6x^2\cos(3x^2+1)$}
  \loigiai{
    Áp dụng quy tắc đạo hàm hàm hợp:
    $y' = \cos(3x^2+1)\cdot(3x^2+1)' = 6x\cos(3x^2+1)$.
  }
\end{ex}`,
  },
  {
    id: 'mc2',
    title: 'Giới hạn dạng vô định',
    description: 'Tính giới hạn khi x→1',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Giới hạn]
  Giá trị của $\displaystyle\lim_{x\to 1}\dfrac{x^2-3x+2}{x^2-1}$ bằng
  \choice
    {$0$}
    {\True $-\dfrac{1}{2}$}
    {$1$}
    {$\dfrac{1}{2}$}
  \loigiai{
    $\displaystyle\lim_{x\to 1}\frac{(x-1)(x-2)}{(x-1)(x+1)}
    = \lim_{x\to 1}\frac{x-2}{x+1} = \frac{-1}{2}$.
  }
\end{ex}`,
  },
  {
    id: 'mc3',
    title: 'Phương trình tiếp tuyến',
    description: 'Tiếp tuyến đồ thị hàm bậc ba — có hình vẽ',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Tiếp tuyến]
  Phương trình tiếp tuyến của đồ thị hàm số $y = x^3 - 3x + 2$ tại điểm có hoành độ $x_0 = 1$ là
  \begin{center}
    \begin{tikzpicture}[line join=round, line cap=round, >=stealth, font=\footnotesize]
      \draw[->] (-3,0)--(3,0) node[below left]{$x$};
      \draw[->] (0,-1.2)--(0,5) node[below left]{$y$};
      \draw (0,0) node[below left]{$O$};
      \foreach \x in {-2,-1,1,2}
        \draw[thin] (\x,1.5pt)--(\x,-1.5pt) node[below]{$\x$};
      \foreach \y in {1,2,3,4}
        \draw[thin] (1.5pt,\y)--(-1.5pt,\y) node[left]{$\y$};
      \begin{scope}
        \clip (-2.8,-1) rectangle (2.8,5);
        \draw[blue,thick,samples=100,domain=-2.3:2.3,smooth,variable=\x]
             plot(\x,{(\x)^3-3*\x+2});
        \draw[red,thick] (-2.5,0)--(2.5,0);
      \end{scope}
      \fill[red] (1,0) circle(1.8pt) node[above right]{$(1;0)$};
      \node[blue,right,font=\scriptsize] at (1.8,3.8){$y=x^3-3x+2$};
      \node[red,above,font=\scriptsize] at (-1.5,0.1){$y=0$};
    \end{tikzpicture}
  \end{center}
  \choice
    {\True $y = 0$}
    {$y = 2$}
    {$y = x - 1$}
    {$y = -3x + 3$}
  \loigiai{
    $y'=3x^2-3$, tại $x_0=1$: $y'(1)=0$, $y(1)=0$.\\
    Phương trình tiếp tuyến: $y=0$.
  }
\end{ex}`,
  },
  {
    id: 'mc4',
    title: 'Tích phân – đặt ẩn phụ',
    description: 'Tính I = ∫sinx·e^(cosx)dx từ 0 đến π/2',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Tích phân]
  Tích phân $\displaystyle I = \int_{0}^{\pi/2} \sin x \cdot e^{\cos x}\,dx$ bằng
  \choice
    {\True $e - 1$}
    {$1 - e^{-1}$}
    {$e^{-1} - 1$}
    {$e - e^{-1}$}
  \loigiai{
    Đặt $t=\cos x$, $dt=-\sin x\,dx$.
    Khi $x=0\Rightarrow t=1$; $x=\dfrac{\pi}{2}\Rightarrow t=0$.\\
    $I = \displaystyle\int_{1}^{0} e^t(-dt) = \int_0^1 e^t\,dt = e-1$.
  }
\end{ex}`,
  },
  {
    id: 'mc5',
    title: 'Thể tích hình chóp S.ABCD',
    description: 'SA⊥(ABCD), đáy hình vuông cạnh a — có hình vẽ',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Hình không gian]
  Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, $SA\perp(ABCD)$ và $SA=a$. Thể tích khối chóp $S.ABCD$ bằng
  \begin{center}
    \begin{tikzpicture}[scale=1, font=\footnotesize, line join=round, line cap=round, >=stealth]
      \def\ba{2} \def\h{3} \def\gocB{40}
      \coordinate[label=below left:$B$] (B) at (0,0);
      \coordinate[label=above right:$A$] (A) at (\gocB:\ba);
      \coordinate[label=below right:$C$] (C) at (\ba+0.6,0);
      \coordinate[label=right:$D$] (D) at ($(C)-(B)+(A)$);
      \coordinate[label=below:$O$] (O) at ($(A)!.5!(C)$);
      \coordinate[label=above:$S$] (S) at ($(A)+(90:\h)$);
      \draw (B)--(C)--(D)--(S)--cycle (S)--(C);
      \draw[dashed] (C)--(A)--(D) (A)--(B) (S)--(A);
      % góc vuông SA
      \draw[thin] ($(A)+(0.15,0)$)--($(A)+(0.15,0.15)$)--($(A)+(0,0.15)$);
      \foreach \diem in {A,B,C,D,S} \fill (\diem) circle(1.2pt);
      \path (B)--(C) node[midway,below,font=\scriptsize]{$a$};
      \path (A)--(S) node[midway,left,font=\scriptsize]{$a$};
    \end{tikzpicture}
  \end{center}
  \choice
    {$\dfrac{a^3}{6}$}
    {\True $\dfrac{a^3}{3}$}
    {$\dfrac{a^3}{2}$}
    {$a^3$}
  \loigiai{
    $V = \dfrac{1}{3}\cdot S_{\text{đáy}}\cdot h = \dfrac{1}{3}\cdot a^2\cdot a = \dfrac{a^3}{3}$.
  }
\end{ex}`,
  },
];

const SAMPLE_TRUEFALSE: SampleQuestion[] = [
  {
    id: 'tf1',
    title: 'Nguyên hàm – 4 mệnh đề',
    description: 'f(x) = 2x − 3cosx',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Nguyên hàm]
  Cho hàm số $f(x)=2x-3\cos x$.
  \choiceTF[t]
    {\True $f(x)$ là một nguyên hàm của hàm số $g(x)=2+3\sin x$}
    {Một nguyên hàm của hàm số $f(x)=2x-3\cos x$ là $h(x)=x^{2}+3\sin x+2024$}
    {\True Nguyên hàm $F(x)$ thoả mãn $F\!\left(\dfrac{\pi}{2}\right)=3$ là $F(x)=x^{2}-3\sin x+6-\dfrac{\pi^{2}}{4}$}
    {$\displaystyle\int(2x-3\cos x)\,dx = 2-3\sin x+C$}
  \loigiai{
    \begin{itemchoice}
      \itemch \textbf{Đúng.} $f'(x)=2+3\sin x=g(x)$.
      \itemch \textbf{Sai.} $h'(x)=2x+3\cos x\neq f(x)$.
      \itemch \textbf{Đúng.} $\int f\,dx=x^2-3\sin x+C$; từ $F(\pi/2)=3$ suy ra $C=6-\pi^2/4$.
      \itemch \textbf{Sai.} $\int(2x-3\cos x)\,dx=x^2-3\sin x+C$.
    \end{itemchoice}
  }
\end{ex}`,
  },
  {
    id: 'tf2',
    title: 'Cực trị hàm bậc ba — có đồ thị',
    description: 'y = x³ − 3x',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Cực trị]
  Cho hàm số $y = x^3 - 3x$. Xét các mệnh đề sau:
  \begin{center}
    \begin{tikzpicture}[line join=round, line cap=round, >=stealth, font=\footnotesize]
      \draw[->] (-2.8,0)--(2.8,0) node[below left]{$x$};
      \draw[->] (0,-2.8)--(0,2.8) node[below left]{$y$};
      \draw (0,0) node[below left]{$O$};
      \foreach \x in {-2,-1,1,2}
        \draw[thin] (\x,1.5pt)--(\x,-1.5pt) node[below]{$\x$};
      \foreach \y in {-2,-1,1,2}
        \draw[thin] (1.5pt,\y)--(-1.5pt,\y) node[left]{$\y$};
      \begin{scope}
        \clip (-2.6,-2.6) rectangle (2.6,2.6);
        \draw[blue,thick,samples=100,domain=-2.3:2.3,smooth,variable=\x]
             plot(\x,{(\x)^3-3*\x});
      \end{scope}
      % Điểm cực trị
      \draw[fill=white] (-1,2) circle(1.8pt);
      \fill[red] (-1,2) circle(1.5pt) node[above right,red]{CĐ$(-1;2)$};
      \draw[fill=white] (1,-2) circle(1.8pt);
      \fill[red] (1,-2) circle(1.5pt) node[below right,red]{Ct$(1;-2)$};
      % Đường kẻ đứt
      \draw[dashed,thin] (-1,0)--(-1,2)--(0,2);
      \draw[dashed,thin] (1,0)--(1,-2)--(0,-2);
    \end{tikzpicture}
  \end{center}
  \choiceTF[t]
    {\True Hàm số đạt cực đại tại $x = -1$}
    {Giá trị cực tiểu của hàm số bằng $2$}
    {\True Hàm số có đúng hai điểm cực trị}
    {Hàm số đồng biến trên $(-\infty;-1)$}
  \loigiai{
    \begin{itemchoice}
      \itemch \textbf{Đúng.} $y'=3x^2-3=0\Rightarrow x=\pm1$; $y(-1)=2$ là cực đại.
      \itemch \textbf{Sai.} Cực tiểu $y(1)=-2$, không phải $2$.
      \itemch \textbf{Đúng.} Có đúng hai nghiệm đổi dấu của $y'$.
      \itemch \textbf{Sai.} $y'>0$ khi $|x|>1$, tức đồng biến trên $(-\infty;-1)$ và $(1;+\infty)$.
    \end{itemchoice}
  }
\end{ex}`,
  },
  {
    id: 'tf3',
    title: 'Tính chất logarit',
    description: 'Bốn công thức logarit cơ bản',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Logarit]
  Cho $a>0,\ a\neq1$, $m,n>0$. Xét các mệnh đề:
  \choiceTF[t]
    {\True $\log_a(mn) = \log_a m + \log_a n$}
    {$\log_a\dfrac{m}{n} = \log_a m + \log_a n$}
    {\True $\log_a m^n = n\log_a m$}
    {\True $a^{\log_a x} = x$ với mọi $x>0$}
  \loigiai{
    \begin{itemchoice}
      \itemch \textbf{Đúng.} Công thức logarit của tích.
      \itemch \textbf{Sai.} Đúng phải là $\log_a\frac{m}{n}=\log_a m-\log_a n$.
      \itemch \textbf{Đúng.} Công thức logarit của lũy thừa.
      \itemch \textbf{Đúng.} Hàm mũ và logarit là hàm ngược nhau.
    \end{itemchoice}
  }
\end{ex}`,
  },
  {
    id: 'tf4',
    title: 'Số phức z = 3 − 4i',
    description: 'Mô-đun, liên hợp, tổng và tích',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Số phức]
  Cho số phức $z = 3 - 4i$. Xét các mệnh đề:
  \choiceTF[t]
    {\True $|z| = 5$}
    {\True Số phức liên hợp của $z$ là $\bar{z} = 3 + 4i$}
    {\True $z + \bar{z} = 6$}
    {$z \cdot \bar{z} = -25$}
  \loigiai{
    \begin{itemchoice}
      \itemch \textbf{Đúng.} $|z|=\sqrt{9+16}=5$.
      \itemch \textbf{Đúng.} Liên hợp đổi dấu phần ảo.
      \itemch \textbf{Đúng.} $z+\bar{z}=2\cdot\mathrm{Re}(z)=6$.
      \itemch \textbf{Sai.} $z\cdot\bar{z}=|z|^2=25>0$.
    \end{itemchoice}
  }
\end{ex}`,
  },
  {
    id: 'tf5',
    title: 'Xác suất – biến cố',
    description: 'Gieo xúc xắc: mặt chẵn và mặt > 3',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Xác suất]
  Gieo một con xúc xắc cân đối. Gọi $A=$ \textquoteleft\textquoteleft ra mặt chẵn\textquoteright\textquoteright, $B=$ \textquoteleft\textquoteleft ra số lớn hơn $3$\textquoteright\textquoteright. Xét các mệnh đề:
  \choiceTF[t]
    {\True $P(A) = \dfrac{1}{2}$}
    {\True $B = \{4;5;6\}$ và $P(B) = \dfrac{1}{2}$}
    {$A$ và $B$ là hai biến cố xung khắc}
    {\True $P(A\cup B) = \dfrac{2}{3}$}
  \loigiai{
    \begin{itemchoice}
      \itemch \textbf{Đúng.} $A=\{2;4;6\}$, $P(A)=3/6=1/2$.
      \itemch \textbf{Đúng.} $P(B)=3/6=1/2$.
      \itemch \textbf{Sai.} $A\cap B=\{4;6\}\neq\emptyset$, không xung khắc.
      \itemch \textbf{Đúng.} $A\cup B=\{2;4;5;6\}$, $P=4/6=2/3$.
    \end{itemchoice}
  }
\end{ex}`,
  },
];

const SAMPLE_SHORTANS: SampleQuestion[] = [
  {
    id: 'sa1',
    title: 'Nghiệm phương trình logarit',
    description: 'log₃(x²−7) = 2',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Logarit]
  Tập nghiệm của phương trình $\log_{3}\left(x^{2}-7\right)=2$ là
  \shortans{$\{-4;4\}$}
  \loigiai{
    $\log_{3}\left(x^{2}-7\right)=2\Leftrightarrow x^{2}-7=9\Leftrightarrow x^2=16
    \Leftrightarrow\hoac{&x=4\\&x=-4.}$\\
    Tập nghiệm: $S=\{-4;4\}$.
  }
\end{ex}`,
  },
  {
    id: 'sa2',
    title: 'Rút gọn biểu thức căn',
    description: 'Biểu thức A chứa √x, x≥0, x≠1',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Căn thức]
  Rút gọn biểu thức
  $A = \dfrac{\sqrt{x}+1}{\sqrt{x}-1} - \dfrac{\sqrt{x}-1}{\sqrt{x}+1} - \dfrac{4\sqrt{x}}{x-1}$
  với $x\geq 0,\ x\neq 1$.
  \shortans{$0$}
  \loigiai{
    \begin{align*}
      A &= \frac{(\sqrt{x}+1)^2-(\sqrt{x}-1)^2}{x-1}-\frac{4\sqrt{x}}{x-1}\\
        &= \frac{4\sqrt{x}-4\sqrt{x}}{x-1}=0.
    \end{align*}
  }
\end{ex}`,
  },
  {
    id: 'sa3',
    title: 'Bất phương trình logarit',
    description: 'Tập nghiệm log₂(x²−2x) < 3',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Logarit]
  Tập nghiệm của bất phương trình $\log_2(x^2 - 2x) < 3$ là
  \shortans{$(-2;0)\cup(2;4)$}
  \loigiai{
    \textbf{Điều kiện:} $x^2-2x>0\Leftrightarrow x<0$ hoặc $x>2$.\\
    $\log_2(x^2-2x)<3\Leftrightarrow x^2-2x<8\Leftrightarrow (x-4)(x+2)<0\Leftrightarrow -2<x<4$.\\
    Kết hợp: $S=(-2;0)\cup(2;4)$.
  }
\end{ex}`,
  },
  {
    id: 'sa4',
    title: 'Khoảng cách điểm – mặt phẳng',
    description: 'M(1;−2;3) đến 2x−y+2z−1=0 — có hình minh họa',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Hình học giải tích]
  Tính khoảng cách từ điểm $M(1;-2;3)$ đến mặt phẳng $(P): 2x - y + 2z - 1 = 0$.
  \begin{center}
    \begin{tikzpicture}[scale=1, font=\footnotesize, line join=round, line cap=round, >=stealth]
      % Mặt phẳng (P)
      \fill[blue!10] (-2,-0.8)--(2,-0.8)--(2.6,0.5)--(-1.4,0.5)--cycle;
      \draw[blue!60] (-2,-0.8)--(2,-0.8)--(2.6,0.5)--(-1.4,0.5)--cycle;
      \node[blue] at (0.5,-0.2){$(P)$};
      % Điểm M và hình chiếu H
      \coordinate (M) at (0.5,2.5);
      \coordinate (H) at (0.5,0.1);
      \fill[red] (M) circle(1.5pt) node[right]{$M$};
      \fill (H) circle(1.2pt) node[right,font=\scriptsize]{$H$};
      \draw[red,dashed,thick] (M)--(H) node[midway,left]{$d$};
      % Góc vuông tại H
      \draw[thin] ($(H)+(-0.13,0)$)--($(H)+(-0.13,0.13)$)--($(H)+(0,0.13)$);
    \end{tikzpicture}
  \end{center}
  \shortans{$3$}
  \loigiai{
    $d(M,(P)) = \dfrac{|2\cdot1+(-1)(-2)+2\cdot3-1|}{\sqrt{4+1+4}}
    = \dfrac{|2+2+6-1|}{3} = \dfrac{9}{3} = 3$.
  }
\end{ex}`,
  },
  {
    id: 'sa5',
    title: 'Hệ số trong khai triển nhị thức Newton',
    description: 'Hệ số x³ trong (2x−1)⁵',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Nhị thức Newton]
  Tìm hệ số của $x^3$ trong khai triển $(2x - 1)^5$.
  \shortans{$80$}
  \loigiai{
    Số hạng tổng quát: $T_{k+1}=\binom{5}{k}(2x)^{5-k}(-1)^k$.\\
    Để có $x^3$: $5-k=3\Rightarrow k=2$.\\
    $T_3=\binom{5}{2}(2x)^3(-1)^2=10\cdot8x^3=80x^3$.\\
    Vậy hệ số của $x^3$ là $\boxed{80}$.
  }
\end{ex}`,
  },
];

const SAMPLE_ESSAY: SampleQuestion[] = [
  {
    id: 'es1',
    title: 'Khảo sát hàm bậc ba',
    description: 'y = x³ − 3x + 2, có đồ thị, biện luận theo m',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Khảo sát hàm số]
  Cho hàm số $y = x^3 - 3x + 2$.
  \begin{enumerate}[\bf a)]
    \item Khảo sát sự biến thiên và vẽ đồ thị $(C)$ của hàm số.
    \item Tìm giá trị tham số $m$ để phương trình $x^3-3x+2=m$ có đúng ba nghiệm phân biệt.
  \end{enumerate}
  \loigiai{
    \textbf{a)} $y'=3x^2-3=3(x-1)(x+1)$. $y'=0\Leftrightarrow x=\pm1$.\\
    Cực đại: $y(-1)=4$; cực tiểu: $y(1)=0$.
    \begin{center}
      \begin{tikzpicture}[line join=round, line cap=round, >=stealth, font=\footnotesize]
        \draw[->] (-3,0)--(3,0) node[below left]{$x$};
        \draw[->] (0,-1.5)--(0,5.5) node[below left]{$y$};
        \draw (0,0) node[below left]{$O$};
        \foreach \x in {-2,-1,1,2}
          \draw[thin] (\x,1.5pt)--(\x,-1.5pt) node[below]{$\x$};
        \foreach \y in {1,2,3,4}
          \draw[thin] (1.5pt,\y)--(-1.5pt,\y) node[left]{$\y$};
        \begin{scope}
          \clip (-2.8,-1.4) rectangle (2.8,5.4);
          \draw[blue,thick,samples=120,domain=-2.5:2.5,smooth,variable=\x]
               plot(\x,{(\x)^3-3*\x+2});
        \end{scope}
        % Cực trị
        \fill[red] (-1,4) circle(1.8pt) node[above right,red,font=\scriptsize]{CĐ$(-1;4)$};
        \fill[red] (1,0)  circle(1.8pt) node[below right,red,font=\scriptsize]{Ct$(1;0)$};
        \draw[dashed,thin] (-1,0)--(-1,4)--(0,4);
        % Giao Ox
        \fill (0,2) circle(1.5pt);
      \end{tikzpicture}
    \end{center}
    \textbf{b)} PT có 3 nghiệm phân biệt khi $y=m$ cắt $(C)$ tại đúng 3 điểm
    $\Leftrightarrow 0<m<4$.
  }
\end{ex}`,
  },
  {
    id: 'es2',
    title: 'Diện tích hình phẳng',
    description: 'y = x²−2x và y = x — có hình tô màu',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Tích phân diện tích]
  Tính diện tích hình phẳng giới hạn bởi đường cong $y = x^2 - 2x$ và đường thẳng $y = x$.
  \loigiai{
    Giao điểm: $x^2-2x=x\Leftrightarrow x^2-3x=0\Leftrightarrow x=0$ hoặc $x=3$.\\
    Trên $[0;3]$: $x\geq x^2-2x$.
    \begin{center}
      \begin{tikzpicture}[line join=round, line cap=round, >=stealth, font=\footnotesize]
        \draw[->] (-0.5,0)--(4,0) node[below left]{$x$};
        \draw[->] (0,-1.5)--(0,4) node[below left]{$y$};
        \draw (0,0) node[below left]{$O$};
        \foreach \x in {1,2,3}
          \draw[thin] (\x,1.5pt)--(\x,-1.5pt) node[below]{$\x$};
        \foreach \y in {1,2,3}
          \draw[thin] (1.5pt,\y)--(-1.5pt,\y) node[left]{$\y$};
        % Tô vùng giữa 2 đường
        \fill[teal!25]
          plot[domain=0:3,samples=60,variable=\x](\x,{\x})
          -- plot[domain=3:0,samples=60,variable=\x](\x,{(\x)^2-2*\x})
          -- cycle;
        \begin{scope}
          \clip (-0.4,-1.4) rectangle (3.8,3.8);
          \draw[blue,thick,samples=80,domain=-0.3:3.6,smooth,variable=\x]
               plot(\x,{(\x)^2-2*\x});
          \draw[red,thick,domain=-0.3:3.6,variable=\x]
               plot(\x,{\x});
        \end{scope}
        \fill (0,0) circle(1.5pt);
        \fill (3,3) circle(1.5pt) node[above right,font=\scriptsize]{$(3;3)$};
        \node[blue,right,font=\scriptsize] at (3.4,3.5){$y=x^2-2x$};
        \node[red,right,font=\scriptsize] at (3.4,3.0){$y=x$};
      \end{tikzpicture}
    \end{center}
    $S=\displaystyle\int_0^3\bigl[x-(x^2-2x)\bigr]dx
    =\int_0^3(3x-x^2)\,dx
    =\left[\dfrac{3x^2}{2}-\dfrac{x^3}{3}\right]_0^3=\dfrac{27}{2}-9=\dfrac{9}{2}$.
  }
\end{ex}`,
  },
  {
    id: 'es3',
    title: 'Thể tích lều cắm trại',
    description: 'Lăng trụ ngũ giác, tính V₁ − V₂ — có hình vẽ',
    hasFigure: true,
    latex: String.raw`\begin{ex}%[Thể tích lăng trụ]
  Để chuẩn bị cho hoạt động cắm trại, bạn An tìm hiểu hai mẫu lều có kích thước như hình. Cả hai lều đều có dạng khối lăng trụ đứng ngũ giác. Tính $V_1-V_2$ (đơn vị dm$^3$, làm tròn đến hàng đơn vị), trong đó $V_1$, $V_2$ lần lượt là thể tích Lều 1 và Lều 2.
  \begin{center}
    \begin{minipage}{0.44\textwidth}
      \centering
      \begin{tikzpicture}[scale=0.78,font=\footnotesize,line join=round,>=stealth]
        \draw (-2,0)--(2,0)--(2,2)--(0,3)--(-2,2)--cycle
              (2,0)--++(2,2)--++(0,2)--++(-2,1)--++(-2,-1)--(-2,2)
              (2,2)--++(2,2) (0,3)--++(2,2);
        \path (-2,1)node[shift=(180:0.2),rotate=90]{$180$\,cm};
        \path (0,0)node[shift=(-90:0.2)]{$350$\,cm};
        \path (3,1)node[shift=(-60:0.2),rotate=50]{$460$\,cm};
        \path (0,1.5)node[shift=(180:0.2),rotate=90]{$220$\,cm};
        \node[below] at (0,-0.4){Lều 1};
      \end{tikzpicture}
    \end{minipage}
    \hspace{0.04\textwidth}
    \begin{minipage}{0.44\textwidth}
      \centering
      \begin{tikzpicture}[scale=0.78,font=\footnotesize,line join=round,>=stealth]
        \draw (-2,0)--(2,0)--(1.5,2)--(0,3)--(-1.5,2)--cycle
              (1.5,2)--(3.5,4) (0,3)--(2,5)
              (2,0)--++(2,2)--(3.5,4)--(2,5)--(.5,4)--(-1.5,2);
        \path (-2.2,1)node[shift=(180:0.2),rotate=90]{$210$\,cm};
        \path (0,0)node[shift=(-90:0.2)]{$370$\,cm};
        \path (3,1)node[shift=(-60:0.2),rotate=50]{$430$\,cm};
        \path (0,1.5)node[shift=(180:0.2),rotate=90]{$260$\,cm};
        \node[below] at (0,-0.4){Lều 2};
      \end{tikzpicture}
    \end{minipage}
  \end{center}
  \shortans{$961$}
  \loigiai{
    $S_1=180\cdot350+\dfrac{1}{2}\cdot40\cdot350=70\,000\,(\text{cm}^2)$;
    $V_1=70\,000\times460=32\,200\,000\,(\text{cm}^3)$.\\[4pt]
    $S_2=\dfrac{1}{2}(370+260)\cdot210+\dfrac{1}{2}\cdot260\cdot50=72\,650\,(\text{cm}^2)$;
    $V_2=72\,650\times430=31\,239\,500\,(\text{cm}^3)$.\\[4pt]
    $V_1-V_2=960\,500\,(\text{cm}^3)\approx\boxed{961}\,(\text{dm}^3)$.
  }
\end{ex}`,
  },
  {
    id: 'es4',
    title: 'Phương trình lượng giác',
    description: 'Giải cos2x + 3cosx + 2 = 0',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Lượng giác]
  Giải phương trình $\cos 2x + 3\cos x + 2 = 0$.
  \loigiai{
    Dùng $\cos 2x=2\cos^2 x-1$:
    \begin{align*}
      &2\cos^2 x+3\cos x+1=0\\
      &\Leftrightarrow(2\cos x+1)(\cos x+1)=0
    \end{align*}
    \textbf{TH1:} $\cos x=-\dfrac{1}{2}\Rightarrow x=\pm\dfrac{2\pi}{3}+2k\pi,\; k\in\mathbb{Z}$.\\
    \textbf{TH2:} $\cos x=-1\Rightarrow x=(2k+1)\pi,\; k\in\mathbb{Z}$.
  }
\end{ex}`,
  },
  {
    id: 'es5',
    title: 'Bài toán tối ưu hình chữ nhật',
    description: 'Chu vi 100 m, tìm kích thước cho diện tích lớn nhất',
    hasFigure: false,
    latex: String.raw`\begin{ex}%[Tối ưu]
  Một mảnh đất hình chữ nhật có chu vi $100\,\text{m}$. Tìm kích thước để diện tích lớn nhất.
  \loigiai{
    Gọi chiều dài $x$, chiều rộng $y$ ($x,y>0$).\\
    Chu vi: $2(x+y)=100\Rightarrow y=50-x$, $0<x<50$.\\
    Diện tích: $S(x)=x(50-x)=50x-x^2$.\\
    $S'(x)=50-2x=0\Rightarrow x=25$.\\
    $S''(25)=-2<0$ nên $x=25$ là cực đại.\\
    $S_{\max}=25\times25=625\,\text{m}^2$ khi $x=y=25\,\text{m}$ (hình vuông).
  }
\end{ex}`,
  },
];

// ─── Danh mục ────────────────────────────────────────────────────────────────

const CATEGORIES: {
  id: QuestionCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  data: SampleQuestion[];
}[] = [
  { id: 'multichoice', label: 'Trắc nghiệm nhiều lựa chọn', icon: <LayoutGrid size={16} />,    color: 'blue',   data: SAMPLE_MULTICHOICE },
  { id: 'truefalse',   label: 'Đúng / Sai',                 icon: <CheckSquare size={16} />,   color: 'green',  data: SAMPLE_TRUEFALSE },
  { id: 'shortans',    label: 'Trả lời ngắn',               icon: <MessageSquare size={16} />, color: 'orange', data: SAMPLE_SHORTANS },
  { id: 'essay',       label: 'Tự luận',                    icon: <PenLine size={16} />,       color: 'purple', data: SAMPLE_ESSAY },
];

const COLOR_MAP: Record<string, { tab: string; badge: string; ring: string }> = {
  blue:   { tab: 'bg-blue-600 text-white',   badge: 'bg-blue-100 text-blue-700',     ring: 'ring-blue-300' },
  green:  { tab: 'bg-green-600 text-white',  badge: 'bg-green-100 text-green-700',   ring: 'ring-green-300' },
  orange: { tab: 'bg-orange-500 text-white', badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-300' },
  purple: { tab: 'bg-purple-600 text-white', badge: 'bg-purple-100 text-purple-700', ring: 'ring-purple-300' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={handle} title="Sao chép LaTeX"
      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  );
}

type PdfState = { url: string; blob: Blob; filename: string } | null;

function PdfModal({ pdf, onClose, onDownload }: { pdf: PdfState; onClose: () => void; onDownload: () => void }) {
  if (!pdf) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-extrabold text-slate-800 flex items-center gap-2">
            <Eye size={16} className="text-teal-600" /> Xem trước PDF
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.open(pdf.url, '_blank')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center gap-1.5 text-sm">
              <ExternalLink size={14} /> Mở tab mới
            </button>
            <button onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 text-sm">
              <Download size={14} /> Tải PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="h-[74vh]">
          <iframe src={pdf.url} className="w-full h-full" title="pdf-preview" />
        </div>
        <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">
          Nếu không hiển thị, dùng "Mở tab mới" hoặc "Tải PDF".
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SampleQuestionsViewProps {
  onTransferToCompile?: (latex: string) => void;
}

const SampleQuestionsView: React.FC<SampleQuestionsViewProps> = ({ onTransferToCompile }) => {
  const [activeCategory, setActiveCategory] = useState<QuestionCategory>('multichoice');
  const [selectedId, setSelectedId]         = useState<string | null>('mc1');
  const [busy, setBusy]                     = useState(false);
  const [pdf, setPdf]                       = useState<PdfState>(null);
  const [showPdf, setShowPdf]               = useState(false);
  const [log, setLog]                       = useState('');

  const cat      = CATEGORIES.find(c => c.id === activeCategory)!;
  const colors   = COLOR_MAP[cat.color];
  const selected = cat.data.find(q => q.id === selectedId) ?? null;

  const handleTabChange = (id: QuestionCategory) => {
    setActiveCategory(id);
    setSelectedId(CATEGORIES.find(c => c.id === id)!.data[0]?.id ?? null);
    setLog('');
  };

  const doCompile = useCallback(async (body: string, filename: string) => {
    setBusy(true);
    setLog('Đang biên dịch…');
    try {
      const tex  = buildFullTex(body);
      const data = await compileFullTex({ tex, engine: 'pdflatex', returnLog: true });
      if (!data?.ok) {
        setLog(data?.detail || data?.log || 'Compile thất bại');
        alert('❌ Biên dịch lỗi. Xem LOG bên dưới.');
        return;
      }
      setLog(data.log || '✅ Thành công');
      if (data.base64) {
        const blob = base64ToBlob(data.base64, 'application/pdf');
        const url  = URL.createObjectURL(blob);
        if (pdf?.url) URL.revokeObjectURL(pdf.url);
        setPdf({ url, blob, filename });
        setShowPdf(true);
      }
    } catch (e: any) {
      const msg = e?.message || 'Lỗi không xác định';
      setLog(msg);
      alert(`❌ ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [pdf]);

  const handlePreviewOne  = () => selected && doCompile(selected.latex, `${selected.id}.pdf`);
  const handlePreviewAll  = () => doCompile(cat.data.map(q => q.latex).join('\n\n'), `${activeCategory}_all.pdf`);
  const handleTransfer    = () => selected && onTransferToCompile?.(selected.latex);
  const handleTransferAll = () => onTransferToCompile?.(cat.data.map(q => q.latex).join('\n\n'));
  const handleDownload    = () => pdf && downloadBlob(pdf.blob, pdf.filename);

  // cleanup objectURL
  React.useEffect(() => () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); }, []);

  return (
    <>
      <PdfModal pdf={showPdf ? pdf : null} onClose={() => setShowPdf(false)} onDownload={handleDownload} />

      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <BookOpen size={20} className="text-teal-600" /> Câu hỏi mẫu theo loại
          </div>
          <p className="text-sm text-slate-500">
            Chọn loại câu hỏi → xem LaTeX mẫu đúng format
            <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-xs">\begin&#123;ex&#125;</code>
            → biên dịch xem trước PDF hoặc chuyển sang tab Biên dịch.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => {
            const isActive = c.id === activeCategory;
            const col      = COLOR_MAP[c.color];
            return (
              <button key={c.id} onClick={() => handleTabChange(c.id)}
                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  isActive ? col.tab : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}>
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sidebar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
            <div className="font-bold text-slate-700 text-sm px-1 flex items-center justify-between">
              <span>Câu mẫu</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors.badge}`}>
                {cat.data.length} câu
              </span>
            </div>

            {cat.data.map(q => (
              <button key={q.id} onClick={() => { setSelectedId(q.id); setLog(''); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-start gap-2 ${
                  selectedId === q.id
                    ? `ring-2 ${colors.ring} border-transparent bg-slate-50`
                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                <ChevronRight size={14}
                  className={`mt-0.5 flex-shrink-0 ${selectedId === q.id ? 'text-teal-600' : 'text-slate-300'}`} />
                <div>
                  <div className="font-bold text-slate-800 text-sm leading-snug">{q.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{q.description}</div>
                  {q.hasFigure && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
                      📐 Có hình TikZ
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/* Bulk actions */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
              <button onClick={handlePreviewAll} disabled={busy}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Xem tất cả ({cat.data.length} câu)
              </button>
              {onTransferToCompile && (
                <button onClick={handleTransferAll} disabled={busy}
                  className="w-full py-2 rounded-xl border border-teal-200 text-teal-700 hover:bg-teal-50 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <ArrowRight size={14} /> Chuyển tất cả → Biên dịch
                </button>
              )}
            </div>
          </div>

          {/* Panel phải */}
          <div className="lg:col-span-2 space-y-3">
            {selected ? (
              <>
                {/* Toolbar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center justify-between">
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Code size={15} className="text-teal-600" />
                    {selected.title}
                    {selected.hasFigure && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                        📐 TikZ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CopyButton text={selected.latex} />
                    <button onClick={handlePreviewOne} disabled={busy}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-60">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                      Xem trước PDF
                    </button>
                    {onTransferToCompile && (
                      <button onClick={handleTransfer} disabled={busy}
                        className="px-3 py-1.5 rounded-xl border border-teal-300 text-teal-700 hover:bg-teal-50 font-bold text-sm flex items-center gap-1.5 disabled:opacity-60">
                        <ArrowRight size={14} /> Sang Biên dịch
                      </button>
                    )}
                    {pdf && (
                      <button onClick={handleDownload}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-1.5">
                        <Download size={14} /> Tải PDF
                      </button>
                    )}
                  </div>
                </div>

                {/* Code block */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 font-mono">
                      LaTeX — \begin&#123;ex&#125; … \end&#123;ex&#125;
                    </span>
                    <CopyButton text={selected.latex} />
                  </div>
                  <pre className="text-xs font-mono p-4 overflow-auto max-h-[420px] text-slate-700 leading-relaxed whitespace-pre-wrap break-all">
                    {selected.latex}
                  </pre>
                </div>

                {/* Compile log */}
                {log && (
                  <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2">
                      <Wand2 size={12} /> LOG biên dịch
                    </div>
                    <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap max-h-[180px] overflow-auto leading-relaxed">
                      {log}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex items-center justify-center text-slate-400 text-sm">
                Chọn một câu hỏi mẫu từ danh sách bên trái.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SampleQuestionsView;
