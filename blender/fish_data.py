"""40 рыб игры «Улов». Один источник данных для рендера в Blender и для приложения."""


def hx(h):
    """#rrggbb (sRGB) -> линейные цвета для Blender"""
    h = h.lstrip('#')
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b))


RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
PLACES = ['pier', 'bay', 'sea', 'trench']

_C, _U, _R, _E, _L = RARITIES


def F(id, ru, rar, place, kg, ppk, arch='std', **kw):
    d = dict(id=id, ru=ru, rarity=rar, place=place, kg=kg, ppk=ppk, arch=arch)
    d.update(kw)
    return d


FISH = [
    # ---------- ПИРС ----------
    F('roach', 'Плотва', _C, 'pier', (0.1, 1.2), 12, base='#8fb0c8', belly='#eef3f6', fin='#e2603f',
      L=1.0, W=0.26, H=0.42, tail='fork', dorsal='single'),
    F('perch', 'Окунь', _C, 'pier', (0.1, 1.5), 14, base='#6f9248', belly='#efe6a6', fin='#e4663a',
      stripe='#2f4a2a', stripe_n=6, L=1.0, W=0.28, H=0.46, tail='fan', dorsal='twin'),
    F('bleak', 'Уклейка', _C, 'pier', (0.03, 0.2), 15, base='#b9cfdc', belly='#ffffff', fin='#d9e4ea',
      L=1.1, W=0.18, H=0.28, tail='fork', dorsal='single', dorsal_h=0.2),
    F('crucian', 'Карась', _C, 'pier', (0.2, 2.0), 14, base='#c99b4a', belly='#ecd89e', fin='#b86a3a',
      L=0.95, W=0.3, H=0.58, tail='fan', dorsal='long'),
    F('gudgeon', 'Пескарь', _C, 'pier', (0.03, 0.25), 18, base='#8d7e58', belly='#e6dcbc', fin='#b9a77a',
      spot='#4d3f27', spot_n=9, L=1.0, W=0.22, H=0.3, tail='fan', dorsal='single', dorsal_h=0.22),
    F('bream', 'Лещ', _U, 'pier', (0.4, 5.0), 22, base='#b3a982', belly='#e9e2c4', fin='#6f6a60',
      L=0.9, W=0.26, H=0.82, tail='fork', dorsal='single', dorsal_h=0.3),
    F('tench', 'Линь', _U, 'pier', (0.4, 4.0), 28, base='#617f40', belly='#bbb15f', fin='#3f5a2c',
      L=1.0, W=0.34, H=0.5, tail='round', dorsal='single', dorsal_h=0.22, eye_color='#e8742a'),
    F('ide', 'Язь', _U, 'pier', (0.3, 3.5), 26, base='#cfa94d', belly='#f0e2ad', fin='#d4452f',
      L=1.05, W=0.28, H=0.48, tail='fork', dorsal='single'),
    F('burbot', 'Налим', _R, 'pier', (0.5, 6.0), 60, base='#6e5d3b', belly='#d9cfa6', fin='#4d3f27',
      spot='#34291a', spot_n=6, L=1.5, W=0.3, H=0.34, tail='round', dorsal='long', dorsal_h=0.16,
      whiskers=1),
    F('goldcarp', 'Золотой карп', _R, 'pier', (1.0, 9.0), 90, base='#f3b833', belly='#fde7a0', fin='#f08a2a',
      glow='#ffcf4a', glow_s=0.18, L=1.05, W=0.34, H=0.6, tail='fan', dorsal='long', dorsal_h=0.34),
    # ---------- ЗАЛИВ ----------
    F('anchovy', 'Хамса', _C, 'bay', (0.01, 0.1), 60, base='#7fa9cc', belly='#f3f7fa', fin='#c8dbe8',
      L=1.1, W=0.17, H=0.24, tail='fork', dorsal='single', dorsal_h=0.16),
    F('mullet', 'Кефаль', _C, 'bay', (0.2, 2.5), 40, base='#b9c6cf', belly='#f2f5f7', fin='#98a8b3',
      stripe='#6e7f8b', stripe_n=7, stripe_axis='Z', L=1.15, W=0.26, H=0.36, tail='fork', dorsal='twin'),
    F('flounder', 'Камбала', _U, 'bay', (0.3, 3.0), 40, 'flat', base='#a07d52', belly='#cbb08a', fin='#8a6a44',
      spot='#5f4328', spot_n=7, L=1.0, W=0.13, H=0.7, tail='round', tail_size=0.35, dorsal=None),
    F('mackerel', 'Скумбрия', _U, 'bay', (0.2, 2.0), 55, base='#2f8294', belly='#e8f1f2', fin='#2a6e80',
      stripe='#0f3f4c', stripe_n=10, L=1.2, W=0.27, H=0.38, tail='fork', dorsal='twin', dorsal_h=0.2),
    F('goby', 'Бычок', _U, 'bay', (0.05, 0.5), 90, base='#80704f', belly='#d8caa4', fin='#5e5038',
      spot='#3b2f1c', spot_n=8, L=0.95, W=0.34, H=0.4, tail='round', dorsal='long', dorsal_h=0.2, big_head=1),
    F('seabass', 'Сибас', _R, 'bay', (0.5, 6.0), 120, base='#a8b8c6', belly='#f3f6f8', fin='#7d95ab',
      L=1.2, W=0.3, H=0.46, tail='fork', dorsal='twin', dorsal_h=0.22),
    F('mullet_red', 'Барабулька', _R, 'bay', (0.15, 1.0), 280, base='#e5776a', belly='#f9d6c8', fin='#f2c24a',
      L=1.0, W=0.28, H=0.44, tail='fork', dorsal='twin', whiskers=1),
    F('scorpion', 'Морской ёрш', _R, 'bay', (0.3, 3.0), 160, base='#c9502f', belly='#e8a07a', fin='#a63c22',
      spot='#7a2a1a', spot_n=8, L=0.9, W=0.36, H=0.52, tail='fan', dorsal='sail', dorsal_h=0.38,
      big_head=1, spikes=1),
    F('twilightkoi', 'Сумеречный кои', _E, 'bay', (1.5, 9.0), 210, base='#8f6fd6', belly='#e1d4ff', fin='#c6a8ff',
      spot='#ffffff', spot_n=3.2, glow='#9b6bff', glow_s=0.35, L=1.15, W=0.36, H=0.55, tail='fan', tail_size=0.65,
      dorsal='long', dorsal_h=0.3, whiskers=1),
    F('stingray', 'Скат-хвостокол', _E, 'bay', (2.0, 30.0), 90, 'ray', base='#6f8398', belly='#dfe7ee', fin='#58697a',
      spot='#c9d7e3', spot_n=6, L=1.0, W=0.14, H=0.95, tail='none', dorsal=None),
    # ---------- ОТКРЫТОЕ МОРЕ ----------
    F('herring', 'Сельдь', _U, 'sea', (0.1, 0.8), 70, base='#6d98bd', belly='#eef4f8', fin='#9fbad0',
      L=1.1, W=0.2, H=0.3, tail='fork', dorsal='single', dorsal_h=0.18),
    F('sardine', 'Сардина', _U, 'sea', (0.05, 0.4), 90, base='#5d8fb2', belly='#f2f7fa', fin='#a6c2d6',
      spot='#1f3f56', spot_n=11, L=1.05, W=0.2, H=0.28, tail='fork', dorsal='single', dorsal_h=0.16),
    F('tuna', 'Тунец', _R, 'sea', (8.0, 80.0), 45, base='#2a4d86', belly='#e1e8f0', fin='#f2c230',
      L=1.35, W=0.42, H=0.5, tail='lunate', tail_size=0.7, dorsal='twin', dorsal_h=0.22, finlets=1),
    F('barracuda', 'Барракуда', _R, 'sea', (2.0, 25.0), 70, base='#b0bac2', belly='#f1f4f6', fin='#7c8a94',
      stripe='#59656e', stripe_n=9, L=1.9, W=0.22, H=0.28, tail='fork', dorsal='single', dorsal_h=0.15,
      teeth=1, big_head=1),
    F('mahi', 'Махи-махи', _R, 'sea', (3.0, 30.0), 80, base='#2fb36a', belly='#f6d84a', fin='#2fb3a6',
      spot='#2f7fd1', spot_n=8, L=1.3, W=0.3, H=0.55, tail='lunate', tail_size=0.6, dorsal='sail', dorsal_h=0.3),
    F('swordfish', 'Рыба-меч', _E, 'sea', (30.0, 250.0), 30, base='#3b5f8d', belly='#dce6f0', fin='#2a4468',
      L=1.5, W=0.4, H=0.5, tail='lunate', tail_size=0.7, dorsal='single', dorsal_h=0.38, bill=1.1),
    F('moray', 'Мурена', _E, 'sea', (1.0, 12.0), 300, 'eel', base='#8c8d3d', belly='#d5d38a', fin='#7a7b30',
      spot='#3f4015', spot_n=9, L=2.0, W=0.25, H=0.25, bend=0.3, dorsal='ridge', mouth=1),
    F('catshark', 'Катран', _E, 'sea', (5.0, 40.0), 160, 'shark', base='#7d8e9d', belly='#f1f4f6', fin='#5e707f',
      L=1.5, W=0.36, H=0.42, tail='lunate', tail_size=0.65, dorsal='single', dorsal_h=0.4, spot='#47566a', spot_n=9),
    F('sailfish', 'Рыба-парусник', _L, 'sea', (20.0, 90.0), 150, base='#2166d8', belly='#dce8f8', fin='#2d86f0',
      spot='#0c2f78', spot_n=7, glow='#3a8bff', glow_s=0.3, L=1.5, W=0.34, H=0.46, tail='lunate', tail_size=0.7,
      dorsal='sail', dorsal_h=0.95, bill=0.8),
    F('whiteshark', 'Белая акула', _L, 'sea', (100.0, 600.0), 50, 'shark', base='#8a98a6', belly='#fafbfc', fin='#667583',
      L=1.7, W=0.52, H=0.55, tail='lunate', tail_size=0.8, dorsal='single', dorsal_h=0.55, teeth=1),
    # ---------- ГЛУБОКИЙ ЖЁЛОБ ----------
    F('blobfish', 'Рыба-капля', _R, 'trench', (0.5, 3.0), 700, 'round', base='#e8a6a2', belly='#f6d3cf', fin='#d98e8a',
      L=0.85, W=0.7, H=0.7, tail='fan', tail_size=0.3, dorsal=None, droop=1),
    F('lanternfish', 'Фонарная рыбка', _R, 'trench', (0.02, 0.1), 15000, base='#1f3d66', belly='#4a79b0', fin='#2a5588',
      spot='#9ff4ff', spot_n=9, glow='#7ee9ff', glow_s=0.5, L=1.0, W=0.22, H=0.34, tail='fork', dorsal='single',
      dorsal_h=0.16, spot_glow=1),
    F('viperfish', 'Рыба-гадюка', _E, 'trench', (0.1, 0.6), 9000, base='#1e4658', belly='#5d8aa0', fin='#143543',
      spot='#9ff4ff', spot_n=8, glow='#6fe6ff', glow_s=0.35, L=1.4, W=0.22, H=0.3, tail='fork', dorsal='single',
      dorsal_h=0.3, teeth=2, big_head=1, spot_glow=1),
    F('gulper', 'Мешкорот', _E, 'trench', (0.5, 4.0), 3000, 'eel', base='#2a2438', belly='#4a3f60', fin='#3a3050',
      glow='#c06bff', glow_s=0.25, L=2.0, W=0.27, H=0.27, bend=0.3, dorsal='ridge', gulper=1),
    F('anglerfish', 'Удильщик', _E, 'trench', (2.0, 25.0), 700, 'round', base='#5b3a52', belly='#a67a8f', fin='#42283d',
      spot='#2d1a29', spot_n=6, L=1.0, W=0.7, H=0.74, tail='fan', tail_size=0.4, dorsal=None, lure=1, teeth=2),
    F('leviathan', 'Лунный левиафан', _L, 'trench', (50.0, 400.0), 300, base='#9bb9e8', belly='#f1f7ff', fin='#c9dcff',
      glow='#bfe3ff', glow_s=0.45, spot='#ffffff', spot_n=2.4, L=1.8, W=0.62, H=0.7, tail='lunate', tail_size=0.8,
      dorsal='sail', dorsal_h=0.55),
    F('stareel', 'Звёздный угорь', _L, 'trench', (3.0, 30.0), 2500, 'eel', base='#1a2a66', belly='#3b57b8', fin='#2d44a0',
      spot='#ffe9a0', spot_n=10, glow='#ffd96b', glow_s=0.55, L=2.0, W=0.25, H=0.25, bend=0.3, dorsal='ridge',
      spot_glow=1),
    F('ghostfish', 'Призрачная рыба', _L, 'trench', (1.0, 10.0), 6000, base='#d9ecf7', belly='#ffffff', fin='#b6dbf0',
      glow='#a9e6ff', glow_s=0.9, L=1.15, W=0.3, H=0.5, tail='fan', tail_size=0.7, dorsal='long', dorsal_h=0.3,
      ghost=1),
    F('golddragon', 'Золотой дракон', _L, 'trench', (10.0, 80.0), 1500, 'eel', base='#f0b52b', belly='#ffe49a', fin='#e5532a',
      glow='#ffbe3a', glow_s=0.4, L=2.0, W=0.28, H=0.28, bend=0.3, dorsal='mane', whiskers=2, dragon=1),
    F('abyssking', 'Король глубин', _L, 'trench', (40.0, 300.0), 1000, 'round', base='#22204a', belly='#4a4690', fin='#33306a',
      spot='#ffd36b', spot_n=7, glow='#ffc84a', glow_s=0.35, L=1.25, W=0.8, H=0.82, tail='fan', tail_size=0.5,
      dorsal=None, lure=1, teeth=2, crown=1, spot_glow=1),
]

assert len(FISH) == 40, len(FISH)
