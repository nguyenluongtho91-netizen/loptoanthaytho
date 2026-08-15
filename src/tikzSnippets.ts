/**
 * TikZ Snippets Library - Comprehensive Collection
 */

export const SNIPPET_HINH_PHANG = `%% =============== HÌNH HỌC PHẲNG ===============
% -- Vẽ tam giác ABC
\\draw(A)--(B)--(C)--cycle;
\\draw (A)--(vuonggoc cs:from=A, on=B--C) coordinate(H);
\\coordinate(M) at ($(B)!0.5!(C)$); \\draw (A)--(M);
\\foreach \\i/\\g in {A/90,B/-90,C/-90,H/-90}{\\draw[fill=white](\\i) circle (1.5pt) ($( \\i )+(\\g:3mm)$) node[scale=1]{$\\i$};}

% -- Vẽ tam giác vuông tại C
\\draw (A)--(B)--(tamgiacvuong cs:on=A--B) coordinate(C)--cycle;

% -- Vẽ tam giác cân tại A
\\coordinate (A) at (0,5);
\\coordinate (B) at (-2,0);
\\coordinate (C) at (2,0);
\\path (A)--(B) node[midway,sloped,scale=0.5]{$|$};
\\path (A)--(C) node[midway,sloped,scale=0.5]{$|$};
\\draw(A)--(B)--(C)--cycle;

% -- Vẽ tam giác đều ABC
\\def\\canh{5}
\\coordinate (B) at (0,0);
\\coordinate (C) at (\\canh,0);
\\coordinate (A) at ($(B) + (60:\\canh)$);
\\draw(A)--(B)--(C)--cycle;
\\path (A)--(B) node[midway,sloped,scale=0.5]{$|$};
\\path (A)--(C) node[midway,sloped,scale=0.5]{$|$};
\\path (B)--(C) node[midway,sloped,scale=0.5]{$|$};

% -- Vẽ đường tròn nội tiếp tam giác ABC
\\inradius(A,B,C)(\\r)
\\incenter(A,B,C)(I)
\\draw (I) circle(\\r);

% -- Vẽ đường tròn ngoại tiếp tam giác ABC
\\circumcenter(A,B,C)(O)
\\circumradius(A,B,C)(\\R)
\\draw (O) circle(\\R);

% -- Vẽ hình vuông ABCD
\\def\\canh{4}
\\coordinate (A) at (0,\\canh);
\\coordinate (B) at (\\canh,\\canh);
\\coordinate (D) at (0,0);
\\coordinate (C) at ($(B)+(D)-(A)$);
\\draw(A)--(B)--(C)--(D)--cycle;

% -- Vẽ hình chữ nhật ABCD
\\coordinate (A) at (0,3);
\\coordinate (B) at (5,3);
\\coordinate (D) at (0,0);
\\coordinate (C) at ($(B)+(D)-(A)$);
\\draw(A)--(B)--(C)--(D)--cycle;

% -- Vẽ hình thoi ABCD
\\def\\canh{4}
\\coordinate (A) at (0,0);
\\coordinate (B) at ($(A)+(-65:\\canh)$);
\\coordinate (D) at ($(A)+(-115:\\canh)$);
\\coordinate (C) at ($(B)+(D)-(A)$);
\\draw(A)--(B)--(C)--(D)--cycle;

% -- Vẽ hình bình hành ABCD
\\coordinate (A) at (1,3);
\\coordinate (B) at (6,3);
\\coordinate (D) at (0,0);
\\coordinate (C) at ($(B)+(D)-(A)$);
\\draw(A)--(B)--(C)--(D)--cycle;

% -- Vẽ hình thang cân ABCD
\\coordinate (A) at (1,3);
\\coordinate (B) at (4,3);
\\coordinate (D) at (0,0);
\\coordinate (C) at (5,0);
\\draw(A)--(B)--(C)--(D)--cycle;

% -- BD là đường phân giác của góc ABC
\\bisectorpoint(A,B,C)(D)
\\draw (B)--(D);

% -- G là trọng tâm tam giác ABC
\\centroid(A,B,C)(G)

% -- H là trực tâm tam giác ABC
\\orthocenter(A,B,C)(H)

% -- Vẽ tiếp tuyến tại M thuộc đường tròn tâm A
\\coordinate (Tempt1) at ($(M)!1cm!90:(A)$);
\\coordinate (Tempt2) at ($(M)!0cm!-90:(A)$);
\\draw (Tempt1)--(Tempt2);

% -- Vẽ tiếp tuyến đường tròn tâm O bán kính 3cm từ M
\\tangentpoints(M,O,3cm)(A,B)

% -- Vẽ AB cắt CD tại O
\\coordinate (O) at (intersection of A--B and C--D);

% -- Đường thẳng d cắt đường tròn tâm O tại 2 điểm
\\interLC(A,B,O,3cm)(M,N)

% -- B là điểm đối xứng với A qua O
\\coordinate (B) at ($(O)!-1!(A)$);

% -- Từ M kẻ đường thẳng //CD cắt AB tại N
\\draw (M)--(songsong cs:from=M, to=C--D, on=A--B) coordinate(N);

% -- N là điểm đối xứng A qua M
\\draw (A)--(doixungtam cs:from=A,to=M) coordinate(N);`

export const SNIPPET_HINH_KHONG_GIAN = `%% =============== HÌNH KHÔNG GIAN ===============
% -- Vẽ hình chóp S.ABCD
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\coordinate[label=below left:$B$] (B) at (0,0);
  \\coordinate[label=above right:$A$] (A) at (1.5,1);
  \\coordinate[label=below:$C$] (C) at (4,0);
  \\coordinate[label=right:$D$] (D) at ($(C)-(B)+(A)$);
  \\coordinate[label=above:$S$] (S) at (2,4);
  \\draw (B)--(C)--(D)--(S)--cycle (S)--(C);
  \\draw[dashed] (C)--(A)--(D)--(B) (S)--(A);
  \\foreach \\diem in {A,B,C,D,S} \\fill (\\diem) circle(1pt);
\\end{tikzpicture}

% -- Vẽ hình chóp tam giác đều S.ABC
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\ac{4} \\def\\ab{2} \\def\\h{4} \\def\\gocA{50}
  \\coordinate[label=left:$A$] (A) at (0,0);
  \\coordinate[label=right:$C$] (C) at (\\ac,0);
  \\coordinate[label=below left:$B$] (B) at (-\\gocA:\\ab);
  \\coordinate (M) at ($(B)!.5!(C)$);
  \\coordinate[label=below right:$O$] (G) at ($(A)!2/3!(M)$);
  \\coordinate[label=above:$S$] (S) at ($(G)+(90:\\h)$);
  \\draw (A)--(B)--(C)--(S)--cycle (S)--(B);
  \\draw[dashed] (A)--(C) (S)--(G);
  \\foreach \\diem in {A,B,C,S,G} \\fill (\\diem) circle(1pt);
  \\foreach \\dau/\\cuoi in {S/A,S/B,S/C}
    \\path (\\dau)--(\\cuoi) node[midway,sloped]{$|$};
  \\foreach \\dau/\\cuoi in {A/B,C/B,A/C}
    \\path (\\dau)--(\\cuoi) node[midway,sloped]{$||$};
\\end{tikzpicture}

% -- Vẽ hình chóp tứ giác đều S.ABCD
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\bc{4} \\def\\ba{2} \\def\\h{4} \\def\\gocB{45}
  \\coordinate[label=below left:$B$] (B) at (0,0);
  \\coordinate[label=above right:$A$] (A) at (\\gocB:\\ba);
  \\coordinate[label=below:$C$] (C) at (\\bc,0);
  \\coordinate[label=right:$D$] (D) at ($(C)-(B)+(A)$);
  \\coordinate[label=below:$O$] (O) at ($(A)!.5!(C)$);
  \\coordinate[label=above:$S$] (S) at ($(O)+(90:\\h)$);
  \\draw (B)--(C)--(D)--(S)--cycle (S)--(C);
  \\draw[dashed] (C)--(A)--(D)--(B) (O)--(S)--(A)--(B);
  \\foreach \\diem in {A,B,C,D,S,O} \\fill (\\diem) circle(1pt);
  \\foreach \\dau/\\cuoi in {S/A,S/B,S/D,S/C}
    \\path (\\dau)--(\\cuoi) node[midway,sloped]{$|$};
  \\foreach \\dau/\\cuoi in {A/B,B/C,C/D,D/A}
    \\path (\\dau)--(\\cuoi) node[midway,sloped]{$||$};
\\end{tikzpicture}

% -- Vẽ hình nón
\\begin{tikzpicture}[line join=round, line cap=round, font=\\scriptsize]
  \\def\\a{2} \\def\\b{1} \\def\\h{4}
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
  \\def\\a{2} \\def\\b{1} \\def\\h{3}
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

% -- Vẽ hình hộp chữ nhật ABCD.MNPQ
\\begin{tikzpicture}[scale=1,font=\\footnotesize, join=round, line cap=round, >=stealth]
  \\path
    (-1,-1) coordinate(A)
    (0,0)   coordinate(B)
    (3,0)   coordinate(C)
    ($(A)+(C)-(B)$) coordinate(D)
    (0,2)   coordinate(N)
    ($(A)+(N)-(B)$) coordinate(M)
    ($(M)+(C)-(B)$) coordinate(Q)
    ($(N)+(Q)-(M)$) coordinate(P);
  \\draw (A)--(M)--(N)--(P)--(C)--(D)--cycle (M)--(Q)--(D) (Q)--(P);
  \\draw[dashed](A)--(B)--(C) (B)--(N);
  \\foreach \\x/\\g in {A/180,B/180,C/0,D/0,M/180,N/180,P/0,Q/0}
    \\fill[black](\\x) circle(1pt) ($( \\x )+(\\g:3mm)$) node{\\footnotesize $\\x$};
\\end{tikzpicture}

% -- Vẽ lăng trụ đứng tam giác ABC.A'B'C'
\\begin{tikzpicture}[scale=.7, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\a{3} \\def\\b{4} \\def\\c{5} \\def\\h{6}
  \\coordinate (A) at (0,0);
  \\coordinate (B) at (0:\\c);
  \\path [name path=c1] (A) circle(\\b);
  \\path [name path=c2] (B) circle(\\a);
  \\path [name intersections={of=c1 and c2,by={D,C}}];
  \\coordinate (A') at ($(A)+(90:\\h)$);
  \\coordinate (B') at ($(B)-(A)+(A')$);
  \\coordinate (C') at ($(C)-(A)+(A')$);
  \\draw (A')--(A)--(C)--(B)--(B')--(A')--(C')--(B') (C)--(C');
  \\draw[dashed] (A)--(B);
  \\foreach \\diem/\\g in {A/180,B/0,C/270,A'/90,B'/90,C'/90}
    \\fill (\\diem) circle(1.5pt) +(\\g:.3) node{$\\diem$};
\\end{tikzpicture}`

export const SNIPPET_DO_THI = `%% =============== ĐỒ THỊ HÀM SỐ ===============
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
  \\draw[dashed,thin](-1,0)--(-1,2)--(0,2);
  \\begin{scope}
    \\clip (-4,-4) rectangle (4,4);
    \\draw[samples=200, domain=-3:3, smooth, variable=\\x]
         plot (\\x, {(\\x)^2 + 2*(\\x) + 3});
  \\end{scope}
\\end{tikzpicture}

% -- Đồ thị hàm bậc ba y = x^3 + 3x^2 - 4
\\begin{tikzpicture}[line join=round, line cap=round, >=stealth, thin]
  \\tikzset{every node/.style={scale=0.9}}
  \\draw[->] (-4.1,0)--(4.1,0) node[below left] {$x$};
  \\draw[->] (0,-4.1)--(0,4.1) node[below left] {$y$};
  \\draw (0,0) node[below left] {$O$};
  \\foreach \\x/\\nx in {-4/-4, -3/-3, -2/-2, -1/-1, 1/1, 2/2, 3/3, 4/4}
    \\draw[thin] (\\x,1pt)--(\\x,-1pt) node[below] {$\\nx$};
  \\foreach \\y/\\ny in {-4/-4, -3/-3, -2/-2, -1/-1, 1/1, 2/2, 3/3, 4/4}
    \\draw[thin] (1pt,\\y)--(-1pt,\\y) node[left] {$\\ny$};
  \\begin{scope}
    \\clip (-4,-4) rectangle (4,4);
    \\draw[samples=200,domain=-3:3,smooth,variable=\\x]
         plot (\\x,{(\\x)^3 + 3*(\\x)^2 -4});
  \\end{scope}
\\end{tikzpicture}

% -- Đồ thị hàm phân thức y = (x+1)/(3x+2)
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\xmin{-4} \\def\\xmax{2} \\def\\ymin{-3} \\def\\ymax{3}
  \\draw[->] (\\xmin-0.2,0)--(\\xmax+0.2,0) node[below] {$x$};
  \\draw[->] (0,\\ymin-0.2)--(0,\\ymax+0.2) node[right] {$y$};
  \\draw (0,0) node [below left] {$O$};
  \\foreach \\x in {-4,-3,-2,-1,1,2}
    \\draw (\\x,0.1)--(\\x,-0.1) node[below] {\\x};
  \\foreach \\y in {-3,-2,-1,1,2,3}
    \\draw (0.1,\\y)--(-0.1,\\y) node[left] {\\y};
  \\clip (\\xmin,\\ymin) rectangle (\\xmax,\\ymax);
  \\draw[dashed] (\\xmin,0.33)--(\\xmax,0.33);
  \\draw[dashed] (-0.67,\\ymin)--(-0.67,\\ymax);
  \\draw[smooth,samples=200,domain=\\xmin:-0.77] plot (\\x,{(\\x+1)/(3*\\x+2)});
  \\draw[smooth,samples=200,domain=-0.57:\\xmax] plot (\\x,{(\\x+1)/(3*\\x+2)});
  \\draw (-0.67,-1pt)--(-0.67,1pt) node [below right] {$-\\frac{2}{3}$};
  \\draw (1pt,0.33)--(-1pt,0.33) node [right] {$\\frac{1}{3}$};
\\end{tikzpicture}

% -- Đồ thị hàm trùng phương y = x^4 - 2x^2 - 3
\\begin{tikzpicture}[scale=.7, >=stealth]
  \\def\\xmin{-3.15} \\def\\xmax{3.15} \\def\\ymin{-4} \\def\\ymax{4}
  \\draw[->] (\\xmin,0)--(\\xmax,0) node[right] {$x$};
  \\draw[->] (0,\\ymin)--(0,\\ymax) node[above] {$y$};
  \\draw (0,0) node[below right] {$O$};
  \\foreach \\x in {-3,-2,-1,1,2,3}
    \\draw (\\x,0.1)--(\\x,-0.1) node[below] {\\x};
  \\foreach \\y in {-4,-3,-2,-1,1,2,3,4}
    \\draw (0.1,\\y)--(-0.1,\\y) node[left] {\\y};
  \\draw[samples=200,domain=\\xmin:\\xmax,smooth,variable=\\x]
       plot(\\x,{(\\x)^4 -2*(\\x)^2 -3});
  \\draw[dashed] (-1,0)--(-1,-4)--(0,-4);
  \\draw[dashed] (1,0)--(1,-4);
  \\draw[dashed] (0,-3)--(\\xmax,-3);
\\end{tikzpicture}

% -- Đồ thị hàm phân thức y = (x^2+2x+5)/(x+1)
\\begin{tikzpicture}[scale=1, font=\\footnotesize, line join=round, line cap=round, >=stealth]
  \\def\\xmin{-5} \\def\\xmax{3} \\def\\ymin{-7} \\def\\ymax{7}
  \\draw[->] (\\xmin-0.2,0)--(\\xmax+0.2,0) node[below] {$x$};
  \\draw[->] (0,\\ymin-0.2)--(0,\\ymax+0.2) node[right] {$y$};
  \\draw (0,0) node [below left] {$O$};
  \\foreach \\x in {-5,-4,-3,-2,-1,1,2,3}
    \\draw (\\x,0.1)--(\\x,-0.1) node[below] {\\x};
  \\foreach \\y in {-7,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,7}
    \\draw (0.1,\\y)--(-0.1,\\y) node[left] {\\y};
  \\clip (\\xmin,\\ymin) rectangle (\\xmax,\\ymax);
  \\draw[dashed] (-1,\\ymin)--(-1,\\ymax);
  \\draw[dashed,domain=\\xmin:\\xmax] plot(\\x,{(\\x)+1});
  \\draw[smooth,samples=200,domain=\\xmin:-1.1] 
       plot(\\x, {( (\\x)^2 + 2*\\x + 5 )/( \\x +1 )} );
  \\draw[smooth,samples=200,domain=-0.9:\\xmax]
       plot(\\x, {( (\\x)^2 + 2*\\x + 5 )/( \\x +1 )} );
  \\draw[dashed] (-3,0)--(-3,-4)--(0,-4);
  \\fill (-3,-4) circle(1pt);
  \\draw[dashed] (1,0)--(1,4)--(0,4);
  \\fill (1,4) circle(1pt);
\\end{tikzpicture}`

export const SNIPPET_BANG_BIEN_THIEN = `%% =============== BẢNG BIẾN THIÊN ===============
% -- Bảng biến thiên hàm bậc hai y = x^2 + 2x + 3
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.5,espcl=5,deltacl=0.6]
     {$x$/0.7,$y'$/0.7,$y$/2}{$-\\infty$,$-1$,$+\\infty$}
  \\tkzTabLine{,-,0,+,}
  \\tkzTabVar{+/$+\\infty$,-/$2$,+/$+\\infty$} 
\\end{tikzpicture}

% -- Bảng biến thiên hàm bậc ba y = x^3 + 3x^2 - 2
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.5,espcl=2.5,deltacl=0.7]
     {$x$/0.6,$y'$/0.6,$y$/2}
     {$-\\infty$,$-2$,$0$,$+\\infty$}
  \\tkzTabLine{,+,0,-,0,+,}
  \\tkzTabVar{-/$-\\infty$,+/$2$,-/$-2$,+/$+\\infty$}
\\end{tikzpicture}

% -- Bảng biến thiên hàm phân thức y = (x+1)/(3x+2)
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.2,espcl=2.5,deltacl=0.6]
     {$x$/0.6,$y'$/0.6,$y$/2}
     {$-\\infty$,$-\\frac{2}{3}$,$+\\infty$}
  \\tkzTabLine{,-,d,-,}
  \\tkzTabVar{+/$\\frac{1}{3}$,-D+/$-\\infty$/$+\\infty$,-/$\\frac{1}{3}$}
\\end{tikzpicture}

% -- Bảng biến thiên hàm trùng phương y = x^4 - 2x^2 - 3
\\begin{tikzpicture}
  \\tkzTabInit[espcl=3,lgt=1.5,nocadre]
     {$x$/0.6,$y'$/0.6,$y$/2}
     {$-\\infty$,$-1$,0,$1$,$+\\infty$}
  \\tkzTabLine{,-,0,+,0,-,0,+}
  \\tkzTabVar{+/$+\\infty$,-/$-4$,+/$-3$,-/$-4$,+/$+\\infty$}
\\end{tikzpicture}

% -- Bảng biến thiên hàm phân thức y = (x^2 + 2x + 5)/(x+1)
\\begin{tikzpicture}
  \\tkzTabInit[nocadre,lgt=1.2,espcl=2.5,deltacl=0.6]
     {$x$/0.6,$y'$/0.6,$y$/2}
     {$-\\infty$,$-3$,$-1$,$1$,$+\\infty$}
  \\tkzTabLine{,+,0,-,d,-,0,+,}
  \\tkzTabVar{-/$-\\infty$,+/$-4$,-D+/$-\\infty$/$+\\infty$,-/$4$,+/$+\\infty$}
\\end{tikzpicture}`

export const SNIPPET_TRUC_SO = `%% =============== TRỤC SỐ / XÉT DẤU ===============
% -- Vẽ trục số tô đoạn (a, b]
\\begin{tikzpicture}[line join=round, line cap=round, >=stealth, thick]
  \\fill[pattern=north east lines](-4,-0.15) rectangle (-1.5,0.15);
  \\draw[->] (-4,0)--(4,0);
  \\draw (-1.5,0) node {$\\big($} (-1.5,0) node[below=6pt] {$a$};
  \\draw (0.75,0) node {$\\big]$} (0.75,0) node[below=6pt] {$b$};
\\end{tikzpicture}`

export const SNIPPET_BIEU_DO = `%% =============== BIỂU ĐỒ THỐNG KÊ ===============
% -- Biểu đồ cột
\\begin{tikzpicture}[scale=.5,font=\\scriptsize]
  \\draw[->] (0,0)--(16,0) node[below]{$x$};
  \\draw[->] (0,0)--(0,5.5) node[left]{$n$};
  \\foreach \\x/\\n[count=\\i from 1] in {10/3,12/4,15/5}{
    \\draw[line width=4mm,magenta] (\\i,0) node[below, black]{$\\x$} --++(0,\\n);
    \\draw[dashed] (\\i,\\n)--(0,\\n) node[left]{$\\n$};
  }
\\end{tikzpicture}

% -- Biểu đồ tròn
\\begin{tikzpicture}
  \\def\\r{2} \\def\\gocxp{90}
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
\\end{tikzpicture}`

export function getTikzSnippetsForTopic(topic: string): string {
  const queryLower = topic.toLowerCase()
  let snippets = []

  if (/hình học|tam giác|tứ giác|đường tròn|vuông|chữ nhật|thoi|bình hành/.test(queryLower)) {
    snippets.push(SNIPPET_HINH_PHANG)
  }

  if (/không gian|hình chóp|lăng trụ|nón|trụ|cầu|hộp/.test(queryLower)) {
    snippets.push(SNIPPET_HINH_KHONG_GIAN)
  }

  if (/đồ thị|hàm số|tương giao|bậc|phân thức|parabol/.test(queryLower)) {
    snippets.push(SNIPPET_DO_THI)
  }

  if (/biến thiên|cực trị|đơn điệu|đạo hàm/.test(queryLower)) {
    snippets.push(SNIPPET_BANG_BIEN_THIEN)
  }

  if (/trục số|xét dấu|nghiệm|khoảng/.test(queryLower)) {
    snippets.push(SNIPPET_TRUC_SO)
  }

  if (/biểu đồ|thống kê|cột|tròn/.test(queryLower)) {
    snippets.push(SNIPPET_BIEU_DO)
  }

  if (snippets.length === 0) {
    snippets = [SNIPPET_HINH_PHANG, SNIPPET_DO_THI, SNIPPET_BANG_BIEN_THIEN]
  }

  return snippets.join('\n\n')
}
// ✅ THÊM HÀM MỚI - Export tất cả snippets
export function getAllTikzSnippets(): string {
  return [
    SNIPPET_HINH_PHANG,
    SNIPPET_HINH_KHONG_GIAN,
    SNIPPET_DO_THI,
    SNIPPET_BANG_BIEN_THIEN,
    SNIPPET_TRUC_SO,
    SNIPPET_BIEU_DO
  ].join('\n\n')
}
