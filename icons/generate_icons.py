"""生成扩展图标 PNG"""
from PIL import Image, ImageDraw

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    m = size / 128  # scale factor

    # 圆角背景
    r = int(24 * m)
    draw.rounded_rectangle([(0, 0), (size, size)], radius=r, fill=(99, 102, 241, 255))

    # 对话气泡
    bx, by, bw, bh = int(24*m), int(28*m), int(80*m), int(52*m)
    draw.rounded_rectangle([(bx, by), (bx+bw, by+bh)], radius=int(12*m), fill=(255,255,255,242))
    # 气泡三角
    draw.polygon([
        (int(36*m), int(80*m)),
        (int(30*m), int(96*m)),
        (int(48*m), int(80*m)),
    ], fill=(255,255,255,242))

    # 时间轴竖线
    lx = int(96 * m)
    draw.line([(lx, int(28*m)), (lx, int(80*m))], fill=(99,102,241), width=max(2, int(3*m)))

    # 三个色点
    for i, color in enumerate([(254, 240, 138), (191, 219, 254), (187, 247, 208)]):
        cy = int((42 + i*14) * m)
        cr = int(5 * m)
        draw.ellipse([(lx-cr, cy-cr), (lx+cr, cy+cr)], fill=color, outline=(99,102,241), width=max(1, int(1.5*m)))

    # 笔 (倾斜线)
    draw.line([(int(50*m), int(50*m)), (int(68*m), int(32*m))], fill=(99,102,241), width=max(2, int(3*m)))
    draw.line([(int(52*m), int(48*m)), (int(64*m), int(36*m))], fill=(254,240,138), width=max(1, int(2*m)))

    return img

for s in [16, 48, 128]:
    img = create_icon(s)
    img.save(f'icon{s}.png')

print("Icons generated: icon16.png, icon48.png, icon128.png")
