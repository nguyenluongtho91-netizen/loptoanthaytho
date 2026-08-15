from manim import *

class TestScene(Scene):
    def construct(self):
        A = np.array([-3.5, 1.5, 0])
        B = np.array([-5.0, -1.5, 0])
        C = np.array([2.5, -1.5, 0])
        H = np.array([-3.5, -1.5, 0])
        
        line_ab = Line(A, B)
        line_ac = Line(A, C)
        line_bc = Line(B, C)
        line_ah = Line(A, H)
        
        ra_A = RightAngle(line_ab, line_ac, length=0.3, color=RED)
        ra_H = RightAngle(line_ah, line_bc, length=0.3, color=YELLOW)
        
        self.add(line_ab, line_ac, line_bc, line_ah, ra_A, ra_H)
        self.wait(1)
