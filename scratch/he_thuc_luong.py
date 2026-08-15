from manim import *

class HeThucLuong(Scene):
    def construct(self):
        # Configure background color
        self.camera.background_color = "#111116"

        # ----------------------------------------------------
        # 1. INTRO
        # ----------------------------------------------------
        title = Text("HỆ THỨC LƯỢNG TRONG TAM GIÁC VUÔNG", font_size=36, color="#00ADB5")
        subtitle = Text("Định lý và hệ thức toán học lớp 9", font_size=22, color="#8697C4")
        title_group = VGroup(title, subtitle).arrange(DOWN, buff=0.4)
        
        self.play(Write(title))
        self.play(FadeIn(subtitle, shift=UP * 0.3))
        self.wait(2)
        self.play(FadeOut(title_group, shift=DOWN * 0.3))
        self.wait(0.5)

        # ----------------------------------------------------
        # 2. DRAW TRIANGLE AND SET LABELS
        # ----------------------------------------------------
        # Define vertices
        A = np.array([-3.5, 1.5, 0])
        B = np.array([-5.0, -1.5, 0])
        C = np.array([2.5, -1.5, 0])
        H = np.array([-3.5, -1.5, 0])

        # Draw lines of the triangle
        line_ab = Line(A, B, color="#FFFFFF", stroke_width=3)
        line_ac = Line(A, C, color="#FFFFFF", stroke_width=3)
        line_bc = Line(B, C, color="#FFFFFF", stroke_width=3)
        line_ah = Line(A, H, color="#FFD166", stroke_width=3) # Gold color for altitude

        # Right angles
        right_angle_A = RightAngle(line_ab, line_ac, length=0.3, color="#FF2E63", quadrant=(-1,-1))
        right_angle_H = RightAngle(line_ah, line_bc, length=0.3, color="#FFD166", quadrant=(1,1))

        # Vertex labels
        label_A = Tex("A", color="#FFFFFF").next_to(A, UP, buff=0.2)
        label_B = Tex("B", color="#FFFFFF").next_to(B, DOWN + LEFT, buff=0.1)
        label_C = Tex("C", color="#FFFFFF").next_to(C, DOWN + RIGHT, buff=0.1)
        label_H = Tex("H", color="#FFD166").next_to(H, DOWN, buff=0.2)

        # First, show the main triangle ABC
        self.play(
            Create(line_ab),
            Create(line_ac),
            Create(line_bc),
            run_time=2
        )
        self.play(
            Write(label_A),
            Write(label_B),
            Write(label_C),
            Create(right_angle_A),
            run_time=1
        )
        self.wait(1)

        # Show the altitude AH and H
        self.play(
            Create(line_ah),
            Write(label_H),
            Create(right_angle_H),
            run_time=1.5
        )
        self.wait(1)

        # ----------------------------------------------------
        # SIDE LENGTH LABELS (INTRODUCE SYMBOLS)
        # ----------------------------------------------------
        label_b = MathTex("b", color="#06D6A0").next_to(line_ac, UP + RIGHT, buff=-0.5)
        label_c = MathTex("c", color="#FF5A5F").next_to(line_ab, UP + LEFT, buff=-0.5)
        label_a = MathTex("a", color="#3F72AF").next_to(line_bc, DOWN, buff=0.6)
        label_h = MathTex("h", color="#FFD166").next_to(line_ah, RIGHT, buff=0.15)
        
        label_c_prime = MathTex("c'", color="#8338EC").next_to(Line(B, H), DOWN, buff=0.15)
        label_b_prime = MathTex("b'", color="#00ADB5").next_to(Line(H, C), DOWN, buff=0.15)

        # Display all length symbols
        self.play(
            FadeIn(label_b),
            FadeIn(label_c),
            FadeIn(label_a),
            FadeIn(label_h),
            FadeIn(label_c_prime),
            FadeIn(label_b_prime),
            run_time=2
        )
        self.wait(3.5)

        # Fade out length labels to keep geometry clean for theorems
        self.play(
            FadeOut(label_b),
            FadeOut(label_c),
            FadeOut(label_a),
            FadeOut(label_h),
            FadeOut(label_c_prime),
            FadeOut(label_b_prime),
            run_time=1
        )
        self.wait(0.5)

        # ----------------------------------------------------
        # 3. SET UP RIGHT SIDE PANEL (SUMMARY LIST)
        # ----------------------------------------------------
        panel_title = Text("5 HỆ THỨC LƯỢNG CƠ BẢN", font_size=22, color="#00ADB5")
        panel_title.move_to(np.array([3.5, 3.1, 0]))
        self.play(Write(panel_title))
        self.wait(0.5)

        # Slots for 5 formulas
        slots = [
            np.array([3.5, 2.4, 0]),
            np.array([3.5, 1.7, 0]),
            np.array([3.5, 1.0, 0]),
            np.array([3.5, 0.3, 0]),
            np.array([3.5, -0.4, 0])
        ]

        # Active box for explanations at the bottom right
        box_center = np.array([3.5, -2.0, 0])
        explanation_box = RoundedRectangle(
            width=5.8, height=2.2, corner_radius=0.15,
            color="#00ADB5", fill_opacity=0.05, stroke_width=1.5
        ).move_to(box_center)
        self.play(FadeIn(explanation_box))

        # Color definitions for states
        COLOR_ACTIVE = "#00ADB5"
        COLOR_INACTIVE = "#888888"

        # ----------------------------------------------------
        # THEOREM 1: b^2 = a * b' and c^2 = a * c'
        # ----------------------------------------------------
        t1_formula = MathTex(
            "1. \\quad b^2 = a \\cdot b' \\quad \\text{và} \\quad c^2 = a \\cdot c'",
            color=COLOR_ACTIVE, font_size=24
        ).move_to(slots[0])

        t1_explanation = Paragraph(
            "Hệ thức 1: Cạnh góc vuông và hình chiếu",
            "Bình phương mỗi cạnh góc vuông bằng",
            "tích của cạnh huyền và hình chiếu",
            "của cạnh đó trên cạnh huyền.",
            font_size=15, line_spacing=0.6, alignment="center"
        ).move_to(box_center)
        t1_explanation[0].set_color(COLOR_ACTIVE)

        self.play(
            Write(t1_formula),
            Write(t1_explanation),
            run_time=1.5
        )

        # Highlights
        hl_ac = Line(A, C, color="#06D6A0", stroke_width=6)
        hl_bc = Line(B, C, color="#3F72AF", stroke_width=6)
        hl_hc = Line(H, C, color="#00ADB5", stroke_width=6)
        hl_ab = Line(A, B, color="#FF5A5F", stroke_width=6)
        hl_hb = Line(H, B, color="#8338EC", stroke_width=6)

        # Animate first sub-relation (b^2 = a * b')
        self.play(Create(hl_ac), Create(hl_bc), Create(hl_hc), run_time=1.5)
        self.wait(1.5)
        self.play(FadeOut(hl_ac), FadeOut(hl_hc))
        
        # Animate second sub-relation (c^2 = a * c')
        self.play(Create(hl_ab), Create(hl_hb), run_time=1.5)
        self.wait(2)
        self.play(FadeOut(hl_ab), FadeOut(hl_hb), FadeOut(hl_bc))

        # Transition to inactive state
        self.play(
            t1_formula.animate.set_color(COLOR_INACTIVE),
            FadeOut(t1_explanation),
            run_time=0.8
        )

        # ----------------------------------------------------
        # THEOREM 2: h^2 = b' * c'
        # ----------------------------------------------------
        t2_formula = MathTex(
            "2. \\quad h^2 = b' \\cdot c'",
            color=COLOR_ACTIVE, font_size=24
        ).move_to(slots[1])

        t2_explanation = Paragraph(
            "Hệ thức 2: Đường cao và hai hình chiếu",
            "Bình phương đường cao ứng với cạnh huyền",
            "bằng tích hai hình chiếu của hai cạnh",
            "góc vuông trên cạnh huyền.",
            font_size=15, line_spacing=0.6, alignment="center"
        ).move_to(box_center)
        t2_explanation[0].set_color(COLOR_ACTIVE)

        self.play(
            Write(t2_formula),
            Write(t2_explanation),
            run_time=1.5
        )

        # Highlights
        hl_ah = Line(A, H, color="#FFD166", stroke_width=6)
        hl_hb = Line(H, B, color="#8338EC", stroke_width=6)
        hl_hc = Line(H, C, color="#00ADB5", stroke_width=6)

        self.play(Create(hl_ah), Create(hl_hb), Create(hl_hc), run_time=1.5)
        self.wait(3.5)
        self.play(FadeOut(hl_ah), FadeOut(hl_hb), FadeOut(hl_hc))

        self.play(
            t2_formula.animate.set_color(COLOR_INACTIVE),
            FadeOut(t2_explanation),
            run_time=0.8
        )

        # ----------------------------------------------------
        # THEOREM 3: b * c = a * h
        # ----------------------------------------------------
        t3_formula = MathTex(
            "3. \\quad b \\cdot c = a \\cdot h",
            color=COLOR_ACTIVE, font_size=24
        ).move_to(slots[2])

        t3_explanation = Paragraph(
            "Hệ thức 3: Tích hai cạnh góc vuông",
            "Tích hai cạnh góc vuông bằng tích của",
            "cạnh huyền và đường cao tương ứng.",
            font_size=15, line_spacing=0.6, alignment="center"
        ).move_to(box_center)
        t3_explanation[0].set_color(COLOR_ACTIVE)

        self.play(
            Write(t3_formula),
            Write(t3_explanation),
            run_time=1.5
        )

        # Highlights
        hl_ab = Line(A, B, color="#FF5A5F", stroke_width=6)
        hl_ac = Line(A, C, color="#06D6A0", stroke_width=6)
        hl_bc = Line(B, C, color="#3F72AF", stroke_width=6)
        hl_ah = Line(A, H, color="#FFD166", stroke_width=6)

        self.play(Create(hl_ab), Create(hl_ac), Create(hl_bc), Create(hl_ah), run_time=1.5)
        self.wait(3.5)
        self.play(FadeOut(hl_ab), FadeOut(hl_ac), FadeOut(hl_bc), FadeOut(hl_ah))

        self.play(
            t3_formula.animate.set_color(COLOR_INACTIVE),
            FadeOut(t3_explanation),
            run_time=0.8
        )

        # ----------------------------------------------------
        # THEOREM 4: 1/h^2 = 1/b^2 + 1/c^2
        # ----------------------------------------------------
        t4_formula = MathTex(
            "4. \\quad \\frac{1}{h^2} = \\frac{1}{b^2} + \\frac{1}{c^2}",
            color=COLOR_ACTIVE, font_size=24
        ).move_to(slots[3])

        t4_explanation = Paragraph(
            "Hệ thức 4: Nghịch đảo bình phương đường cao",
            "Nghịch đảo bình phương đường cao ứng với cạnh huyền",
            "bằng tổng các nghịch đảo bình phương của",
            "hai cạnh góc vuông.",
            font_size=15, line_spacing=0.6, alignment="center"
        ).move_to(box_center)
        t4_explanation[0].set_color(COLOR_ACTIVE)

        self.play(
            Write(t4_formula),
            Write(t4_explanation),
            run_time=1.5
        )

        # Highlights
        hl_ah = Line(A, H, color="#FFD166", stroke_width=6)
        hl_ab = Line(A, B, color="#FF5A5F", stroke_width=6)
        hl_ac = Line(A, C, color="#06D6A0", stroke_width=6)

        self.play(Create(hl_ah), Create(hl_ab), Create(hl_ac), run_time=1.5)
        self.wait(3.5)
        self.play(FadeOut(hl_ah), FadeOut(hl_ab), FadeOut(hl_ac))

        self.play(
            t4_formula.animate.set_color(COLOR_INACTIVE),
            FadeOut(t4_explanation),
            run_time=0.8
        )

        # ----------------------------------------------------
        # THEOREM 5: a^2 = b^2 + c^2 (Pythagore)
        # ----------------------------------------------------
        t5_formula = MathTex(
            "5. \\quad a^2 = b^2 + c^2",
            color=COLOR_ACTIVE, font_size=24
        ).move_to(slots[4])

        t5_explanation = Paragraph(
            "Hệ thức 5: Định lý Pythagore",
            "Bình phương của cạnh huyền bằng tổng",
            "các bình phương của hai cạnh góc vuông.",
            font_size=15, line_spacing=0.6, alignment="center"
        ).move_to(box_center)
        t5_explanation[0].set_color(COLOR_ACTIVE)

        self.play(
            Write(t5_formula),
            Write(t5_explanation),
            run_time=1.5
        )

        # Highlights
        hl_bc = Line(B, C, color="#3F72AF", stroke_width=6)
        hl_ab = Line(A, B, color="#FF5A5F", stroke_width=6)
        hl_ac = Line(A, C, color="#06D6A0", stroke_width=6)

        self.play(Create(hl_bc), Create(hl_ab), Create(hl_ac), run_time=1.5)
        self.wait(3.5)
        self.play(FadeOut(hl_bc), FadeOut(hl_ab), FadeOut(hl_ac))

        self.play(
            t5_formula.animate.set_color(COLOR_INACTIVE),
            FadeOut(t5_explanation),
            FadeOut(explanation_box),
            run_time=0.8
        )
        self.wait(0.5)

        # ----------------------------------------------------
        # 4. CONCLUSION & FINAL SHINE
        # ----------------------------------------------------
        # Highlight all formulas back to bright teal
        all_formulas = VGroup(
            t1_formula,
            t2_formula,
            t3_formula,
            t4_formula,
            t5_formula
        )
        
        self.play(
            all_formulas.animate.set_color("#00ADB5"),
            run_time=1.2
        )
        
        # Show all labels b, c, a, h, b', c' on the triangle one last time
        self.play(
            FadeIn(label_b),
            FadeIn(label_c),
            FadeIn(label_a),
            FadeIn(label_h),
            FadeIn(label_c_prime),
            FadeIn(label_b_prime),
            run_time=1.5
        )
        self.wait(5.0)

        # Fade out everything
        self.play(
            FadeOut(all_formulas),
            FadeOut(panel_title),
            FadeOut(line_ab),
            FadeOut(line_ac),
            FadeOut(line_bc),
            FadeOut(line_ah),
            FadeOut(right_angle_A),
            FadeOut(right_angle_H),
            FadeOut(label_A),
            FadeOut(label_B),
            FadeOut(label_C),
            FadeOut(label_H),
            FadeOut(label_b),
            FadeOut(label_c),
            FadeOut(label_a),
            FadeOut(label_h),
            FadeOut(label_c_prime),
            FadeOut(label_b_prime),
            run_time=2
        )
        self.wait(1)
