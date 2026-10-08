"""Контактный лист всех рыб для быстрой проверки глазами."""
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from fish_data import FISH

W, cols = 200, 8
rows = (len(FISH) + cols - 1) // cols
sheet = Image.new('RGBA', (W * cols, W * rows), (235, 225, 215, 255))
for i, p in enumerate(FISH):
    im = Image.open(os.path.join(here, '..', 'assets', 'fish', p['id'] + '.png')).resize((W, W))
    sheet.alpha_composite(im, ((i % cols) * W, (i // cols) * W))
sheet.convert('RGB').save(os.path.join(here, 'out', 'sheet_all.png'))
print('ok')
