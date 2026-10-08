"""Сцены игры: 4 места x 4 времени суток. Фон без кота (кот - отдельный спрайт).
blender --background --python scene.py -- [place] [tod] ...
"""
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from lib import *
from fish_data import hx

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'scenes')
W, H = 1080, 2300

CAT = Vector((3.0, 2.0, 0.95))      # где сидит кот
BOBBER = Vector((4.6, 0.2, 0.0))   # где плавает поплавок

TOD = {
    'sunset': dict(top='#5d5aa3', mid='#ff9a6b', low='#ffc79a', sun='#ffb066', sun_e=4.0, sun_rot=(78, 0, 215),
                   amb=0.9, water='#33b2b6', water2='#1f8da3', cloud='#ffd2c4', disc='#ffe3b0', lamp=0.0, stars=0, moon=0),
    'night': dict(top='#070b2a', mid='#1c2466', low='#3b3f95', sun='#9db4ff', sun_e=1.3, sun_rot=(55, 0, 160),
                  amb=0.28, water='#10405c', water2='#0a2a44', cloud='#3a3f7a', disc='#e8eeff', lamp=1.0, stars=170, moon=1),
    'dawn': dict(top='#7b9fe0', mid='#ffcbbd', low='#fff0dd', sun='#fff0c8', sun_e=3.2, sun_rot=(80, 0, 150),
                 amb=1.05, water='#58c6c9', water2='#3fa6bf', cloud='#fff1ec', disc='#fffbe0', lamp=0.2, stars=0, moon=0),
    'storm': dict(top='#232a38', mid='#4d5868', low='#6e7a89', sun='#9fb0c4', sun_e=1.4, sun_rot=(50, 0, 200),
                  amb=0.55, water='#2a5568', water2='#1b3b4d', cloud='#3a4350', disc=None, lamp=0.7, stars=0, moon=0, rain=1),
}


def jitter_obj(ob, amp, seed, zonly=False):
    rnd = random.Random(seed)
    for v in ob.data.vertices:
        if zonly:
            v.co.z += rnd.uniform(-amp, amp)
        else:
            v.co += Vector((rnd.uniform(-amp, amp), rnd.uniform(-amp, amp), rnd.uniform(-amp, amp)))


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False


def ico(loc, scale, mat, sub=2, jit=0.0, seed=1, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=loc)
    ob = bpy.context.object
    if jit:
        jitter_obj(ob, jit, seed)
    ob.scale = scale
    ob.rotation_euler = [math.radians(a) for a in rot]
    flat(ob)
    assign(ob, mat)
    return ob


def water(amp, color, color2, seed=3, size=160, div=110, haze=None):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=div, y_subdivisions=div, size=size, location=(0, 50, 0))
    ob = bpy.context.object
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.28) for _ in range(4)]
    for v in ob.data.vertices:
        x, y = v.co.x, v.co.y + 50
        v.co.z = amp * (math.sin(x * 0.55 + ph[0] + y * 0.08) + 0.6 * math.sin(x * 0.23 - y * 0.31 + ph[1])
                        + 0.4 * math.sin(y * 0.9 + ph[2]) + 0.25 * math.sin(x * 1.7 + y * 0.6 + ph[3]))
    for p in ob.data.polygons:
        p.use_smooth = True
    m = bpy.data.materials.new('water')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.1
    _set_in(b, ['Specular IOR Level', 'Specular'], 0.55)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    mp = nt.nodes.new('ShaderNodeMapRange')
    mp.inputs[1].default_value = -50
    mp.inputs[2].default_value = 40
    nt.links.new(sep.outputs['Y'], mp.inputs[0])
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].color = (*hx(color), 1)
    r.color_ramp.elements[1].color = (*(haze if haze else hx(color2)), 1)
    e2 = r.color_ramp.elements.new(0.62)
    e2.color = (*hx(color2), 1)
    nt.links.new(mp.outputs[0], r.inputs[0])
    nt.links.new(r.outputs[0], b.inputs['Base Color'])
    nt.links.new(r.outputs[0], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.16
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 6.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.12
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs[0], b.inputs['Normal'])
    ob.data.materials.append(m)
    return ob


def _set_in(b, names, v):
    for n in names:
        if n in b.inputs:
            b.inputs[n].default_value = v
            return


def pine(x, y, z, s, mat_t, mat_l, seed=0):
    out = [cylinder((x, y, z + 0.45 * s), r=0.12 * s, depth=0.9 * s, mat=mat_t, verts=8)]
    for i in range(3):
        c = cone((x, y, z + (0.9 + i * 0.55) * s), r1=(0.85 - i * 0.2) * s, r2=0.0, depth=1.2 * s, mat=mat_l, verts=8)
        flat(c)
        out.append(c)
    return out


def palm(x, y, z, s, mat_t, mat_l):
    out = []
    for i in range(5):
        out.append(cylinder((x + i * 0.05 * s, y, z + (0.35 + i * 0.35) * s), r=0.1 * s, depth=0.4 * s, mat=mat_t,
                            verts=8, rot=(0, 5, 0)))
    for k in range(6):
        a = k * math.pi / 3
        l = ico((x + 0.3 * s + math.cos(a) * 0.5 * s, y + math.sin(a) * 0.5 * s, z + 1.85 * s),
                (0.55 * s, 0.14 * s, 0.06 * s), mat_l, 1, 0, 1, rot=(0, -12, math.degrees(a)))
        out.append(l)
    return out


def rocks(positions, mat, seed=5):
    out = []
    for i, (x, y, z, s) in enumerate(positions):
        out.append(ico((x, y, z), (s, s * 0.85, s * 0.7), mat, 1, 0.18, seed + i))
    return out


def island(P, tod, lamp):
    grass = clay('grass', hx('#7bc46a'), 0.9)
    grass2 = clay('grass2', hx('#5aa85a'), 0.9)
    sand = clay('sand', hx('#f2d6a2'), 0.95)
    wood = clay('wood', hx('#b9804f'), 0.85)
    wood2 = clay('wood2', hx('#9a6a3f'), 0.9)
    leaf = clay('leaf', hx('#4f9a58'), 0.9)
    leaf2 = clay('leaf2', hx('#6dbb62'), 0.9)
    trunk = clay('trunk', hx('#7a5233'), 0.9)
    rock = clay('rock', hx('#9aa1ab'), 0.9)
    # остров
    ico((-3.4, 4.6, 0.1), (5.0, 4.4, 1.5), sand, 3, 0.05, 2)
    ico((-3.4, 4.8, 0.5), (4.3, 3.8, 1.3), grass, 3, 0.07, 3)
    ico((-4.6, 6.8, 1.2), (2.8, 2.2, 1.0), grass2, 2, 0.1, 4)
    pine(-4.9, 6.9, 1.9, 1.5, trunk, leaf)
    pine(-2.9, 7.4, 1.4, 1.3, trunk, leaf2)
    pine(-5.9, 4.6, 1.3, 1.3, trunk, leaf)
    palm(-1.0, 4.3, 1.1, 1.4, trunk, leaf2)
    rocks([(-0.9, 1.4, 0.2, 0.5), (-0.4, 1.0, 0.15, 0.3), (-6.6, 1.8, 0.1, 0.7)], rock)
    # пирс: настил
    for i in range(14):
        x = -2.2 + i * 0.4
        b = box((x, 2.0, 0.9), (0.36, 1.35, 0.1), wood if i % 2 else wood2, bevel=0.02)
    # сваи
    for x in (-1.6, 0.0, 1.6, 3.2):
        for y in (1.45, 2.55):
            cylinder((x, y, 0.35), r=0.09, depth=1.3, mat=wood2, verts=10)
    # перила-канат и лампа
    cylinder((3.35, 2.55, 1.35), r=0.05, depth=0.9, mat=wood2, verts=8)
    lampm = clay('lamp', hx('#ffe2a0'), 0.4, emit=hx('#ffb347'), emit_strength=0.0 if lamp == 0 else 9.0 * lamp)
    ico((3.35, 2.55, 1.9), (0.17, 0.17, 0.2), lampm, 2)
    if lamp > 0:
        pl = bpy.data.lights.new('lamp', 'POINT')
        pl.energy = 220 * lamp
        pl.color = hx('#ffb868')
        pl.shadow_soft_size = 0.4
        o = bpy.data.objects.new('lamp', pl)
        bpy.context.collection.objects.link(o)
        o.location = (3.3, 2.4, 2.2)
    # ведро на пирсе (декор)
    wood3 = clay('bucketw', hx('#c58a55'), 0.8)
    cylinder((2.2, 2.9, 1.1), r=0.2, depth=0.32, mat=wood3)
    # канат-бухта
    torus((1.0, 2.9, 0.98), R=0.16, r=0.05, mat=clay('rope', hx('#e5cf9a'), 0.9))


def mix_hex(a, b, t):
    A = hx(a) if isinstance(a, str) else a
    B = hx(b) if isinstance(b, str) else b
    return tuple(A[i] * (1 - t) + B[i] * t for i in range(3))


def foam(x, y, R=0.22, s=1.0):
    m = clay('foam', (1, 1, 1), 0.6, emit=(1, 1, 1), emit_strength=0.25)
    m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.55
    t = torus((x, y, 0.06), R=R, r=0.04 * s, mat=m)
    t.scale = (1.0, 0.75, 0.35)
    return t


def far_islands(P):
    haze = mix_hex(P['low'], P['water2'], 0.35)
    m = clay('far', haze, 0.95, emit=haze, emit_strength=0.55, sss=0.0)
    for (x, y, sx, sz) in [(-30, 85, 14, 3.2), (-12, 95, 9, 2.0), (26, 90, 16, 4.0), (40, 100, 10, 2.4)]:
        ico((x, y, -0.5), (sx, 4, sz), m, 3, 0.04, int(x + y))


def gulls(P, n=4, seed=12):
    rnd = random.Random(seed)
    col = '#ffffff' if P.get('_t') in ('sunset', 'dawn') else '#2b2f3a'
    m = clay('gull', hx(col), 0.6)
    for i in range(n):
        x, y, z = rnd.uniform(-5, 8), rnd.uniform(18, 34), rnd.uniform(7.5, 11)
        s = rnd.uniform(0.35, 0.55)
        for sg in (-1, 1):
            a = Vector((x, y, z))
            b = a + Vector((sg * 0.6 * s, 0, 0.22 * s))
            c2 = b + Vector((sg * 0.55 * s, 0, -0.18 * s))
            for p1, p2 in ((a, b), (b, c2)):
                d = p2 - p1
                o = cylinder(loc=(p1 + p2) / 2, r=0.035 * s, depth=d.length, mat=m, verts=6)
                o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()


def gz(x, y):
    """высота травы острова в точке"""
    q = 1 - ((x + 3.4) / 4.3) ** 2 - ((y - 4.8) / 3.8) ** 2
    return 0.5 + 1.3 * math.sqrt(max(0.0, q)) * 0.93


def island_extras():
    bush = clay('bush', hx('#5fb15c'), 0.9)
    bush2 = clay('bush2', hx('#78c56a'), 0.9)
    rnd = random.Random(21)
    for (x, y, s) in [(-0.6, 3.3, 0.5), (-1.9, 5.8, 0.65), (-5.2, 3.4, 0.55), (-3.4, 2.3, 0.42), (0.1, 4.5, 0.38), (-2.2, 3.0, 0.35)]:
        sphere((x, y, gz(x, y) + s * 0.35), (s, s * 0.9, s * 0.75), bush if s > 0.45 else bush2, 24, 12)
    cols = ['#ff7a8a', '#ffd23a', '#ffffff', '#b58bff', '#ff9a4a']
    for i in range(60):
        x, y = rnd.uniform(-7, 0.5), rnd.uniform(1.5, 7.5)
        if ((x + 3.4) / 3.9) ** 2 + ((y - 4.8) / 3.4) ** 2 > 1.0:
            continue
        fm = clay('fl%d' % i, hx(cols[i % len(cols)]), 0.6)
        sphere((x, y, gz(x, y) + 0.04), (0.08, 0.08, 0.06), fm, 10, 6)
        cylinder((x, y, gz(x, y) - 0.06), r=0.015, depth=0.16, mat=clay('stem', hx('#4f9a58'), 0.9), verts=5)
    # домик рыбака
    wall = clay('hut', hx('#e9c99a'), 0.85)
    roof = clay('roof', hx('#d0614a'), 0.8)
    hx0, hy0 = -2.2, 6.6
    z0 = gz(hx0, hy0)
    box((hx0, hy0, z0 + 0.45), (1.5, 1.2, 1.0), wall, bevel=0.04)
    r = cone((hx0, hy0, z0 + 1.32), r1=1.3, r2=0.0, depth=0.9, mat=roof, verts=4, rot=(0, 0, 45))
    r.scale = (1.15, 0.95, 1)
    box((hx0 + 0.35, hy0 - 0.62, z0 + 0.3), (0.34, 0.05, 0.58), clay('door', hx('#8c5a35'), 0.8))
    box((hx0 - 0.4, hy0 - 0.62, z0 + 0.55), (0.3, 0.05, 0.3), clay('win', hx('#ffe9a8'), 0.4, emit=hx('#ffcf6a'), emit_strength=0.8))
    # бочки у основания пирса
    br = clay('barrel', hx('#a8703f'), 0.8)
    for (x, y) in [(-1.2, 2.7), (-0.8, 3.05)]:
        z = gz(x, y)
        cylinder((x, y, z + 0.2), r=0.22, depth=0.48, mat=br)
        torus((x, y, z + 0.35), R=0.225, r=0.02, mat=clay('hoop', hx('#5b5f66'), 0.5))


def boat(loc, s=1.0, tilt=0.0):
    hull = clay('hull', hx('#b86b3c'), 0.8)
    inner = clay('inner', hx('#e3b787'), 0.85)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc)
    ob = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for f in list(bm.faces):
        if f.calc_center_median().z > -0.05:
            bm.faces.remove(f)
    bm.to_mesh(ob.data)
    bm.free()
    ob.scale = (1.9 * s, 0.95 * s, 0.62 * s)
    ob.rotation_euler = (0, math.radians(tilt), 0)
    smooth(ob)
    md = ob.modifiers.new('sol', 'SOLIDIFY')
    md.thickness = 0.1
    md.offset = 1
    ob.data.materials.append(hull)
    # скамья + борт
    box((loc[0] - 0.5 * s, loc[1], loc[2] - 0.08 * s), (0.34 * s, 1.5 * s, 0.07 * s), inner, bevel=0.02)
    box((loc[0] + 0.9 * s, loc[1], loc[2] - 0.12 * s), (0.34 * s, 1.0 * s, 0.07 * s), inner, bevel=0.02)
    torus((loc[0], loc[1], loc[2]), R=1.0 * s, r=0.05 * s, mat=clay('rim', hx('#8c4f2a'), 0.8)).scale = (1.9, 0.95, 1)
    # весло
    cylinder((loc[0] + 0.6 * s, loc[1] + 0.8 * s, loc[2] + 0.1 * s), r=0.04 * s, depth=1.7 * s, rot=(70, 0, 30),
             mat=clay('oar', hx('#c9955f'), 0.8))


def cliffs(mat, mat2):
    ico((-7.8, 5.5, 1.5), (3.4, 3.0, 3.3), mat, 2, 0.2, 11)
    ico((-5.5, 7.5, 1.0), (2.6, 2.4, 2.4), mat2, 2, 0.2, 12)
    ico((11.0, 6.0, 1.8), (3.6, 3.0, 3.8), mat, 2, 0.2, 13)
    ico((9.2, 9.0, 1.2), (2.8, 2.6, 2.6), mat2, 2, 0.2, 14)
    ico((-8.0, 5.3, 4.0), (2.4, 2.1, 0.7), clay('top', hx('#79c067'), 0.9), 2, 0.1, 15)
    ico((11.0, 6.0, 4.9), (2.5, 2.2, 0.7), clay('top2', hx('#79c067'), 0.9), 2, 0.1, 16)
    ico((0.0, 16.0, 0.2), (14, 2.2, 0.6), clay('beach', hx('#f2d6a2'), 0.95), 2, 0.05, 17)


def lighthouse(x, y):
    rock = clay('lrock', hx('#8d97a3'), 0.9)
    ico((x, y, 0.2), (2.4, 2.2, 1.4), rock, 2, 0.15, 21)
    red = clay('lred', hx('#e8483d'), 0.7)
    wht = clay('lwht', hx('#f4f1ea'), 0.7)
    z = 1.5
    for i in range(4):
        cone((x, y, z + i * 1.1 + 0.55), r1=1.0 - i * 0.1, r2=0.9 - i * 0.1, depth=1.1, mat=red if i % 2 == 0 else wht, verts=24)
    lamp = clay('llamp', hx('#fff2b0'), 0.3, emit=hx('#ffe36b'), emit_strength=10.0)
    ico((x, y, z + 4.8), (0.7, 0.7, 0.55), lamp, 2)
    cone((x, y, z + 5.7), r1=0.9, r2=0.0, depth=0.9, mat=red, verts=24)


def crystals(seed=31):
    rnd = random.Random(seed)
    glow = clay('crys', hx('#7ef0ff'), 0.2, emit=hx('#3de0ff'), emit_strength=5.0)
    glow2 = clay('crys2', hx('#c58bff'), 0.2, emit=hx('#a45bff'), emit_strength=5.0)
    rock = clay('trock', hx('#2a2f4a'), 0.9)
    for (x, y, s) in [(-7, 6, 2.6), (9, 8, 3.0), (-3, 14, 2.0), (3, 18, 2.4), (-11, 11, 2.2), (14, 13, 2.0)]:
        ico((x, y, 0.4), (s, s * 0.9, s * 1.1), rock, 2, 0.2, int(x * 7 + y))
        for k in range(4):
            a = rnd.uniform(0, 6.28)
            cone((x + math.cos(a) * s * 0.4, y + math.sin(a) * s * 0.4, 0.4 + s * (1.0 + 0.2 * k)), r1=0.22, r2=0.0,
                 depth=1.2 + rnd.random(), mat=glow if k % 2 == 0 else glow2, rot=(rnd.uniform(-15, 15), rnd.uniform(-15, 15), 0), verts=6)
    # светящиеся шары над водой
    for i in range(26):
        x, y = rnd.uniform(-9, 11), rnd.uniform(4, 22)
        m = clay('orb%d' % i, hx('#7ef0ff'), 0.3, emit=hx('#4de6ff' if i % 3 else '#c58bff'), emit_strength=6.0)
        s = rnd.uniform(0.07, 0.16)
        ico((x, y, rnd.uniform(0.5, 3.5)), (s, s, s), m, 2)


def clouds(P, seed=4, n=7, zmin=7, zmax=13):
    rnd = random.Random(seed)
    m = clay('cloud', hx(P['cloud']), 0.95, sss=0.0)
    bb = m.node_tree.nodes['Principled BSDF']
    _set_in(bb, ['Emission Color', 'Emission'], (*hx(P['cloud']), 1))
    bb.inputs['Emission Strength'].default_value = {'night': 0.5, 'storm': 0.35}.get(P.get('_t', ''), 0.18)
    for i in range(n):
        cx, cy, cz = rnd.uniform(-26, 30), rnd.uniform(55, 85), rnd.uniform(zmin, zmax)
        w = rnd.uniform(5, 9)
        sphere((cx, cy, cz), (w * 0.62, 2.2, 0.75), m, 32, 16)
        for k in range(6):
            s = rnd.uniform(1.0, 2.1) * (1.2 if k in (2, 3) else 1.0)
            ox = (k - 2.5) / 2.5 * w * 0.5
            sphere((cx + ox, cy + rnd.uniform(-0.8, 0.8), cz + s * 0.45 + rnd.uniform(0, 0.4)), (s, s * 0.9, s * 0.85), m, 28, 14)


def stars(n):
    rnd = random.Random(8)
    m = clay('star', (1, 1, 1), 0.5, emit=(1, 0.96, 0.8), emit_strength=8.0)
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        e = rnd.uniform(0.12, 0.9)
        r = 120
        x, y, z = math.cos(a) * math.cos(e) * r, abs(math.sin(a)) * math.cos(e) * r + 20, math.sin(e) * r * 0.6 + 5
        s = rnd.uniform(0.18, 0.45)
        ico((x, y, z), (s, s, s), m, 1)


def rain(n=520):
    rnd = random.Random(9)
    m = clay('rain', hx('#cfe6ff'), 0.4, emit=hx('#cfe6ff'), emit_strength=0.5)
    m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.28
    for i in range(n):
        x, y, z = rnd.uniform(-7, 11), rnd.uniform(-4, 14), rnd.uniform(0.0, 7)
        cylinder((x, y, z), r=0.008, depth=0.7, mat=m, verts=4, rot=(0, 14, 0))


def build_scene(place, tod):
    reset()
    P = dict(TOD[tod])
    P['_t'] = tod
    sc = setup_render(W, H, transparent=False, samples=56)
    set_world_gradient(hx(P['top']), hx(P['mid']), hx(P['low']), strength=P['amb'])
    lamp = P['lamp']
    # вода и вариации места
    amp = {'pier': 0.07, 'bay': 0.05, 'sea': 0.16, 'trench': 0.1}[place]
    wcol, wcol2 = P['water'], P['water2']
    if place == 'bay':
        wcol, wcol2 = ('#5fd3cf', '#2ea9b8') if tod in ('sunset', 'dawn') else (wcol, wcol2)
    if place == 'trench':
        wcol, wcol2 = ('#16285a', '#0b1233') if tod != 'storm' else ('#18243a', '#0b121e')
    if tod == 'storm':
        amp *= 1.8
    water(amp, wcol, wcol2, seed=3 + hash(place) % 7, haze=mix_hex(P['low'], wcol2, 0.5))
    if place != 'trench':
        far_islands(P)
    # декорации
    if place == 'pier':
        island(P, tod, lamp)
        island_extras()
        for x in (-1.6, 0.0, 1.6, 3.2):
            for y in (1.45, 2.55):
                foam(x, y)
    else:
        boat(Vector(CAT) + Vector((0, 0, -0.52)), 1.0, 0)
        foam(CAT.x, CAT.y, R=1.95, s=1.6).scale = (1.0, 0.52, 0.3)
        if place == 'bay':
            cliffs(clay('cliff', hx('#c79f7d'), 0.9), clay('cliff2', hx('#a98563'), 0.9))
        if place == 'sea':
            lighthouse(-7.5, 14.0)
            rocks([(8, 8, 0.2, 1.2), (-3, 10, 0.1, 0.8), (12, 12, 0.2, 1.4)], clay('srock', hx('#8d97a3'), 0.9))
        if place == 'trench':
            crystals()
        if lamp > 0 and place != 'trench':
            pl = bpy.data.lights.new('lamp', 'POINT')
            pl.energy = 160 * lamp
            pl.color = hx('#ffb868')
            o = bpy.data.objects.new('lamp', pl)
            bpy.context.collection.objects.link(o)
            o.location = (CAT.x + 1.2, CAT.y + 0.8, 1.6)
            lm = clay('lamp', hx('#ffe2a0'), 0.4, emit=hx('#ffb347'), emit_strength=9.0)
            ico((CAT.x + 1.25, CAT.y + 0.85, 1.35), (0.14, 0.14, 0.17), lm, 2)
            cylinder((CAT.x + 1.25, CAT.y + 0.85, 0.85), r=0.04, depth=1.0, mat=clay('post', hx('#7a5233'), 0.9), verts=8)
    # небо
    if place == 'trench':
        P = dict(P)
    clouds(P, seed=4, n=7 if tod != 'storm' else 12, zmin=9 if tod != 'storm' else 7, zmax=19 if tod != 'storm' else 15)
    if P['stars']:
        stars(P['stars'])
    if tod in ('sunset', 'dawn', 'storm') and place != 'trench':
        gulls(P, 5 if tod != 'storm' else 3)
    if P.get('rain'):
        rain()
    # солнце/луна как диск + свет
    if P['disc']:
        dm = clay('disc', hx(P['disc']), 0.4, emit=hx(P['disc']), emit_strength=3.2 if tod != 'night' else 2.2)
        pos = {'sunset': (-18, 95, 12.5), 'dawn': (22, 95, 12.0), 'night': (-24, 95, 23.0)}.get(tod, (0, 95, 10))
        d = sphere(pos, (5.5, 5.5, 5.5), dm, 48, 24)
    sl = light_sun('sun', P['sun_rot'], energy=P['sun_e'], color=hx(P['sun']), angle_deg=6 if tod != 'night' else 25)
    if tod in ('night', 'storm'):
        sl.data.specular_factor = 0.15
    bloom(threshold=0.9, strength=0.5, size=0.7)
    # камера
    cam = camera_persp((2.0, -6.0, 2.3), (2.0, 0.96, -1.63), lens=38, fit_h=True)
    return cam


def render_scene(place, tod):
    cam = build_scene(place, tod)
    render(os.path.join(OUT, '%s_%s.png' % (place, tod)))
    sc = bpy.context.scene
    c = world_to_camera_view(sc, cam, CAT)
    b = world_to_camera_view(sc, cam, BOBBER)
    return dict(cat=[round(c.x, 4), round(1 - c.y, 4)], bobber=[round(b.x, 4), round(1 - b.y, 4)])


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    places = [x for x in a if x in ('pier', 'bay', 'sea', 'trench')] or ['pier', 'bay', 'sea', 'trench']
    tods = [x for x in a if x in TOD] or list(TOD)
    meta = {}
    mp = os.path.join(OUT, 'scene_meta.json')
    if os.path.exists(mp):
        meta = json.load(open(mp))
    for pl in places:
        for td in tods:
            meta[pl + '_' + td] = render_scene(pl, td)
            print('SCENE', pl, td, meta[pl + '_' + td])
    os.makedirs(OUT, exist_ok=True)
    json.dump(meta, open(mp, 'w'), indent=1)
