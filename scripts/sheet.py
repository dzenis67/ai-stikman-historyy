# Contact sheet of stills: python3 scripts/sheet.py out/sheet.jpg file1 file2 ...
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
cols = 4; tw, th = 270, 480
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), (200, 60, 60))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw - 4, th))
    x, y = (i % cols) * tw + 2, (i // cols) * (th + 18)
    sheet.paste(im, (x, y + 18))
    # safe-area guides: top 8%, bottom 18%
    d.line([(x, y + 18 + int(th * 0.08)), (x + tw - 4, y + 18 + int(th * 0.08))], fill=(255, 140, 140))
    d.line([(x, y + 18 + int(th * 0.82)), (x + tw - 4, y + 18 + int(th * 0.82))], fill=(255, 140, 140))
    d.text((x + 4, y + 3), f.split('/')[-1], fill=(255, 255, 255))
sheet.save(out, quality=88)
