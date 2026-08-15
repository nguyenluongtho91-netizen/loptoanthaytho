/**
 * tikzService.ts - TikZ Snippets Management
 * Chuyển đổi từ Tikz.gs (Google Apps Script) sang TypeScript
 */

// ===== 📚 TIKZ CATEGORIES =====
export type TikzCategory = 
  | 'hinh_phang'           // Hình học phẳng (tam giác, tứ giác, đường tròn...)
  | 'hinh_khong_gian'      // Hình không gian (chóp, lăng trụ, nón, trụ, cầu...)
  | 'do_thi'               // Đồ thị hàm số
  | 'bang_bien_thien'      // Bảng biến thiên
  | 'truc_so'              // Trục số / xét dấu
  | 'bieu_do'              // Biểu đồ thống kê
  | 'khong_co_hinh';       // Không có hình vẽ

// ===== 🎨 SNIPPET DEFINITIONS =====

/**
 * Snippet đầy đủ cho hình học phẳng
 */
const getSnippetHinhPhang = (): string => {
  return `%% =============== HÌNH HỌC PHẲNG ===============
% -- Vẽ tam giác ABC
\\draw(A)--(B)--(C)--cycle;

% -- Kẻ AH vuông góc với BC
\\draw (A)--(vuonggoc cs:from=A, on=B--C) coordinate(H);

% -- Hoặc từ B kẻ BH vuông góc với AD tại H
\\draw (B) -- ($(A)!(B)!(D)$) coordinate(H);
\\pic[draw,thin,angle radius=3mm] {right angle = A--H--B};

% -- M là trung điểm BC
\\coordinate(M) at ($(B)!0.5!(C)$);
\\draw (A)--(M);

% -- BD là đường phân giác
\\bisectorpoint(A,B,C)(D)
\\draw (B)--(D);

% -- Hiển thị tên điểm
\\foreach \\i/\\g in {A/90,B/-90,C/-90,H/-90}{%
   \\draw[fill=white](\\i) circle (1.5pt)
        ($( \\i )+(\\g:3mm)$) node[scale=1]{$\\i$};
}

% -- Tam giác vuông tại C
\\draw (A)--(B)--(tamgiacvuong cs:on=A--B) coordinate(C)--cycle;

% -- Tam giác cân tại A
\\coordinate (A) at (0,5);
\\coordinate (B) at (-2,0);
\\coordinate (C) at (2,0);
\\path (A)--(B) node[midway,sloped,scale=0.5]{$|$};
\\path (A)--(C) node[midway,sloped,scale=0.5]{$|$};
\\draw(A)--(B)--(C)--cycle;

% -- Tam giác đều ABC
\\def\\canh{5}
\\coordinate (B) at (0,0);
\\coordinate (C) at (\\canh,0);
\\coordinate (A) at ($(B) + (60:\\canh)$);
\\draw(A)--(B)--(C)--cycle;

% -- Đường tròn nội tiếp
\\inradius(A,B,C)(\\r)
\\incenter(A,B,C)(I)
\\draw (I) circle(\\r);

% -- Đường tròn ngoại tiếp
\\circumcenter(A,B,C)(O)
\\circumradius(A,B,C)(\\R)
\\draw (O) circle(\\R);

% -- Đường tròn tâm A, bán kính 3cm
\\path[name path=T] (A) circle (3 cm);

% -- Vẽ tiếp tuyến tại M
\\coordinate (Tempt1) at ($(M)!1cm!90:(A)$);
\\coordinate (Tempt2) at ($(M)!0cm!-90:(A)$);
\\draw (Tempt1)--(Tempt2);

% -- Hình vuông ABCD
\\def\\canh{4}
\\coordinate (A) at (0,\\canh);
\\coordinate (B) at (\\canh,\\canh);
\\coordinate (D) at (0,0);
\\coordinate (C) at ($(B)+(D)-(A)$);
\\draw(A)--(B)--(C)--(D)--cycle;
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;
};

/**
 * Snippet cho hình không gian
 */
const getSnippetHinhKhongGian = (): string => {
  return `%% =============== HÌNH KHÔNG GIAN ===============
% -- Vẽ hình nón
\\begin{tikzpicture}[line join=round, line cap=round, font=\\scriptsize]
  \\def\\a{2}
  \\def\\b{1}
  \\def\\h{4}
  
  \\draw[dashed] (180:\\a) arc (180:0:{\\a} and {\\b})
                (90:\\h)--(0,0) node[midway,right]{$h$} 
                (0,0)--(0:\\a);
  
  \\draw (-\\a,\\h)--(-\\a,0) 
        arc (180:360:{\\a} and {\\b})--(\\a,\\h) node[midway,right]{$l$}
        (90:\\h) ellipse ({\\a} and {\\b})
        (90:\\h)--(\\a,\\h) node[midway,above]{$r$};
\\end{tikzpicture}

% -- Vẽ hình trụ
\\begin{tikzpicture}[line join=round, line cap=round, font=\\scriptsize]
  \\def\\a{2}
  \\def\\b{1}
  \\def\\h{3}
  
  \\pgfmathsetmacro\\g{asin(\\b/\\h)}
  \\pgfmathsetmacro\\xo{\\a*cos(\\g)}
  \\pgfmathsetmacro\\yo{\\b*sin(\\g)}
  
  \\draw[dashed](\\xo,\\yo) arc (\\g:180-\\g:{\\a} and {\\b})(180:\\a)--(0,0) 
        node[midway,below]{$r$}
        (0,0)--(0:\\a)
        (90:\\h)--(0,0) node[midway,right]{$h$};
  
  \\draw (90:\\h)--(-\\xo,\\yo) node[midway,slopped,above]{$l$}
        arc(180-\\g:360+\\g:{\\a} and {\\b})--cycle;
\\end{tikzpicture}

% -- Vẽ hình cầu
\\begin{tikzpicture}
  \\def\\r{3}
  
  \\draw[dashed](180:\\r) arc (180:0:{\\r} and {.3*\\r})
               (90:\\r) arc (90:-90:{.3*\\r} and {\\r})
               (0,0) node[below]{$O$}--(30:\\r) circle(0.04) 
               node[right]{$A$} node[midway,above]{$r$};
  
  \\draw (0:0) circle(\\r)
        (180:\\r) arc(180:360:{\\r} and {.3*\\r})
        (90:\\r) arc(90:270:{.3*\\r} and {\\r});
  
  \\draw (0,0) circle(0.04) (30:\\r) circle(0.04);
\\end{tikzpicture}

% -- Hình chóp tam giác đều S.ABC
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\ac{4}
  \\def\\ab{2}
  \\def\\h{4}
  \\def\\gocA{50}
  
  \\coordinate[label=left:$A$] (A) at (0,0);
  \\coordinate[label=right:$C$] (C) at (\\ac,0);
  \\coordinate[label=below left:$B$] (B) at (-\\gocA:\\ab);
  
  \\coordinate (M) at ($(B)!.5!(C)$);
  \\coordinate[label=below right:$O$] (G) at ($(A)!2/3!(M)$);
  \\coordinate[label=above:$S$] (S) at ($(G)+(90:\\h)$);
  
  \\draw (A)--(B)--(C)--(S)--cycle (S)--(B);
  \\draw[dashed] (A)--(C) (S)--(G);
  
  \\foreach \\diem in {A,B,C,S,G}
    \\fill (\\diem) circle(1pt);
\\end{tikzpicture}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;
};

/**
 * Snippet cho đồ thị hàm số
 */
const getSnippetDoThi = (): string => {
  return `%% =============== ĐỒ THỊ HÀM SỐ ===============
% -- Đồ thị hàm bậc hai y = x^2 + 2x + 3
\\begin{tikzpicture}[line join=round, line cap=round, >=stealth, thin]
  \\tikzset{every node/.style={scale=0.9}}
  
  \\draw[->] (-4.1,0)--(4.1,0) node[below left] {$x$};
  \\draw[->] (0,-4.1)--(0,4.1) node[below left] {$y$};
  \\draw (0,0) node[below left] {$O$};
  
  \\foreach \\x/\\nx in {-3/-3, -2/-2, -1/-1, 1/1, 2/2, 3/3}
    \\draw[thin] (\\x,1pt)--(\\x,-1pt) node[below] {$\\nx$};
  
  \\foreach \\y/\\ny in {-3/-3, -2/-2, -1/-1, 1/1, 2/2, 3/3}
    \\draw[thin] (1pt,\\y)--(-1pt,\\y) node[left] {$\\ny$};
  
  \\begin{scope}
    \\clip (-4,-4) rectangle (4,4);
    \\draw[samples=200, domain=-3:3, smooth, variable=\\x]
         plot (\\x, {(\\x)^2 + 2*(\\x) + 3});
  \\end{scope}
\\end{tikzpicture}

% -- Đồ thị hàm phân thức y = (x+1)/(3x+2)
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\xmin{-4} \\def\\xmax{2} \\def\\ymin{-3} \\def\\ymax{3}
  
  \\draw[->] (\\xmin-0.2,0)--(\\xmax+0.2,0) node[below] {$x$};
  \\draw[->] (0,\\ymin-0.2)--(0,\\ymax+0.2) node[right] {$y$};
  \\draw (0,0) node [below left] {$O$};
  
  \\clip (\\xmin,\\ymin) rectangle (\\xmax,\\ymax);
  
  % Tiệm cận
  \\draw[dashed] (\\xmin,0.33)--(\\xmax,0.33);
  \\draw[dashed] (-0.67,\\ymin)--(-0.67,\\ymax);
  
  % Đồ thị
  \\draw[smooth,samples=200,domain=\\xmin:-0.77]
       plot (\\x,{(\\x+1)/(3*\\x+2)});
  \\draw[smooth,samples=200,domain=-0.57:\\xmax]
       plot (\\x,{(\\x+1)/(3*\\x+2)});
\\end{tikzpicture}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;
};

/**
 * Snippet cho bảng biến thiên
 */
const getSnippetBangBienThien = (): string => {
  return `%% =============== BẢNG BIẾN THIÊN ===============
% -- Hàm bậc hai y = x^2 + 2x + 3
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.5,espcl=5,deltacl=0.6]
     {$x$/0.7,$y'$/0.7,$y$/2}{$-\\infty$,$-1$,$+\\infty$}
  \\tkzTabLine{,-,0,+,}
  \\tkzTabVar{+/$+\\infty$,-/$2$,+/$+\\infty$} 
\\end{tikzpicture}

% -- Hàm bậc ba y = x^3 + 3x^2 - 2
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.5,espcl=2.5,deltacl=0.7]
     {$x$/0.6,$y'$/0.6,$y$/2}
     {$-\\infty$,$-2$,$0$,$+\\infty$}
  \\tkzTabLine{,+,0,-,0,+,}
  \\tkzTabVar{-/$-\\infty$,+/$2$,-/$-2$,+/$+\\infty$}
\\end{tikzpicture}

% -- Hàm phân thức y = (x+1)/(3x+2)
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.2,espcl=2.5,deltacl=0.6]
     {$x$/0.6,$y'$/0.6,$y$/2}
     {$-\\infty$,$-\\frac{2}{3}$,$+\\infty$}
  \\tkzTabLine{,-,d,-,}
  \\tkzTabVar{+/$\\frac{1}{3}$,-D+/$-\\infty$/$+\\infty$,-/$\\frac{1}{3}$}
\\end{tikzpicture}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;
};

/**
 * Snippet cho trục số
 */
const getSnippetTrucSo = (): string => {
  return `%% =============== TRỤC SỐ / XÉT DẤU ===============
% -- Vẽ trục số, tô đoạn (a, b]
\\begin{tikzpicture}[line join=round, line cap=round, >=stealth, thick]
  \\fill[pattern=north east lines](-4,-0.15) rectangle (-1.5,0.15);
  \\draw[->] (-4,0)--(4,0);
  \\draw (-1.5,0) node {$\\big($} 
        (-1.5,0) node[below=6pt] {$a$};
  \\draw (0.75,0) node {$\\big]$} 
        (0.75,0) node[below=6pt] {$b$};
\\end{tikzpicture}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;
};

/**
 * Snippet cho biểu đồ
 */
const getSnippetBieuDo = (): string => {
  return `%% =============== BIỂU ĐỒ ===============
% -- Biểu đồ cột
\\begin{tikzpicture}[scale=.5,font=\\scriptsize]
  \\draw[->] (0,0)--(16,0) node[below]{$x$};
  \\draw[->] (0,0)--(0,5.5) node[left]{$n$};
  
  \\foreach \\x/\\n[count=\\i from 1] in {10/3,12/4,15/5}{
    \\draw[line width=4mm,magenta] (\\i,0) node[below, black]{$\\x$}
                     --++(0,\\n);
    \\draw[dashed] (\\i,\\n)--(0,\\n) node[left]{$\\n$};
  }
\\end{tikzpicture}

% -- Biểu đồ tròn
\\begin{tikzpicture}
  \\def\\r{2}
  \\def\\gocxp{90}
  \\coordinate (A) at (90:\\r);
  
  \\foreach \\val/\\freq/\\col/\\pattern[count=\\i from 0] 
      in {Giỏi/20/red/horizontal lines,
          Khá/35/green/north east lines,
          Đạt/40/blue/grid,
          Chưa đạt/5/magenta/bricks}{
    
    \\pgfmathsetmacro\\gockt{-(\\freq*3.6 - \\gocxp)}
    \\pgfmathsetmacro\\gocnode{\\gocxp + \\gockt}
    
    \\draw[gray!50,pattern=\\pattern,pattern color=\\col]
          (0,0)--(A) arc(\\gocxp:\\gockt:\\r) coordinate(A)--cycle;
    
    \\fill[pattern=\\pattern,pattern color=\\col]
          (\\r+1,\\r-0.75*\\i)
          --++(0:1.25)
          --++(-90:.5) node[pos=.5,right,black]{\\val}
          --++(180:1.25)--cycle;
    
    \\path ($(0,0)+(\\gocnode/2:1.1)$) 
         node[fill=white,inner sep=0pt,circle]
         {\\color{black} $\\freq\\%$};
    
    \\global\\let\\gocxp=\\gockt
  }
\\end{tikzpicture}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;
};

// ===== 🔍 ANALYSIS FUNCTIONS =====

/**
 * Phân tích nội dung để xác định loại hình vẽ TikZ cần thiết
 */
export const analyzeProblemForTikz = (content: string): TikzCategory => {
  const contentLower = content.toLowerCase();
  
  // Keywords cho từng category
  const keywords: Record<TikzCategory, string[]> = {
    hinh_phang: [
      'tam giác', 'tứ giác', 'hình vuông', 'hình chữ nhật', 'hình thoi',
      'hình bình hành', 'hình thang', 'đường tròn', 'đường thẳng',
      'góc', 'đoạn thẳng', 'chu vi', 'diện tích', 'phân giác', 'trung tuyến',
      'đường cao', 'nội tiếp', 'ngoại tiếp', 'tiếp tuyến'
    ],
    hinh_khong_gian: [
      'hình chóp', 'lăng trụ', 'hình nón', 'hình trụ', 'hình cầu',
      'hình hộp', 'mặt phẳng', 'đường thẳng trong không gian',
      'thể tích', 'diện tích toàn phần', 'góc giữa đường thẳng',
      'khoảng cách', 'hình lập phương', 'hình chóp cụt'
    ],
    do_thi: [
      'đồ thị', 'hàm số', 'parabol', 'hyperbol', 'bậc hai', 'bậc ba',
      'phân thức', 'trùng phương', 'vẽ đồ thị', 'trục tọa độ', 'tiệm cận',
      'cực trị', 'đồng biến', 'nghịch biến', 'đối xứng'
    ],
    bang_bien_thien: [
      'bảng biến thiên', 'biến thiên', 'khảo sát', 'cực đại', 'cực tiểu',
      'giá trị lớn nhất', 'giá trị nhỏ nhất', 'đạo hàm', 'đơn điệu'
    ],
    truc_so: [
      'trục số', 'xét dấu', 'bất phương trình', 'nghiệm', 'khoảng',
      'miền nghiệm', 'hợp', 'giao', 'tập hợp nghiệm'
    ],
    bieu_do: [
      'biểu đồ', 'thống kê', 'cột', 'tròn', 'đường gấp khúc',
      'tần số', 'tần suất', 'phần trăm', 'histogram'
    ],
    khong_co_hinh: []
  };
  
  // Đếm số lượng keywords xuất hiện cho mỗi category
  const scores: Record<TikzCategory, number> = {
    hinh_phang: 0,
    hinh_khong_gian: 0,
    do_thi: 0,
    bang_bien_thien: 0,
    truc_so: 0,
    bieu_do: 0,
    khong_co_hinh: 0
  };
  
  for (const [category, keywordList] of Object.entries(keywords)) {
    for (const keyword of keywordList) {
      if (contentLower.includes(keyword)) {
        scores[category as TikzCategory]++;
      }
    }
  }
  
  // Tìm category có score cao nhất
  let maxScore = 0;
  let bestCategory: TikzCategory = 'khong_co_hinh';
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category as TikzCategory;
    }
  }
  
  return bestCategory;
};

/**
 * Lấy snippets TikZ phù hợp dựa trên category
 */
export const getTikzSnippets = (category: TikzCategory): string => {
  switch (category) {
    case 'hinh_phang':
      return getSnippetHinhPhang();
    case 'hinh_khong_gian':
      return getSnippetHinhKhongGian();
    case 'do_thi':
      return getSnippetDoThi();
    case 'bang_bien_thien':
      return getSnippetBangBienThien();
    case 'truc_so':
      return getSnippetTrucSo();
    case 'bieu_do':
      return getSnippetBieuDo();
    case 'khong_co_hinh':
    default:
      return '';
  }
};

/**
 * Lấy tất cả snippets (dùng khi không chắc chắn về category)
 */
export const getAllTikzSnippets = (): string => {
  return [
    getSnippetHinhPhang(),
    getSnippetHinhKhongGian(),
    getSnippetDoThi(),
    getSnippetBangBienThien(),
    getSnippetTrucSo(),
    getSnippetBieuDo()
  ].join('\n\n');
};

/**
 * Lấy dynamic snippets - phân tích và trả về snippets phù hợp
 */
export const getDynamicTikzSnippets = (
  categoryOrContent: TikzCategory | string,
  additionalContext?: string
): string => {
  let category: TikzCategory;
  
  // Nếu truyền vào string, phân tích để tìm category
  if (typeof categoryOrContent === 'string') {
    const analysisText = additionalContext 
      ? `${categoryOrContent} ${additionalContext}` 
      : categoryOrContent;
    category = analyzeProblemForTikz(analysisText);
  } else {
    category = categoryOrContent;
  }
  
  // Nếu không xác định được category, trả về tất cả
  if (category === 'khong_co_hinh') {
    return getAllTikzSnippets();
  }
  
  return getTikzSnippets(category);
};

/**
 * Tạo prompt với TikZ snippets
 */
export const createPromptWithTikz = (
  basePrompt: string,
  content: string
): string => {
  const category = analyzeProblemForTikz(content);
  const snippets = getTikzSnippets(category);
  
  if (!snippets) {
    return basePrompt;
  }
  
  return `${basePrompt}

%% =============== TikZ SNIPPETS THAM KHẢO ===============
%% Loại hình: ${category.toUpperCase().replace(/_/g, ' ')}
${snippets}

LƯU Ý VỀ TikZ:
- Chỉ sử dụng TikZ khi thực sự cần thiết (có hình vẽ trong đề)
- Chèn code TikZ ngay sau đề bài, trước phần lựa chọn
- Đảm bảo code TikZ hoàn chỉnh và có thể compile được
- Sử dụng các snippet trên làm tham khảo, điều chỉnh phù hợp với đề bài
`;
};

// ===== 📤 EXPORTS =====
export const tikzService = {
  analyzeProblemForTikz,
  getTikzSnippets,
  getAllTikzSnippets,
  getDynamicTikzSnippets,
  createPromptWithTikz
};

export default tikzService;
