"""Строит и рендерит рыб. Запуск:
blender --background --python fish.py -- [id1 id2 ...]   (без аргументов — все 40)
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lib import *
from fish_data import FISH, hx

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'fish')
SIZE = 512


def cone_between(p1, p2, r1=0.03, r2=0.0, mat=None):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    ob = cone(loc=(p1 + p2) / 2, r1=r1, r2=r2, depth=d.length, mat=mat, verts=12)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def cyl_between(p1, p2, r=0.03, mat=None):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    ob = cylinder(loc=(p1 + p2) / 2, r=r, depth=d.length, mat=mat, verts=12)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def build_fish(p):
    objs = []
    arch = p['arch']
    L, W, H = p['L'], p['W'], p['H']
    taper = {'std': 0.55, 'flat': 0.15, 'ray': 0.0, 'eel': 0.4, 'shark': 0.62, 'round': 0.3}.get(arch, 0.5)
    big_head = p.get('big_head', 0)
    bend = p.get('bend', 0.0)

    def f_of(ux):
        t = (ux + 1) / 2
        f = 1 - taper * (1 - t) ** 2.3
        if big_head:
            f *= 1 + 0.28 * t ** 2
        return f

    def zoff(ux):
        return bend * L * 0.9 * math.sin(ux * math.pi * 1.4 + 0.4) if bend else 0.0

    # ---- материалы ----
    glow = hx(p['glow']) if p.get('glow') else None
    body_mat = fish_material(
        'body_' + p['id'], hx(p['base']), hx(p['belly']),
        stripe=hx(p['stripe']) if p.get('stripe') else None, stripe_n=p.get('stripe_n', 0) * 0.42,
        stripe_axis=p.get('stripe_axis', 'X'),
        spot=hx(p['spot']) if p.get('spot') else None, spot_n=p.get('spot_n', 7),
        glow=glow if not p.get('spot_glow') else hx(p['spot']),
        glow_strength=p.get('glow_s', 0.0) if not p.get('spot_glow') else 0.0,
        belly_cut=(-4.0 if arch in ('flat', 'ray') else -0.33),
        scales=(0.0 if arch == 'eel' or p.get('ghost') or p.get('droop') else (16.0 if arch in ('flat', 'ray') else 24.0)),
        scale_dark=0.1)
    if p.get('spot_glow') and p.get('spot'):
        # свечение только в пятнах
        nt = body_mat.node_tree
        bsdf = [n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'][0]
        vo = [n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexVoronoi'][0]
        ramp = [n for n in nt.nodes if n.bl_idname == 'ShaderNodeValToRGB' and n.color_ramp.interpolation == 'CONSTANT'
                and abs(n.color_ramp.elements[1].position - 0.2) < 1e-4][0]
        bsdf.inputs['Emission Color'].default_value = (*hx(p['spot']), 1)
        nt.links.new(ramp.outputs[0], bsdf.inputs['Emission Strength'])
    if p.get('ghost'):
        _set(body_mat.node_tree.nodes['Principled BSDF'] if 'Principled BSDF' in body_mat.node_tree.nodes
             else [n for n in body_mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'][0],
             ['Emission Strength'], 0.6)
    fc = hx(p['fin'])
    fin_mat = fish_material('fin_' + p['id'], fc, fc, stripe=tuple(x * 0.62 for x in fc), stripe_n=5.5,
                            stripe_axis='X', belly_cut=-4.0, rough=0.5, distort=0.4, alpha=0.9,
                            glow=glow if (glow and p.get('glow_s', 0) > 0) else None,
                            glow_strength=p.get('glow_s', 0) * 0.5)
    white = clay('white', (1, 1, 1), rough=0.35, spec=0.5, sss=0.0)
    eye_white = clay('eyew', hx(p['eye_color']) if p.get('eye_color') else (1, 1, 1), rough=0.35, spec=0.5, sss=0.0)
    black = clay('black', hx('#15111e'), rough=0.25, spec=0.8, sss=0.0)
    dark = clay('mouth', hx('#6b2a3a'), rough=0.6)

    # ---- тело ----
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28 if LOW['on'] else 56, ring_count=16 if LOW['on'] else 32, radius=1)
    body = bpy.context.object
    body.name = 'body'
    for v in body.data.vertices:
        ux, uy, uz = v.co
        f = f_of(ux)
        if arch == 'ray':
            zf = 1 - 0.62 * abs(ux)
            v.co = Vector((ux * L, uy * W * (1 - 0.55 * abs(ux)), uz * H * zf))
        elif arch == 'flat':
            v.co = Vector((ux * L, uy * W, uz * H * (0.75 + 0.25 * (1 - abs(ux)))))
        else:
            v.co = Vector((ux * L, uy * W * f, uz * H * f + zoff(ux)))
    smooth(body, 1)
    assign(body, body_mat)
    objs.append(body)

    def top_z(ux):
        f = f_of(ux)
        return H * f * math.sqrt(max(0.0, 1 - ux * ux)) * 0.97 + zoff(ux)

    def bot_z(ux):
        f = f_of(ux)
        return -H * f * math.sqrt(max(0.0, 1 - ux * ux)) * 0.97 + zoff(ux)

    # ---- хвост ----
    tail = p.get('tail', 'fork')
    s = p.get('tail_size', 0.5) * (0.6 + H)
    x0 = -L * 0.93
    zc = zoff(-0.93)
    pts = None
    if tail == 'fork':
        pts = [(0, 0.05), (-s * 0.95, s * 0.9), (-s * 0.6, 0), (-s * 0.95, -s * 0.9), (0, -0.05)]
    elif tail == 'fan':
        pts = [(0, 0.06), (-s * 0.8, s * 0.7), (-s * 1.05, s * 0.18), (-s * 1.05, -s * 0.18), (-s * 0.8, -s * 0.7), (0, -0.06)]
    elif tail == 'round':
        pts = [(0, 0.05)] + [(-s * 0.95 * math.sin(a), s * 0.75 * math.cos(a))
                              for a in [i * math.pi / 8 for i in range(-4, 5)]][::-1] + [(0, -0.05)]
        pts = [(0, 0.05), (-s * 0.55, s * 0.62), (-s * 0.95, s * 0.35), (-s * 1.0, 0), (-s * 0.95, -s * 0.35),
               (-s * 0.55, -s * 0.62), (0, -0.05)]
    elif tail == 'lunate':
        pts = [(0, 0.06), (-s * 0.3, s * 0.75), (-s * 0.85, s * 1.2), (-s * 0.55, s * 0.25), (-s * 0.5, -s * 0.25),
               (-s * 0.85, -s * 1.2), (-s * 0.3, -s * 0.75), (0, -0.06)]
    if pts:
        tl = poly_plate([(x + x0, z + zc) for x, z in pts], thickness=0.04, mat=fin_mat)
        objs.append(tl)

    # ---- спинной плавник ----
    dorsal = p.get('dorsal')
    dh = p.get('dorsal_h', 0.32)
    if dorsal in ('single', 'long', 'sail', 'twin') and arch not in ('flat', 'ray'):
        if dorsal == 'single':
            xa, xb, peak = -0.35, 0.2, -0.1
            n = 9
            shape = lambda i, n: max(0.0, 1 - abs((i / (n - 1)) - 0.3) * 1.6)
        elif dorsal == 'long':
            xa, xb = -0.6, 0.4
            n = 12
            shape = lambda i, n: 0.55 + 0.45 * math.sin(i / (n - 1) * math.pi)
        elif dorsal == 'sail':
            xa, xb = -0.45, 0.45
            n = 12
            shape = lambda i, n: math.sin(i / (n - 1) * math.pi) ** 0.7
        else:  # twin
            xa, xb = -0.5, 0.35
            n = 14
            shape = lambda i, n: 0.55 + 0.45 * math.sin((i / (n - 1)) * math.pi * 2 + 1.2) * 0.8
        xs = [xa + (xb - xa) * i / (n - 1) for i in range(n)]
        top = [(x * L, top_z(x) + dh * max(0.05, shape(i, n)) * (0.5 + H)) for i, x in enumerate(xs)]
        base = [(x * L, top_z(x) - 0.06) for x in xs][::-1]
        objs.append(poly_plate(top + base, thickness=0.035, mat=fin_mat, sub=(0 if dorsal in ('long','sail','twin') else 1)))
        # брюшные и анальный
        if arch in ('std', 'shark'):
            xs2 = [0.0 + 0.3 * i / 5 for i in range(6)]
            pts2 = [(x * L, bot_z(x) - 0.22 * H * max(0.15, 1 - abs((i / 5) - 0.2) * 1.5)) for i, x in enumerate(xs2)]
            pts2 += [(x * L, bot_z(x) + 0.05) for x in xs2][::-1]
            objs.append(poly_plate(pts2, thickness=0.03, mat=fin_mat, sub=0))
            xs3 = [-0.6 + 0.3 * i / 5 for i in range(6)]
            pts3 = [(x * L, bot_z(x) - 0.2 * H * max(0.15, 1 - abs((i / 5) - 0.7) * 1.5)) for i, x in enumerate(xs3)]
            pts3 += [(x * L, bot_z(x) + 0.05) for x in xs3][::-1]
            objs.append(poly_plate(pts3, thickness=0.03, mat=fin_mat, sub=0))
    elif dorsal == 'ridge':
        n = 24
        xs = [-0.85 + 1.5 * i / (n - 1) for i in range(n)]
        top = [(x * L, top_z(x) + 0.07 + 0.03 * math.sin(i * 1.3)) for i, x in enumerate(xs)]
        base = [(x * L, top_z(x) - 0.04) for x in xs][::-1]
        objs.append(poly_plate(top + base, thickness=0.03, mat=fin_mat, sub=0))
    elif dorsal == 'mane':
        for i in range(14):
            x = -0.8 + 1.5 * i / 13
            z = top_z(x)
            c = cone_between((x * L, 0, z - 0.03), (x * L - 0.08, 0, z + 0.32 - 0.12 * abs(x)), 0.06, 0.0, fin_mat)
            objs.append(c)

    # ---- грудные плавники ----
    if arch in ('std', 'shark', 'round'):
        sgn_list = (-1, 1)
        for sg in sgn_list:
            pts = [(0.36 * L, -0.05 * H), (0.1 * L, -0.12 * H), (-0.02 * L, -0.55 * H), (0.22 * L, -0.45 * H)]
            if arch == 'round':
                pts = [(0.3 * L, -0.1 * H), (0.1 * L, -0.15 * H), (0.0, -0.6 * H), (0.22 * L, -0.5 * H)]
            yy = sg * W * f_of(0.2) * 0.9 * math.sqrt(1 - 0.04 - 0.05)
            pf = poly_plate(pts, thickness=0.03, mat=fin_mat, y=yy)
            objs.append(pf)

    # ---- нос/плавники особые ----
    if arch == 'ray':
        tl = cone_between((-L * 0.9, 0, 0), (-L * 2.1, 0, -0.03), 0.085, 0.0, body_mat)
        objs.append(tl)
        objs.append(cone_between((-L * 1.4, 0, 0.02), (-L * 1.7, 0, 0.16), 0.03, 0.0, fin_mat))
    if p.get('bill'):
        ln = p['bill'] * L
        b = cone_between((L * 0.92, 0, zoff(0.92)), (L * 0.92 + ln, 0, zoff(0.92) + 0.02), 0.09 * (0.5 + H), 0.0, clay('bill', hx('#3a4a5e'), 0.5))
        objs.append(b)


    # ---- жабры ----
    if arch in ('std', 'shark', 'round'):
        gx = 0.42 if arch != 'round' else 0.4
        f = f_of(gx)
        uyg = math.sqrt(max(0.0, 1 - gx * gx - 0.04))
        yy = -uyg * W * f * 1.005
        rr = H * f * 0.62
        arc = []
        for i in range(9):
            a = math.radians(-55 + 110 * i / 8)
            arc.append((gx * L - rr * 0.35 + math.cos(a) * rr * 0.35, math.sin(a) * rr + zoff(gx)))
        inner = [(x - 0.035, z * 0.96) for x, z in arc][::-1]
        gm = clay('gill_' + p['id'], tuple(x * 0.6 for x in hx(p['base'])), 0.7)
        objs.append(poly_plate(arc + inner, thickness=0.012, mat=gm, sub=0, y=yy))
        if arch == 'shark':
            for k in range(3):
                objs.append(poly_plate([(x - 0.07 * (k + 1), z * 0.8) for x, z in arc] +
                                       [(x - 0.07 * (k + 1) - 0.025, z * 0.78) for x, z in arc][::-1],
                                       thickness=0.012, mat=gm, sub=0, y=yy * 0.98))

    # ---- глаза ----
    ex, ez = 0.62, 0.3
    if arch in ('flat', 'ray'):
        ex, ez = 0.45, 0.28
    if arch == 'round':
        ex, ez = 0.55, 0.28
    er = min(0.17, 0.105 * H ** 0.5 + 0.03)
    if arch in ('flat', 'ray'):
        er = 0.075
    for sg in (-1, 1):
        uy = math.sqrt(max(0.0, 1 - ex * ex - ez * ez))
        f = f_of(ex)
        if arch in ('flat', 'ray'):
            uy = math.sqrt(max(0.0, 1 - ex * ex - ez * ez))
            pos = Vector((ex * L, sg * uy * W * 0.98, ez * H * 0.75))
        else:
            pos = Vector((ex * L, sg * uy * W * f * 0.96, ez * H * f + zoff(ex)))
        nrm = -1 if sg < 0 else 1
        ew = sphere(pos, (er, er * 0.85, er), eye_white, 24, 12)
        pu = sphere(pos + Vector((er * 0.12, nrm * er * 0.55, -er * 0.02)), (er * 0.62, er * 0.5, er * 0.62), black, 24, 12)
        hl = sphere(pos + Vector((er * 0.3, nrm * er * 0.95, er * 0.28)), (er * 0.2, er * 0.14, er * 0.2), white, 12, 8)
        if p.get('glow_eyes'):
            pass
        objs += [ew, pu, hl]

    # ---- рот ----
    mx = 0.985
    mp = Vector((mx * L, 0, (-0.12 * H if arch not in ('flat', 'ray') else -0.05) + zoff(mx)))
    if not p.get('gulper') and arch not in ('flat', 'ray'):
        objs.append(sphere(mp, (0.045 * L, 0.18 * W, 0.045 * H + 0.012), dark, 16, 8))
    # ---- зубы ----
    if p.get('teeth'):
        big = 1.6 if p['teeth'] == 2 else 1.0
        for i in range(6):
            ux = 0.72 + 0.045 * i
            uzt = -0.1
            uyy = math.sqrt(max(0.0, 1 - ux * ux - uzt * uzt))
            pos = Vector((ux * L, -uyy * W * f_of(ux) * 0.97, uzt * H * f_of(ux) + zoff(ux)))
            objs.append(cone_between(pos, pos + Vector((0.01, -0.01, -0.09 * big)), 0.017 * big, 0.0, white))
            pos2 = Vector((ux * L, -uyy * W * f_of(ux) * 0.97, -0.38 * H + zoff(ux)))
            objs.append(cone_between(pos2, pos2 + Vector((0.01, -0.01, 0.08 * big)), 0.015 * big, 0.0, white))
    # ---- усы ----
    if p.get('whiskers'):
        n = p['whiskers']
        length = 0.32 if n == 1 else 0.9
        for sg in (-1, 1):
            a = Vector((L * 0.96, sg * 0.03, -0.14 * H + zoff(0.96)))
            b = a + Vector((-length * 0.35, sg * 0.04, -length * 0.55 if n == 2 else -length * 0.45))
            if n == 2:
                c = b + Vector((-length * 0.5, sg * 0.05, -length * 0.1))
                objs.append(cone_between(a, b, 0.028, 0.02, fin_mat))
                objs.append(cone_between(b, c, 0.02, 0.0, fin_mat))
            else:
                objs.append(cone_between(a, b, 0.018, 0.0, fin_mat))
    # ---- ёрш ----
    if p.get('spikes'):
        for i in range(6):
            ux = -0.35 + 0.17 * i
            z = top_z(ux)
            objs.append(cone_between((ux * L, 0, z - 0.02), (ux * L + 0.05, 0, z + 0.24), 0.035, 0.0, fin_mat))
    # ---- плавнички тунца ----
    if p.get('finlets'):
        for i in range(6):
            ux = -0.8 + 0.06 * i
            z = top_z(ux)
            objs.append(cone_between((ux * L, 0, z), (ux * L - 0.09, 0, z + 0.1), 0.03, 0.0, fin_mat))
            z = bot_z(ux)
            objs.append(cone_between((ux * L, 0, z), (ux * L - 0.09, 0, z - 0.1), 0.03, 0.0, fin_mat))
    # ---- удильщик ----
    if p.get('lure'):
        stalk = clay('stalk', hx('#3b2a39'), 0.6)
        a = Vector((L * 0.35, 0, H * 0.9))
        b = Vector((L * 0.55, 0, H * 1.55))
        c = Vector((L * 0.98, 0, H * 1.7))
        objs.append(cyl_between(a, b, 0.03, stalk))
        objs.append(cyl_between(b, c, 0.025, stalk))
        bulb = clay('bulb', hx('#fff2a8'), rough=0.3, emit=hx('#ffe36b'), emit_strength=6.0)
        objs.append(sphere(c + Vector((0.03, 0, -0.1)), (0.11, 0.11, 0.11), bulb, 24, 12))
    # ---- корона ----
    if p.get('crown'):
        gold = clay('gold', hx('#ffcc3a'), rough=0.3, emit=hx('#ffb81a'), emit_strength=1.2, spec=0.7)
        for i in range(5):
            ux = 0.3 + 0.12 * i
            z = top_z(ux)
            objs.append(cone_between((ux * L, 0, z - 0.04), (ux * L + 0.03, 0, z + 0.26 + (0.08 if i == 2 else 0)), 0.055, 0.0, gold))
    # ---- мешкорот ----
    if p.get('gulper'):
        hm = body_mat
        head = sphere((L * 0.86, 0, zoff(0.86)), (0.44, 0.34, 0.4), hm, 40, 20)
        objs.append(head)
        mouth = sphere((L * 0.86 + 0.4, 0, zoff(0.86) - 0.02), (0.1, 0.27, 0.33), dark, 24, 12)
        objs.append(mouth)
        for sg in (-1, 1):
            objs.append(sphere((L * 0.86 + 0.18, sg * 0.25, zoff(0.86) + 0.2), (0.07, 0.06, 0.07), white, 16, 8))
            objs.append(sphere((L * 0.86 + 0.22, sg * 0.3, zoff(0.86) + 0.2), (0.04, 0.035, 0.04), black, 16, 8))
    # ---- капля: нос ----
    if p.get('droop'):
        nose = clay('nose', hx('#eeb0aa'), rough=0.8)
        objs.append(sphere((L * 0.97, 0, -0.1 * H), (0.22, 0.3, 0.26), nose, 28, 14))
        objs.append(sphere((L * 0.7, 0, -0.55 * H), (0.34, 0.5, 0.2), fin_mat, 28, 14))
    # ---- дракон ----
    if p.get('dragon'):
        horn = clay('horn', hx('#ffe9a0'), 0.4)
        for sg in (-1, 1):
            objs.append(cone_between((L * 0.82, sg * 0.05, top_z(0.82) - 0.03), (L * 0.55, sg * 0.1, top_z(0.82) + 0.32), 0.05, 0.0, horn))

    for o in objs:
        pass
    return objs


def _set(bsdf, names, value):
    for n in names:
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = value
            return


def render_fish(p, out_dir=OUT, size=SIZE):
    reset()
    setup_render(size, size, transparent=True, samples=64)
    objs = build_fish(p)
    studio_lights(key_energy=470, fill=85, rim=260, world_strength=0.5)
    bloom(threshold=0.95, strength=0.4, size=0.5)
    frame_ortho_xz(objs, pad=1.18)
    render(os.path.join(out_dir, p['id'] + '.png'))


if __name__ == '__main__':
    argv = sys.argv
    ids = argv[argv.index('--') + 1:] if '--' in argv else []
    for p in FISH:
        if ids and p['id'] not in ids:
            continue
        render_fish(p)
        print('RENDERED', p['id'])
