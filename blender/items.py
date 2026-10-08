"""Мелкие предметы: поплавки (скины), удочки (скины), иконки улучшений, монета, лапка.
blender --background --python items.py
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from lib import *
from fish_data import hx

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'items')
S = 512


def seg(p1, p2, r1, r2, mat, verts=24):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    ob = cone(loc=(p1 + p2) / 2, r1=r1, r2=r2, depth=d.length, mat=mat, verts=verts)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def new_shot(size=S, ortho=2.6, target=(0, 0, 0), samples=64):
    reset()
    setup_render(size, size, True, samples)
    studio_lights(key_energy=380, fill=140, rim=240, world_strength=0.6)
    camera_ortho((target[0], -12, target[2]), target, ortho)


def two_tone(loc, r, top_mat, bot_mat, split=0.0, squash=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=28, radius=r, location=loc)
    ob = bpy.context.object
    ob.scale = (1, 1, squash)
    ob.data.materials.append(top_mat)
    ob.data.materials.append(bot_mat)
    for p in ob.data.polygons:
        p.material_index = 0 if p.center.z > split else 1
        p.use_smooth = True
    return ob


# ---------- поплавки ----------

def bobber(name):
    new_shot(ortho=2.2, target=(0, 0, 0.1))
    build_bobber(name)
    render(os.path.join(OUT, 'bobber_%s.png' % name))


def build_bobber(name):
    red = clay('red', hx('#e8483d'), 0.35, spec=0.5)
    wht = clay('white', hx('#f7f3ea'), 0.35, spec=0.5)
    blk = clay('blk', hx('#1b1823'), 0.4)
    if name == 'classic':
        two_tone((0, 0, 0), 0.55, red, wht, 0.12)
        cylinder((0, 0, 0.72), r=0.05, depth=0.5, mat=blk)
        torus((0, 0, 0.12), R=0.55, r=0.025, mat=blk)
        cylinder((0, 0, -0.62), r=0.03, depth=0.2, mat=blk)
    elif name == 'neon':
        g = clay('neon', hx('#b8ff3a'), 0.3, emit=hx('#9dff1a'), emit_strength=2.5)
        d = clay('dark', hx('#23202e'), 0.4)
        two_tone((0, 0, 0), 0.55, g, d, -0.05)
        cylinder((0, 0, 0.72), r=0.05, depth=0.5, mat=clay('neon2', hx('#ff3aa8'), 0.3, emit=hx('#ff3aa8'), emit_strength=3.0))
        torus((0, 0, -0.05), R=0.55, r=0.03, mat=clay('neon3', hx('#3ae6ff'), 0.3, emit=hx('#3ae6ff'), emit_strength=3.0))
    elif name == 'gold':
        gd = glossy('gold', hx('#ffc83a'), 0.22, 0.9, 0.9)
        gd2 = glossy('gold2', hx('#fff0a8'), 0.2, 0.9, 0.9)
        two_tone((0, 0, 0), 0.55, gd, gd2, 0.1)
        cylinder((0, 0, 0.72), r=0.05, depth=0.5, mat=glossy('gold3', hx('#e0a020'), 0.3, 0.9))
        torus((0, 0, 0.1), R=0.55, r=0.04, mat=gd2)
    elif name == 'duck':
        y = clay('duck', hx('#ffd23a'), 0.5)
        sphere((0, 0, 0), (0.62, 0.5, 0.42), y, 40, 20)
        sphere((0.4, 0, 0.42), (0.3, 0.28, 0.3), y, 32, 16)
        seg((0.66, 0, 0.42), (0.92, 0, 0.4), 0.09, 0.05, clay('beak', hx('#ff8a2a'), 0.5))
        sphere((0.5, -0.22, 0.52), (0.05, 0.03, 0.05), blk, 12, 8)
        cylinder((-0.1, 0, 0.62), r=0.04, depth=0.4, mat=blk)
    elif name == 'pearl':
        pr = glossy('pearl', hx('#fff0f6'), 0.15, 0.1, 1.0)
        pk = glossy('pearlp', hx('#f7a8cc'), 0.2, 0.1, 1.0)
        two_tone((0, 0, 0), 0.55, pr, pk, 0.0)
        torus((0, 0, 0.0), R=0.56, r=0.03, mat=glossy('gold', hx('#ffc83a'), 0.25, 0.9))
        cylinder((0, 0, 0.72), r=0.05, depth=0.5, mat=glossy('gold', hx('#ffc83a'), 0.25, 0.9))
    elif name == 'galaxy':
        v = clay('galaxy', hx('#3a1f7a'), 0.4, emit=hx('#6a3df0'), emit_strength=0.5)
        v2 = clay('galaxy2', hx('#14103a'), 0.4)
        two_tone((0, 0, 0), 0.55, v, v2, 0.0)
        gm = clay('gstar', hx('#fff0a8'), 0.3, emit=hx('#ffe36b'), emit_strength=6.0)
        import random
        rnd = random.Random(3)
        for i in range(10):
            a, b = rnd.uniform(0, 6.28), rnd.uniform(-1.3, 1.3)
            sphere((math.cos(a) * math.cos(b) * 0.55, -abs(math.sin(a)) * math.cos(b) * 0.55, math.sin(b) * 0.55), (0.04, 0.04, 0.04), gm, 8, 6)
        cylinder((0, 0, 0.72), r=0.05, depth=0.5, mat=clay('gstar2', hx('#b79bff'), 0.3, emit=hx('#9b7bff'), emit_strength=2.0))


# ---------- удочки ----------
RODS = {
    'bamboo': dict(base='#d9bb6c', stripe='#9c7a34', grip='#7a4a2a', reel='#cfd3da', glow=None),
    'ocean': dict(base='#3f95de', stripe='#b4e6ff', grip='#1f4a7a', reel='#e8f4ff', glow=None),
    'galaxy': dict(base='#4b2b8f', stripe='#ffe9a0', grip='#1c1244', reel='#b79bff', glow='#7a4dff'),
    'royal': dict(base='#ffc83a', stripe='#fff0a8', grip='#8a1f2f', reel='#ffe27a', glow='#ffb81a'),
    'sakura': dict(base='#f7a8c4', stripe='#ffffff', grip='#b0507a', reel='#ffe9f2', glow=None),
    'spooky': dict(base='#2d2147', stripe='#ff8a2a', grip='#1a1228', reel='#ff8a2a', glow='#ff7a1a'),
}


def rod_objs(name, p0=(-1.2, 0, -1.2), p1=(1.25, 0, 1.25), thick=1.0, reel_s=1.0):
    r = RODS[name]
    P0, P1 = Vector(p0), Vector(p1)
    shaft = fish_material('shaft', hx(r['base']), hx(r['base']), stripe=hx(r['stripe']), stripe_n=3.0 if name != 'galaxy' else 0,
                          stripe_axis='Z', belly_cut=-4.0, spot=hx(r['stripe']) if name == 'galaxy' else None,
                          spot_n=6, glow=hx(r['glow']) if r['glow'] else None, glow_strength=0.4 if r['glow'] else 0.0, rough=0.4)
    grip = clay('grip', hx(r['grip']), 0.7)
    reel = glossy('reel', hx(r['reel']), 0.25, 0.7)
    d = (P1 - P0)
    pt = lambda t: P0 + d * t
    out = []
    out.append(seg(pt(0.3), pt(1.0), 0.07 * thick, 0.022 * thick, shaft))
    out.append(seg(pt(0.0), pt(0.3), 0.085 * thick, 0.07 * thick, grip))
    out.append(sphere(pt(0.0), (0.095 * thick,) * 3, grip, 16, 10))
    # катушка сбоку
    c = pt(0.33)
    out.append(cylinder((c.x, c.y - 0.2, c.z - 0.12), r=0.2 * reel_s, depth=0.1, rot=(90, 0, 0), mat=reel))
    out.append(cylinder((c.x, c.y - 0.0, c.z - 0.0), r=0.05, depth=0.26, rot=(90, 0, 0), mat=reel))
    out.append(seg((c.x, c.y - 0.2, c.z - 0.1), (c.x + 0.16, c.y - 0.3, c.z - 0.28), 0.025, 0.025, reel, 12))
    # колечки
    for t in (0.5, 0.65, 0.8, 0.93):
        q = pt(t)
        out.append(torus((q.x, q.y - 0.04, q.z), R=0.085, r=0.016, rot=(0, 0, 0), mat=reel))
    if r['glow']:
        gem = clay('gem', hx(r['reel']), 0.2, emit=hx(r['glow']), emit_strength=3.0)
        out.append(sphere((c.x, c.y - 0.27, c.z - 0.12), (0.07, 0.04, 0.07), gem, 12, 8))
    return out


def rod(name):
    new_shot(ortho=3.1, target=(0.0, 0, 0.0))
    rod_objs(name, thick=2.6)
    render(os.path.join(OUT, 'rod_%s.png' % name))


# ---------- иконки ----------

def spool():
    new_shot(ortho=2.0)
    red = clay('spool', hx('#e8603f'), 0.6)
    thread = clay('thread', hx('#f4efe0'), 0.9)
    cylinder((-0.28, 0, 0), r=0.62, depth=0.12, rot=(0, 90, 0), mat=red)
    cylinder((0.28, 0, 0), r=0.62, depth=0.12, rot=(0, 90, 0), mat=red)
    cylinder((0, 0, 0), r=0.5, depth=0.48, rot=(0, 90, 0), mat=thread)
    for i in range(7):
        torus(((i - 3) * 0.07, 0, 0), R=0.505, r=0.018, rot=(0, 90, 0), mat=clay('th%d' % i, hx('#e5dcc0'), 0.9))
    cylinder((0, 0, 0), r=0.12, depth=0.7, rot=(0, 90, 0), mat=clay('core', hx('#c9c2b0'), 0.7))
    # хвост нити
    seg((0.0, -0.5, 0.0), (0.9, -0.62, -0.5), 0.02, 0.02, thread, 8)
    render(os.path.join(OUT, 'icon_line.png'))


def bait():
    new_shot(ortho=2.2)
    glass = clay('glass', hx('#d8f0f2'), 0.2, spec=0.8)
    glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.55
    lid = clay('lid', hx('#e8603f'), 0.5)
    soil = clay('soil', hx('#6b4a30'), 0.95)
    cylinder((0, 0, -0.1), r=0.6, depth=1.0, mat=glass)
    cylinder((0, 0, -0.35), r=0.56, depth=0.5, mat=soil)
    cylinder((0, 0, 0.52), r=0.64, depth=0.18, mat=lid)
    worm = clay('worm', hx('#f08a8a'), 0.6)
    pts = [(-0.35, -0.55, -0.2), (-0.2, -0.56, -0.05), (0.0, -0.56, -0.18), (0.2, -0.56, 0.02), (0.38, -0.56, -0.1)]
    for q in pts:
        sphere(q, (0.12, 0.12, 0.12), worm, 16, 10)
    render(os.path.join(OUT, 'icon_bait.png'))


def bucket(full=False):
    new_shot(ortho=2.4, target=(0, 0, 0.15))
    wood = clay('bw', hx('#c58a55'), 0.8)
    wood2 = clay('bw2', hx('#a06c3f'), 0.85)
    metal = glossy('bm', hx('#b9c1cc'), 0.35, 0.8)
    water = clay('bwater', hx('#7ad3e6'), 0.3)
    # ведро: усечённый конус, раструб вверх
    seg((0, 0, -0.5), (0, 0, 0.55), 0.46, 0.6, wood)
    for i in range(8):
        a = i * math.pi / 4
        seg((math.cos(a) * 0.5, -math.sin(a) * 0.5 * 0 - 0.5 * math.sin(a), -0.45), (math.cos(a) * 0.62, -0.62 * math.sin(a), 0.5), 0.015, 0.015, wood2, 8)
    torus((0, 0, -0.2), R=0.51, r=0.035, mat=metal)
    torus((0, 0, 0.35), R=0.58, r=0.035, mat=metal)
    cylinder((0, 0, 0.5), r=0.57, depth=0.04, mat=water)
    # ручка
    torus((0, 0, 0.55), R=0.6, r=0.025, rot=(90, 0, 0), mat=metal)
    if full:
        fcols = ['#ff8a5a', '#7ab8ff', '#ffd23a']
        for i, (x, z, r) in enumerate([(-0.25, 0.58, 0.2), (0.15, 0.62, 0.22), (0.38, 0.5, 0.17)]):
            f = clay('bf%d' % i, hx(fcols[i]), 0.5)
            sphere((x, -0.2, z), (r * 1.3, r * 0.7, r), f, 20, 12)
            seg((x - r * 1.25, -0.2, z), (x - r * 2.1, -0.2, z + 0.1), 0.02, 0.15, f, 8)
    render(os.path.join(OUT, 'icon_bucket%s.png' % ('_full' if full else '')))


def boat_icon():
    new_shot(ortho=3.2, target=(0, 0, 0.2))
    hull = clay('hull', hx('#b86b3c'), 0.8)
    inner = clay('inner', hx('#e3b787'), 0.85)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1)
    ob = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for f in list(bm.faces):
        if f.calc_center_median().z > -0.05:
            bm.faces.remove(f)
    bm.to_mesh(ob.data)
    bm.free()
    ob.scale = (1.6, 0.8, 0.6)
    ob.location = (0, 0, 0.3)
    smooth(ob)
    md = ob.modifiers.new('sol', 'SOLIDIFY')
    md.thickness = 0.1
    md.offset = 1
    ob.data.materials.append(hull)
    box((-0.3, 0, 0.18), (0.3, 1.3, 0.07), inner, bevel=0.02)
    box((0.7, 0, 0.16), (0.3, 0.9, 0.07), inner, bevel=0.02)
    torus((0, 0, 0.3), R=1.0, r=0.05, mat=clay('rim', hx('#8c4f2a'), 0.8)).scale = (1.6, 0.8, 1)
    # парус-флажок
    cylinder((0.1, 0, 0.9), r=0.03, depth=1.4, mat=clay('mast', hx('#7a5233'), 0.9), verts=8)
    sail = poly_plate([(0.14, 1.5), (0.14, 0.6), (0.9, 0.62)], thickness=0.04, mat=clay('sail', hx('#f7f3ea'), 0.9), sub=0)
    render(os.path.join(OUT, 'icon_boat.png'))


def coin():
    new_shot(ortho=2.0)
    g = glossy('coin', hx('#ffc83a'), 0.28, 0.85, 0.9)
    g2 = glossy('coin2', hx('#ffe27a'), 0.25, 0.85, 0.9)
    cylinder((0, 0, 0), r=0.8, depth=0.16, rot=(90, 0, 0), mat=g)
    torus((0, 0.0, 0), R=0.8, r=0.06, rot=(90, 0, 0), mat=g2)
    torus((0, -0.09, 0), R=0.55, r=0.035, rot=(90, 0, 0), mat=g2)
    # рыбка-эмблема
    sphere((0.0, -0.1, 0.0), (0.3, 0.03, 0.17), g2, 24, 12)
    poly_plate([(-0.25, 0.0), (-0.45, 0.17), (-0.45, -0.17)], thickness=0.03, mat=g2, y=-0.1, sub=0)
    render(os.path.join(OUT, 'coin.png'))


def paw():
    new_shot(ortho=2.0)
    c = clay('paw', hx('#f4a0a8'), 0.6)
    sphere((0, 0, -0.18), (0.45, 0.2, 0.38), c, 32, 16)
    for x, z in [(-0.5, 0.25), (-0.2, 0.55), (0.2, 0.55), (0.5, 0.25)]:
        sphere((x, 0, z), (0.18, 0.15, 0.22), c, 24, 12)
    render(os.path.join(OUT, 'paw.png'))


def star():
    new_shot(ortho=2.0)
    g = glossy('star', hx('#ffd23a'), 0.3, 0.6, 0.8)
    pts = []
    for i in range(10):
        r = 0.85 if i % 2 == 0 else 0.4
        a = math.pi / 2 + i * math.pi / 5
        pts.append((math.cos(a) * r, math.sin(a) * r))
    poly_plate(pts, thickness=0.28, mat=g, sub=1, y=0)
    render(os.path.join(OUT, 'star.png'))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in ['classic', 'neon', 'gold', 'duck', 'pearl', 'galaxy']:
        bobber(n)
    for n in RODS:
        rod(n)
    spool(); bait(); bucket(False); bucket(True); boat_icon(); coin(); paw(); star()
    print('ITEMS DONE')
