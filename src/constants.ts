// @ts-nocheck
// src/constants.ts
import { QuestionType } from './types';

export const DEFAULT_OPTIONS = {
  questionType: QuestionType.MULTICHOICE,
  questionCount: 5,
  topic: '',
  includeTikz: false,
  includeSolution: false,
  autoTikz: true,
  highQuality: false,
  additionalRequirements: ''
};

// Đã đổi thành Record<string, string> để không bị lỗi thiếu key
export const TYPE_LABELS: Record<string, string> = {
  [QuestionType.MULTICHOICE]: 'Trắc nghiệm (4 phương án chọn 1)',
  [QuestionType.TRUEFALSE]: 'Trắc nghiệm Đúng/Sai (4 mệnh đề)',
  [QuestionType.SHORTANS]: 'Trả lời ngắn (Short Answer)',
  [QuestionType.ESSAY]: 'Tự luận (Essay)',
};

// ✅ Template để App.tsx split marker rồi chèn latexContent vào
// ✅ Dùng String.raw để tránh lỗi escape "\b" trong "\begin" khi build Vercel
export const EX_TEST_DETHI_TEMPLATE = String.raw`\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{vietnam}
\usepackage{amsmath,amssymb,xcolor}
\usepackage{enumerate}
\def\H{\bfseries\fontfamily{pag}\selectfont}
\def\mau{teal}
\def\tren{1.5}\def\duoi{1.5}\def\trai{1.5}\def\phai{1.5} 
\usepackage[top=\tren cm, bottom=\duoi cm, left=\trai cm, right=\phai cm]{geometry}
\usepackage[dethi]{ex_test}
%%%%%%%%%%%%% Thông tin tiêu đề
\def\duoitrai{Lớp toán thầy lĩnh}
\def\duoiphai{}
\usepackage[most]{tcolorbox}
\usepackage{fancyhdr}
\usepackage{tkz-euclide}
\usepackage{setspace}
\setstretch{1.35}
\usepackage{tikz}
\usepackage{tkz-tab}
\usepackage{toanTHCS} 
\usetikzlibrary{shapes,shapes.geometric,arrows,calc,intersections,angles,patterns,decorations.pathmorphing,backgrounds,positioning,fit,matrix,shapes.symbols}
%Lệnh viết tắt
\newcommand{\hoac}[1]{\left[\begin{aligned}#1\end{aligned}\right.}
\newcommand{\heva}[1]{\left\{\begin{aligned}#1\end{aligned}\right.}
\everymath{\displaystyle}
%%%%%%%%%%%%
\renewtheorem{ex}{\H\color{\mau}Câu}
\newtheorem{vd}{\H\color{\mau}Ví dụ}
\newtheorem{bt}{\H\color{\mau} Bài}
\def\loigiaiEX{\tikz[]{
    \draw (0,0)++(0.5*\textwidth,0) node[inner sep=0pt] {\H\color{\mau}\strut Lời giải.};}\vspace*{-2mm}}
\def\qedEX{\color{\mau}\ensuremath{\square}}
%%%%%%% Định nghĩa lại A.B.C.D với style nâng cao
\renewcommand{\circEX}[2][fill=red,draw=red]{%
    \tikz[baseline=(char.base)]{\node[shape=circle,inner sep=1pt,#1] (char) {\bfseries\sffamily\color{white}#2};}
}
\renewcommand*\circled[1]{\tikz[baseline=(char.base)]{
    \node[inner sep=1pt,shape=circle,fill=\mau] (char) {\bfseries\sffamily\color{white} #1};}}
\renewcommand{\TrueEX}{\stepcounter{dapan}{\circled{\textbf{\H\color{white}\Alph{dapan}}}} \ignorespaces}
\renewcommand{\FalseEX}{\stepcounter{dapan}{\circled{\textbf{\H\color{white}\Alph{dapan}}}} \ignorespaces}
%%%%%%%
\renewcommand{\baselinestretch}{1.4}
\renewenvironment{center}{\parskip=0pt\par\nopagebreak\centering}{\par\noindent\ignorespacesafterend}
%%%HEADER AND FOOTER (Fancy hexagon style)
\pagestyle{fancy}
\fancyhead{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\usepackage{eso-pic}
\AddToShipoutPicture{
\ifodd\thepage
\begin{tikzpicture}[overlay,remember picture]
\path ($(current page.south east)+(135:1.5)$) node[fill=\mau!65,minimum size=15pt,double,inner sep=4pt,
regular polygon, regular polygon sides=6,shape border rotate=60,font=\H](char){\thepage\;}
node[minimum size=15pt,inner sep=4pt,
regular polygon, regular polygon sides=6,shape border rotate=60,font=\H](A){\thepage\;};
\path ($(current page.south west)+(45:1.5)+(0.75,-3pt)$) node[anchor=west] (B)%
{\color{\mau}{\H\, \duoitrai}};
\draw[thick,\mau] ($(A.west)-(0.05,0)$)--($(B.east)+(0,3pt)$);
\end{tikzpicture}
\else
\begin{tikzpicture}[overlay,remember picture]
\path ($(current page.south west)+(45:1.5)$)
node[fill=\mau!65,minimum size=15pt,inner sep=4pt,
regular polygon, regular polygon sides=6,shape border rotate=60,font=\H] (char){\thepage\;}
node[minimum size=15pt,inner sep=4pt,
regular polygon, regular polygon sides=6,
shape border rotate=45,font=\H](A){\thepage\;};
\path ($(current page.south east)+(135:1.5)-(0.75,3pt)$) node[anchor=east] (B)%
{\color{\mau}{\H\, \duoiphai}};
\draw[thick,\mau] ($(A.east)+(0.05,0)$)--($(B.west)+(0,3pt)$);
\end{tikzpicture}
\fi
}
\begin{document}
\begin{center}
\textbf{\H\color{\mau}\Large BÀI TẬP VỀ NHÀ}\\[5pt]
\textit{Môn: Toán 12 -- Thời gian: 45 phút}
\end{center}
\vspace{0.5cm}
%=== THÊM CÂU HỎI TẠI ĐÂY ===

\end{document}`
// ─── THÊM VÀO src/constants.ts (dán sau EX_TEST_DETHI_TEMPLATE) ───────────────

export const PHIEU_BAITAP_MARKER = '%=== THÊM BÀI TẬP TẠI ĐÂY ===';

export const EX_PHIEU_BAITAP_TEMPLATE = String.raw`\documentclass[12pt,a4paper,onecolumn,titlepage,openany,twoside]{article}

%======================================================================
% 1. CÁC GÓI CƠ BẢN VÀ THIẾT LẬP
%======================================================================
\usepackage[utf8]{vietnam}
\usepackage{amsmath,amssymb,fontawesome}
\usepackage[table,xcdraw]{xcolor}
\usepackage[linkcolor=black,colorlinks]{hyperref}
\usepackage{changepage, ifthen, pgfplots, setspace, lipsum}
\strictpagecheck
\usepackage[dethi]{ex_test}
\usepackage[most]{tcolorbox}
\usepackage{fancyhdr}
\usepackage{titletoc,titlesec,eso-pic}
\usepackage{tkz-euclide, tkz-tab, tikz, tikz-3dplot}
\usetikzlibrary{shapes.geometric,arrows,calc,intersections,angles,patterns,decorations.pathmorphing,backgrounds,positioning,fit,petri,shapes.symbols,matrix,tikzmark,shadings,fadings}
\usepackage{lastpage}
\usepackage{longtable}
\usepackage{array}

%======================================================================
% 2. CÁC BIẾN TÙY CHỈNH
%======================================================================
\def\H{\bfseries\fontfamily{ugq}\selectfont}
\def\mau{teal}
\def\mauchinh{teal}
\setstretch{1.35}
\setlength{\parindent}{0pt}
\everymath{\displaystyle}
\def\tren{2.1}\def\duoi{2.6}\def\trai{2.1}\def\phai{2.1}
\usepackage[top=\tren cm, bottom=\duoi cm, left=\trai cm, right=\phai cm]{geometry}

%======================================================================
% 3. LỆNH MỚI CHO CÂU HỎI TRẢ LỜI NGẮN
%======================================================================
\newcommand{\shortansfour}[1]{%
  \hfill%
  \tikz[baseline=-0.3cm]{ \foreach \i in {1,...,4} \draw[thick, \mau] (0.7*\i-0.7, -0.3) rectangle (0.7*\i, 0.3); }%
  \hideans{\shortans[oly]{#1}}%
}

%======================================================================
% 4. LỆNH STAR VÀ ENVIRONMENT BAITAP
%======================================================================
\definecolor{goldstar}{RGB}{255,215,0}

\newcommand{\Star}[1]{%
  \ifcase#1\relax%
  \or
  {\color{goldstar}\faStar}{\color{gray!40}\faStarO}{\color{gray!40}\faStarO}{\color{gray!40}\faStarO}{\color{gray!40}\faStarO}
  \or
  {\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{gray!40}\faStarO}{\color{gray!40}\faStarO}{\color{gray!40}\faStarO}
  \or
  {\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{gray!40}\faStarO}{\color{gray!40}\faStarO}
  \or
  {\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{gray!40}\faStarO}
  \else
  {\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{goldstar}\faStar}{\color{goldstar}\faStar}
  \fi
}

\newcounter{baitap}
\NewDocumentEnvironment{baitap}{O{} m m}{%
  \vspace{6pt}
  \noindent
  \begin{minipage}{\textwidth}
    \begin{tcolorbox}[
      enhanced,
      colback=\mauchinh,
      colframe=\mauchinh,
      arc=5pt,
      boxrule=0pt,
      top=4pt, bottom=4pt, left=8pt, right=8pt,
      width=\textwidth,
      ]
      \refstepcounter{baitap}
      \textcolor{white}{\bfseries\small\faEdit\ BÀI TẬP \thebaitap}
      \hfill
      \ifstrempty{#1}{}{\textcolor{white}{\footnotesize\Star{#1}}}
    \end{tcolorbox}
    \begin{tcolorbox}[
      enhanced,
      colback=white,
      colframe=\mauchinh!30,
      arc=5pt,
      boxrule=0.5pt,
      top=6pt, bottom=6pt, left=6pt, right=6pt,
      width=\textwidth,
      ]
      \begin{minipage}[t]{0.48\textwidth}
        \begin{tcolorbox}[
          enhanced,
          colback=\mauchinh!8,
          colframe=\mauchinh!50,
          arc=4pt,
          boxrule=0.4pt,
          top=5pt, bottom=5pt, left=5pt, right=5pt,
          ]
          \textcolor{\mauchinh}{\bfseries\footnotesize\faBook\ TRÊN LỚP}\par
          \vspace{-4pt}
          \textcolor{\mauchinh}{\rule{\linewidth}{1pt}}
          \vspace{3pt}
          \footnotesize{#2}
        \end{tcolorbox}
      \end{minipage}
      \hfill
      \begin{minipage}[t]{0.48\textwidth}
        \begin{tcolorbox}[
          enhanced,
          colback=orange!8,
          colframe=orange!50,
          arc=4pt,
          boxrule=0.4pt,
          top=5pt, bottom=5pt, left=5pt, right=5pt,
          ]
          \textcolor{orange}{\bfseries\footnotesize\faHome\ VỀ NHÀ}\par
          \vspace{-4pt}
          \textcolor{orange}{\rule{\linewidth}{1pt}}
          \vspace{3pt}
          \footnotesize{#3}
        \end{tcolorbox}
      \end{minipage}
    \end{tcolorbox}
  \end{minipage}
}{}

%======================================================================
% 5. KHUNG CÂU HỎI
%======================================================================
\newtcolorbox{exbox}[1][]{
  breakable,
  enhanced,
  colback=white,
  colframe=\mau,
  boxrule=0.5pt,
  fonttitle=\bfseries\fontfamily{ugq}\selectfont\color{white},
  colbacktitle=\mau, coltitle=white,
  title=Câu \refstepcounter{ex}\theex,
  attach boxed title to top left={yshift=-0.85cm,yshifttext=-.75cm},
  boxed title style={
    colframe=\mau,
    colback=\mau,
    arc=5pt,
    sharp corners=west,
  },
  drop fuzzy shadow={opacity=0.4, \mau},
  finish={
    \begin{scope}
      \def\corner{
        ($(frame.north east)-(0,1.2)$) -- ($(frame.north east)-(0,.9)$) ..
        controls ($(frame.north east)-(-0,.54)$) and ($(frame.north east)-(.56,.44)$) .. ($(frame.north east)-(.76,.92)$)
        .. controls ($(frame.north east)-(1.72,0)$) .. ($(frame.north east)-(2.28,0)$)
        [rounded corners=6] -- ($(frame.north east)-(1.88,0)$)
        [rounded corners=6] -- ($(frame.north east)-(0,.68)$)
        [rounded corners=6] -- ($(frame.north east)-(0,1.2)$)
      }
      \fill[\mau] \corner;
    \end{scope}
  },
  before skip=4mm, after skip=4mm,
  left=5pt, right=5pt, top=4mm, bottom=5pt,
  #1
}

%======================================================================
% 6. MÔI TRƯỜNG ex
%======================================================================
\def\beginbox{\begin{exbox}}
\def\endbox{\end{exbox}}

\AtBeginEnvironment{ex}{
  \renewcommand{\loigiai}[1]{
    \endbox\vspace{1mm}\def\endbox{}%
    \begin{onlysolution}
      #1 \hfill\qedEX
    \end{onlysolution}
  }
}
\renewenvironment{ex}{\beginbox}{\endbox}

\def\loigiaiEX{\tikz{\node[inner sep=0pt] at (0.5\textwidth,0) {\H\color{\mau}\strut\faEdit\ Lời giải.};}\vspace*{-2mm}}
\def\qedEX{\color{\mau}\ensuremath{\square}}

%======================================================================
% 7. CÁC ĐỊNH NGHĨA KHÁC
%======================================================================
\renewcommand\circled[1]{\tikz[baseline=(char.base)]{\node[shape=circle,fill=\mau!3,draw=\mau,inner sep=1pt] (char) {\bfseries\H\color{\mau} #1};}}
\renewcommand{\circEX}[2][fill=\mau!3,draw=\mau]{\tikz[baseline=(char.base)]{\node[shape=circle,inner sep=1pt,#1] (char) {\bfseries\H\selectfont\color{\mau}#2};}}
\renewcommand{\TrueEX}{\stepcounter{dapan}{\circEX[fill=red!20, draw=\mau]{{\color{red}\H\selectfont\Alph{dapan}}}}\ignorespaces}
\renewcommand{\FalseEX}{\stepcounter{dapan}{\circled{{\H\Alph{dapan}}}}\ignorespaces}
\renewcommand{\footrulewidth}{0pt}
\renewcommand{\headrulewidth}{0pt}
\pagestyle{fancy}
\cfoot{}
\definecolor{shadow@color}{cmyk}{.07,0,0,0.49}
\newlength{\lenn} \lenn=1.3cm
\newlength{\lenp} \lenp=\dimexpr 2.8mm+\lenn
\usepackage[shortlabels]{enumitem}
\setlist[enumerate,1]{label=\textbf{\alph*)},itemindent=0.65cm,labelwidth=0.25cm,topsep=0pt,itemsep=-2pt}
\renewenvironment{center}{\parskip=0pt\par\nopagebreak\centering}{\par\noindent\ignorespacesafterend}

%======================================================================
% 8. THIẾT KẾ NỀN TRANG
%======================================================================
\AddToShipoutPictureBG{
  \begin{tikzpicture}[remember picture, overlay]
    \draw[fill=\mau!5,line width=2pt,draw=\mau] ([shift={(\lenn,-\lenn)}]current page.north west) rectangle ([shift={(-\lenn,\lenn)}] current page.south east) ;
    \coordinate (bx) at ([shift={(\lenp,-4cm)}]current page.north west) ;
    \coordinate(ax) at ([xshift=\lenp]current page.west) ;
    \coordinate (cx) at ([shift={(\lenp,4cm)}]current page.south west) ;
    \foreach \i in {-0.5,0,.5} {\draw[fill=\mau!30] ([yshift=\i cm] bx) circle (4pt); \draw[line width=2pt,\mau] ([yshift=\i cm] bx) arc (-10:265:3mm and 1.5mm);}
    \foreach \i in {0,.5,1} {\draw[fill=\mau!30] ([yshift=\i cm] ax) circle (4pt); \draw[line width=2pt,\mau] ([yshift=\i cm] ax) arc (-10:265:3mm and 1.5mm);}
    \foreach \i in {-0.5,0,.5} {\draw[fill=\mau!30] ([yshift=\i cm] cx) circle (4pt); \draw[line width=2pt,\mau] ([yshift=\i cm] cx) arc (-10:265:3mm and 1.5mm);}
    \node[rounded corners=3pt,fill=shadow@color,inner ysep=5pt, inner xsep=2ex,text=blue] (shadow) at ([yshift=2cm]current page.south) {\thepage};
    \node[rounded corners=3pt,fill=\mau,inner ysep=5pt, inner xsep=2ex,font=\large\bfseries\color{white}] at ($(shadow)+(2pt,2pt)$) {\thepage};
  \end{tikzpicture}
}

\begin{document}

%=== THÊM BÀI TẬP TẠI ĐÂY ===

\end{document}`;
