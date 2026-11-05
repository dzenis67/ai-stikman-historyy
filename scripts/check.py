# Flags stills where a picture reaches the top 8%, the bottom 18%, or the frame edge.
import sys, glob, numpy as np
from PIL import Image
for f in sorted(glob.glob('out/stills/*.jpg')):
    a = np.asarray(Image.open(f).convert('RGB')).astype(int)
    g = a.mean(2); sat = a.max(2) - a.min(2)
    m = (g < 200) & (sat < 40)          # ink/graphite, not the blue light
    rows = np.where(m.sum(1) > 3)[0]; cols = np.where(m.sum(0) > 3)[0]
    if len(rows) == 0: continue
    H, W = g.shape
    flags = []
    if rows.min() < 0.08 * H: flags.append('TOP')
    if rows.max() > 0.82 * H: flags.append('BOTTOM')
    if cols.min() < 4 or cols.max() > W - 5: flags.append('EDGE')
    if flags: print(f.split('/')[-1], rows.min(), rows.max(), cols.min(), cols.max(), flags)
print('checked')
