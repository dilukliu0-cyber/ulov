"""Кот-рыбак: спрайты игрока (6 нарядов) и аватары помощников (5 котов x 3 уровня).
blender --background --python cat.py -- [player|helpers]
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from lib import *
from fish_data import hx

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'cats')


def ring_cones(n, radius, z, base, tip, mat, r1=0.07, h=0.28, tilt=0.0):
    out = []
    for i in range(n):
        a = i * 2 * math.pi / n
        x, y = math.cos(a) * radius, math.sin(a) * radius
        ob = cone(loc=(x, y, z + h / 2), r1=r1, r2=0.0, depth=h, mat=mat, verts=12)
        out.append(ob)
    return out


FUR = {
    'orange': dict(base='#f09a45', belly='#fbe3bf', stripe='#c9692a'),
    'ginger': dict(base='#ff8a2a', belly='#ffe0b8', stripe='#d9631a'),
    'tabby': dict(base='#a98d66', belly='#e8dcc5', stripe='#5e4a33'),
    'grey': dict(base='#9aa3b0', belly='#eef0f3', stripe='#6f7886'),
    'black': dict(base='#37343f', belly='#5a5666', stripe='#24212b'),
    'kitten': dict(base='#f4aa5a', belly='#fff0d6', stripe='#d98036'),
}

OUTFITS = {
    # id: (шапка, цвет рубашки1, цвет2/полосы, тип шапки)
    'sailor': dict(shirt='#f4f1ea', stripe='#2b4a85', hat='sailor', hatc='#f8f6f0', hatc2='#2b4a85'),
    'captain': dict(shirt='#f4f1ea', stripe=None, hat='captain', hatc='#f8f6f0', hatc2='#1d2230'),
    'pirate': dict(shirt='#2a2630', stripe='#b8332f', hat='bandana', hatc='#c23a34', hatc2='#ffffff'),
    'raincoat': dict(shirt='#f6c22a', stripe=None, hat='straw', hatc='#e8b94a', hatc2='#c24a2a'),
    'hoodie': dict(shirt='#4f86d6', stripe=None, hat='beanie', hatc='#e8604c', hatc2='#ffffff'),
    'royal': dict(shirt='#7a4fb8', stripe=None, hat='crown', hatc='#ffcc3a', hatc2='#d6313e'),
}


def build_cat(fur='orange', outfit='sailor', tier=0, kitten=False, pose='fish'):
    objs = []
    marks = [(0, 'body')]
    fu = FUR[fur]
    fur_mat = fish_material('fur', hx(fu['base']), hx(fu['belly']), stripe=hx(fu['stripe']), stripe_n=1.15, distort=5.0, detail=2.5,
                            stripe_axis='X', belly_cut=-0.5, rough=0.85)
    furflat = clay('furflat', hx(fu['base']), 0.85)
    belly = clay('belly', hx(fu['belly']), 0.85)
    pink = clay('pink', hx('#f4a3a8'), 0.7)
    nosec = clay('nose', hx('#e8728a'), 0.5)
    black = clay('blk', hx('#18121c'), rough=0.2, spec=0.9, sss=0.0)
    white = clay('wht', (1, 1, 1), rough=0.3, spec=0.6, sss=0.0)
    o = OUTFITS[outfit]
    hs = (1.1 if kitten else 1.0) * 1.16   # голова крупнее у котёнка
    # ---- тело ----
    body = sphere((0, 0, 0.55), (0.66, 0.56, 0.58), fur_mat, 40, 24)
    objs.append(body)
    # рубашка
    if o['stripe']:
        shirt_mat = fish_material('shirt', hx(o['shirt']), hx(o['shirt']), stripe=hx(o['stripe']), stripe_n=2.4,
                                  stripe_axis='Z', belly_cut=-4.0, rough=0.85)
    else:
        shirt_mat = clay('shirt', hx(o['shirt']), 0.8)
    # рубашка: облегает тело, сверху срезана — видна шея и вырез
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=28, radius=1, location=(0, 0, 0.55))
    shirt = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(shirt.data)
    for f in list(bm.faces):
        c = f.calc_center_median()
        # срез горловины: верх + V-вырез спереди
        if c.z > 0.78 or (c.z > 0.5 and c.y < -0.55 and abs(c.x) < (c.z - 0.5) * 0.9):
            bm.faces.remove(f)
    bm.to_mesh(shirt.data)
    bm.free()
    shirt.scale = (0.695, 0.595, 0.6)
    smooth(shirt)
    sol = shirt.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.03
    assign(shirt, shirt_mat)
    objs.append(shirt)
    sleeve_mat = shirt_mat
    CUFF = {'sailor': '#2b4a85', 'captain': '#ffcc3a', 'pirate': '#2a2630', 'raincoat': '#d9a514',
            'hoodie': '#3a68ad', 'royal': '#fbf7ef'}
    cuff_mat = clay('cuff', hx(CUFF.get(outfit, o['shirt'])), 0.75)

    # лапы-ноги (сидит)
    for sg in (-1, 1):
        objs.append(sphere((sg * 0.3, -0.36, 0.14), (0.21, 0.3, 0.15), furflat, 24, 14))
        objs.append(sphere((sg * 0.3, -0.54, 0.12), (0.17, 0.12, 0.1), belly, 20, 12))
        for k in (-1, 0, 1):   # подушечки-пальчики
            objs.append(sphere((sg * 0.3 + k * 0.07, -0.64, 0.12), (0.045, 0.03, 0.04), pink, 10, 6))

    # руки: рукав от плеча к лапке, лапки сжимают удочку справа
    paw_l = (0.16, -0.56, 0.68)
    paw_r = (0.36, -0.54, 0.8)
    for sg, paw in ((-1, paw_l), (1, paw_r)):
        marks.append((len(objs), 'armL' if sg < 0 else 'armR'))
        sh = Vector((sg * 0.52, -0.08, 0.86))
        elbow = Vector((sg * 0.58 if sg < 0 else 0.62, -0.38, 0.6))
        pw = Vector(paw)
        wrist = pw + (elbow - pw).normalized() * 0.13
        objs.append(sphere(sh, (0.17, 0.17, 0.17), sleeve_mat, 24, 12))
        objs.append(cylinder_between(sh, elbow, 0.155, sleeve_mat, verts=24))
        objs.append(sphere(elbow, (0.155, 0.155, 0.155), sleeve_mat, 24, 12))
        objs.append(cylinder_between(elbow, wrist, 0.135, sleeve_mat, verts=24))
        cf = torus(wrist, R=0.125, r=0.04, mat=cuff_mat)
        cf.rotation_euler = (pw - elbow).to_track_quat('Z', 'Y').to_euler()
        objs.append(cf)
        objs.append(sphere(pw, (0.13, 0.12, 0.12), belly, 24, 12))

    marks.append((len(objs), 'body'))
    # детали нарядов
    if outfit == 'sailor':
        navy = clay('navy', hx('#2b4a85'), 0.8)
        red = clay('tie', hx('#d8433a'), 0.7)
        # гюйс (матросский воротник) на плечах
        objs.append(sphere((0, 0.12, 0.9), (0.5, 0.36, 0.1), navy, 32, 14, rot=(-12, 0, 0)))
        objs.append(torus((0, -0.03, 0.92), R=0.36, r=0.05, mat=navy))
        # галстук-платок
        objs.append(sphere((0, -0.52, 0.78), (0.09, 0.05, 0.07), red, 16, 10))
        for sg in (-1, 1):
            t = cone((sg * 0.06, -0.55, 0.64), r1=0.07, r2=0.02, depth=0.22, mat=red, verts=12, rot=(180, sg * 12, 0))
            objs.append(t)
    elif outfit == 'captain':
        gold = glossy('gold', hx('#ffcc3a'), 0.3, 0.8)
        navy = clay('cnavy', hx('#1d2a4a'), 0.7)
        objs.append(torus((0, -0.03, 0.92), R=0.37, r=0.05, mat=navy))
        for i in range(3):
            for sg in (-1, 1):
                objs.append(sphere((sg * 0.12, -0.6 + i * 0.01, 0.72 - i * 0.19), (0.04, 0.025, 0.04), gold, 12, 8))
        for sg in (-1, 1):   # погоны
            objs.append(sphere((sg * 0.5, -0.06, 0.99), (0.17, 0.1, 0.045), gold, 20, 10))
            for k in range(5):
                objs.append(cylinder((sg * 0.5 + (k - 2) * 0.06, -0.13, 0.95), r=0.012, depth=0.08, mat=gold, verts=6))
    elif outfit == 'pirate':
        sash = clay('sash', hx('#c23a34'), 0.8)
        sb = torus((0, 0, 0.36), R=0.66, r=0.08, mat=sash)
        sb.scale = (1, 0.86, 1)
        objs.append(sb)
        objs.append(sphere((0.4, -0.48, 0.32), (0.09, 0.06, 0.09), sash, 14, 8))
        objs.append(cone((0.44, -0.5, 0.16), r1=0.08, r2=0.03, depth=0.24, mat=sash, verts=10, rot=(180, -8, 0)))
        objs.append(torus((0, -0.03, 0.92), R=0.36, r=0.045, mat=clay('pcol', hx('#2a2630'), 0.8)))
    elif outfit == 'raincoat':
        dk = clay('rc2', hx('#d9a514'), 0.6)
        objs.append(torus((0, -0.03, 0.93), R=0.4, r=0.085, mat=clay('rcol', hx('#f6c22a'), 0.6)))
        for i in range(3):
            objs.append(cylinder((0, -0.6, 0.7 - i * 0.18), r=0.045, depth=0.03, rot=(90, 0, 0), mat=dk, verts=16))
        for sg in (-1, 1):   # карманы
            objs.append(box((sg * 0.3, -0.54, 0.3), (0.2, 0.03, 0.12), dk, rot=(14, 0, 0), bevel=0.02))
    elif outfit == 'hoodie':
        hood = clay('hood', hx('#4479c4'), 0.85)
        objs.append(sphere((0, 0.22, 0.98), (0.48, 0.3, 0.26), hood, 32, 16))
        objs.append(torus((0, -0.03, 0.92), R=0.38, r=0.06, mat=hood))
        objs.append(box((0, -0.55, 0.32), (0.42, 0.03, 0.17), hood, rot=(16, 0, 0), bevel=0.03))   # карман-кенгуру
        for sg in (-1, 1):   # шнурки
            objs.append(cylinder((sg * 0.09, -0.56, 0.78), r=0.014, depth=0.2, mat=clay('lace', (1, 1, 1), 0.7), verts=6))
    elif outfit == 'royal':
        trim = glossy('trim', hx('#ffe27a'), 0.3, 0.6)
        erm = clay('ermine', hx('#fbf7ef'), 0.9)
        objs.append(torus((0, -0.03, 0.93), R=0.4, r=0.09, mat=erm))
        for i in range(8):   # пятнышки горностая
            a = i * math.pi / 4 + 0.3
            objs.append(sphere((math.cos(a) * 0.4, -0.03 + math.sin(a) * 0.4 - 0.05, 0.97), (0.025, 0.025, 0.035), black, 8, 6))
        for i in range(3):
            objs.append(sphere((0, -0.6, 0.72 - i * 0.18), (0.045, 0.03, 0.045), trim, 12, 8))
        bt = torus((0, 0, 0.36), R=0.67, r=0.045, mat=trim)
        bt.scale = (1, 0.86, 1)
        objs.append(bt)
    marks.append((len(objs), 'tail'))
    # хвост: плотная цепочка сфер по кривой Безье — гладкая трубка
    P0, P1, P2, P3 = Vector((0.5, 0.3, 0.22)), Vector((1.25, 0.42, 0.35)), Vector((1.05, 0.3, 1.05)), Vector((0.72, 0.14, 1.2))
    N = 18 if LOW['on'] else 44
    for i in range(N):
        t = i / (N - 1)
        q = (1 - t) ** 3 * P0 + 3 * (1 - t) ** 2 * t * P1 + 3 * (1 - t) * t * t * P2 + t ** 3 * P3
        r = 0.14 - 0.06 * t
        objs.append(sphere(q, (r, r, r), fur_mat, 24, 12))
    marks.append((len(objs), 'head'))
    # ---- голова ----
    hz = 1.27
    head = sphere((0, -0.03, hz), (0.56 * hs, 0.5 * hs, 0.48 * hs), fur_mat, 48, 28)
    objs.append(head)
    # уши
    for sg in (-1, 1):
        e = cone((sg * 0.43 * hs, -0.02, hz + 0.4 * hs), r1=0.22, r2=0.0, depth=0.38, mat=furflat, verts=24, rot=(0, sg * 22, 0))
        e.scale = (1, 0.55, 1)
        objs.append(e)
        e2 = cone((sg * 0.42 * hs, -0.1, hz + 0.38 * hs), r1=0.14, r2=0.0, depth=0.28, mat=pink, verts=24, rot=(0, sg * 16, 0))
        e2.scale = (1, 0.4, 1)
        objs.append(e2)
    # глаза
    for sg in (-1, 1):
        objs.append(sphere((sg * 0.2 * hs, -0.5 * hs + 0.02, hz + 0.05), (0.075, 0.04, 0.105), black, 24, 14))
        objs[-1]['eye'] = 1
        objs.append(sphere((sg * 0.2 * hs + 0.025, -0.5 * hs - 0.005, hz + 0.1), (0.028, 0.02, 0.035), white, 12, 8))
        objs[-1]['eye'] = 1
        objs.append(sphere((sg * 0.32 * hs, -0.43 * hs, hz - 0.1), (0.085, 0.03, 0.055), pink, 16, 10))
    # мордочка
    for sg in (-1, 1):
        objs.append(sphere((sg * 0.065 * hs, -0.485 * hs, hz - 0.14), (0.1, 0.07, 0.085), belly, 24, 14))
    objs.append(sphere((0, -0.535 * hs, hz - 0.075), (0.052, 0.035, 0.04), nosec, 16, 10))
    # усы
    wh = clay('whisk', hx('#f4efe6'), 0.5)
    for sg in (-1, 1):
        for k, dz in enumerate((-0.02, -0.07, -0.12)):
            a = Vector((sg * 0.2 * hs, -0.5 * hs, hz - 0.14 + dz))
            b = a + Vector((sg * 0.36, -0.07, dz * 1.8 + 0.01 * k))
            c = cylinder_between(a, b, 0.006, wh)
            objs.append(c)
    # лоб: полоски
    for i in (-1, 0, 1):
        s = cone((i * 0.1, -0.44 * hs, hz + 0.34 * hs), r1=0.035, r2=0.0, depth=0.18, mat=clay('fst', hx(fu['stripe']), 0.85), verts=10)
        s.rotation_euler = (math.radians(-12), 0, 0)
        objs.append(s)
    # ---- шапка ----
    hat = o['hat']
    top = hz + 0.46 * hs
    if hat == 'sailor':
        wmat = clay('hatw', hx(o['hatc']), 0.8)
        nav = clay('hatn', hx(o['hatc2']), 0.7)
        objs.append(cylinder((0, -0.03, top - 0.02), r=0.3 * hs, depth=0.18, mat=wmat))
        objs.append(torus((0, -0.03, top - 0.09), R=0.34 * hs, r=0.06, mat=wmat))
        objs.append(torus((0, -0.03, top + 0.0), R=0.305 * hs, r=0.022, mat=nav))
    elif hat == 'captain':
        wmat = clay('hatw', hx(o['hatc']), 0.8)
        blk = clay('hatb', hx(o['hatc2']), 0.4, spec=0.6)
        gold = clay('hatg', hx('#ffcc3a'), 0.3, spec=0.8)
        objs.append(cylinder((0, -0.03, top + 0.02), r=0.33 * hs, depth=0.2, mat=wmat))
        objs.append(cylinder((0, -0.03, top - 0.07), r=0.35 * hs, depth=0.06, mat=blk))
        v = sphere((0, -0.33 * hs, top - 0.06), (0.25 * hs, 0.13, 0.03), blk, 24, 10)
        objs.append(v)
        objs.append(sphere((0, -0.35 * hs, top + 0.05), (0.07, 0.025, 0.07), gold, 16, 10))
    elif hat == 'bandana':
        red = clay('band', hx(o['hatc']), 0.8)
        objs.append(torus((0, -0.03, hz + 0.33 * hs), R=0.46 * hs, r=0.07, mat=red))
        objs.append(sphere((0.34, 0.2, hz + 0.3), (0.12, 0.08, 0.12), red, 16, 10))
        objs.append(cone((0.42, 0.28, hz + 0.18), r1=0.08, r2=0.0, depth=0.22, mat=red, rot=(0, 20, 0)))
        patch = clay('patch', hx('#15111e'), 0.4)
        objs.append(sphere((-0.2 * hs, -0.52 * hs, hz + 0.03), (0.1, 0.03, 0.115), patch, 20, 12))
    elif hat == 'straw':
        st = clay('straw', hx(o['hatc']), 0.9)
        band = clay('sband', hx(o['hatc2']), 0.7)
        objs.append(cylinder((0, -0.03, top - 0.04), r=0.72 * hs, depth=0.05, mat=st))
        objs.append(sphere((0, -0.03, top - 0.02), (0.4 * hs, 0.38 * hs, 0.3), st, 32, 16))
        objs.append(torus((0, -0.03, top - 0.03), R=0.4 * hs, r=0.04, mat=band))
    elif hat == 'beanie':
        bn = clay('beanie', hx(o['hatc']), 0.9)
        pom = clay('pom', hx(o['hatc2']), 0.9)
        objs.append(sphere((0, -0.03, top - 0.07), (0.46 * hs, 0.43 * hs, 0.33), bn, 32, 16))
        objs.append(torus((0, -0.03, top - 0.18), R=0.44 * hs, r=0.07, mat=clay('cuff', hx('#f4f1ea'), 0.9)))
        objs.append(sphere((0, -0.03, top + 0.28), (0.12, 0.12, 0.12), pom, 20, 12))
    elif hat == 'crown':
        gold = clay('crown', hx(o['hatc']), 0.3, emit=hx('#ffb81a'), emit_strength=0.6, spec=0.8)
        gem = clay('gem', hx(o['hatc2']), 0.2, emit=hx('#ff3a4a'), emit_strength=1.2)
        objs.append(cylinder((0, -0.03, top - 0.04), r=0.34 * hs, depth=0.12, mat=gold))
        for i in range(5):
            a = i * 2 * math.pi / 5 + math.pi / 2
            objs.append(cone((math.cos(a) * 0.3 * hs, -0.03 + math.sin(a) * 0.3 * hs, top + 0.1), r1=0.07, r2=0.0, depth=0.24, mat=gold, verts=12))
        objs.append(sphere((0, -0.34 * hs, top - 0.04), (0.055, 0.03, 0.055), gem, 16, 10))
    # ---- уровни помощника ----
    marks.append((len(objs), 'acc1'))
    if tier >= 1:
        sc = clay('scarf', hx('#d8433a'), 0.85)
        objs.append(torus((0, -0.04, 0.9), R=0.5, r=0.12, mat=sc))
        objs.append(sphere((0.3, -0.5, 0.72), (0.12, 0.07, 0.28), sc, 16, 10, rot=(0, 10, 0)))
    marks.append((len(objs), 'acc2'))
    if tier >= 2:
        gold = clay('medal', hx('#ffcc3a'), 0.25, emit=hx('#ffb81a'), emit_strength=0.8, spec=0.9)
        objs.append(cylinder((-0.16, -0.545, 0.66), r=0.1, depth=0.04, rot=(90, 0, 0), mat=gold))
        objs.append(cone((-0.16, -0.575, 0.66), r1=0.06, r2=0.0, depth=0.03, rot=(90, 0, 0), mat=clay('medal2', hx('#fff2a8'), 0.3), verts=5))
    marks.append((len(objs), 'end'))
    return objs, dict(paw=Vector(paw_r), head=Vector((0, -0.4, hz)), marks=marks, hz=hz)


def cylinder_between(p1, p2, r, mat, verts=8):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    ob = cylinder(loc=(p1 + p2) / 2, r=r, depth=d.length, mat=mat, verts=verts)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def setup_cam_lights(target, scale, loc=(2.2, -6.5, 3.6)):
    studio_lights(key_energy=440, fill=120, rim=260, world_strength=0.55)
    bloom(threshold=0.95, strength=0.35, size=0.5)
    for ob in bpy.data.objects:
        if ob.type == 'LIGHT' and ob.name == 'key':
            ob.location = (-3.5, -6, 5.5)
            look_at(ob, target)
    return camera_ortho(loc, target, scale)


def render_player(out_dir=OUT):
    meta = {}
    for name, o in OUTFITS.items():
        reset()
        setup_render(768, 768, True, 64)
        objs, anchors = build_cat('orange', name)
        cam = setup_cam_lights((0.1, 0, 1.15), 3.1)
        render(os.path.join(out_dir, 'player_%s.png' % name))
        sc = bpy.context.scene
        p = world_to_camera_view(sc, cam, anchors['paw'])
        meta[name] = dict(paw=[round(p.x, 4), round(1 - p.y, 4)])
        print('PLAYER', name, meta[name])
    json.dump(meta, open(os.path.join(out_dir, 'player_meta.json'), 'w'))


HELPERS = [
    ('kitten', 'kitten', 'sailor'),
    ('tabby', 'tabby', 'raincoat'),
    ('ginger', 'ginger', 'hoodie'),
    ('murka', 'grey', 'pirate'),
    ('captain', 'black', 'captain'),
]


def render_helpers(out_dir=OUT):
    for hid, fur, outfit in HELPERS:
        for tier in range(3):
            reset()
            setup_render(512, 512, True, 64)
            objs, _ = build_cat(fur, outfit, tier=tier, kitten=(hid == 'kitten'))
            setup_cam_lights((0.0, -0.1, 1.2), 2.35, loc=(1.2, -6.5, 2.6))
            render(os.path.join(out_dir, 'helper_%s_%d.png' % (hid, tier)))
            print('HELPER', hid, tier)


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['player', 'helpers']
    os.makedirs(OUT, exist_ok=True)
    if 'player' in a:
        render_player()
    if 'helpers' in a:
        render_helpers()
