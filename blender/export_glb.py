"""Экспорт моделей для real-time 3D (three.js): game3d/models/*.glb + параметры материалов JSON.
blender --background --python export_glb.py
"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
from mathutils import Vector
import lib
from lib import *
lib.LOW['on'] = True
from fish_data import FISH, hx
import fish as FS
import cat as C
import scene as SC
import items as I

OUT = os.path.join(HERE, '..', 'game3d', 'models')
os.makedirs(OUT, exist_ok=True)


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e


def parent_keep(o, p):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = p
    o.matrix_world = mw


def export(name):
    path = os.path.join(OUT, name + '.glb')
    kw = dict(filepath=path, export_format='GLB', export_extras=True, export_apply=True, export_yup=True,
              export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop('export_lights', None)
        bpy.ops.export_scene.gltf(**kw)
    print('EXPORTED', name, os.path.getsize(path) // 1024, 'KB')


def tri_count():
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            m = o.evaluated_get(dg).to_mesh()
            n += sum(len(p.vertices) - 2 for p in m.polygons)
            o.evaluated_get(dg).to_mesh_clear()
    return n


# ---------- рыбы ----------
def export_fish():
    reset()
    for p in FISH:
        objs = FS.build_fish(p)
        root = empty('fish_' + p['id'])
        for o in objs:
            parent_keep(o, root)
    print('fish tris', tri_count())
    export('fish')
    params = {}
    keys = ['base', 'belly', 'fin', 'stripe', 'stripe_n', 'stripe_axis', 'spot', 'spot_n', 'glow', 'glow_s', 'spot_glow', 'arch', 'ghost']
    for p in FISH:
        params[p['id']] = {k: p[k] for k in keys if k in p}
    json.dump(params, open(os.path.join(HERE, '..', 'game3d', 'src', 'fishparams.json'), 'w'), indent=0)


# ---------- коты ----------
PIVOTS = {'armL': (-0.52, -0.08, 0.86), 'armR': (0.52, -0.08, 0.86), 'tail': (0.5, 0.3, 0.22), 'head': None,
          'body': (0, 0, 0), 'acc1': (0, 0, 0), 'acc2': (0, 0, 0)}


def make_cat(root_name, fur, outfit, tier, kitten):
    objs, a = C.build_cat(fur, outfit, tier=tier, kitten=kitten)
    root = empty(root_name)
    marks = a['marks']
    groups = {}
    for gi in range(len(marks) - 1):
        s, part = marks[gi]
        e = marks[gi + 1][0]
        for o in objs[s:e]:
            groups.setdefault(part, []).append(o)
    for part, lst in groups.items():
        if part == 'end':
            continue
        piv = PIVOTS.get(part)
        if part == 'head':
            piv = (0, -0.03, a['hz'] - 0.32)
        g = empty(root_name + '_' + part, piv or (0, 0, 0), root)
        for o in lst:
            parent_keep(o, g)
    # точка лапы — для удочки (внутри правой руки)
    arm = bpy.data.objects.get(root_name + '_armR')
    empty(root_name + '_paw', a['paw'], None)
    pw = bpy.data.objects[root_name + '_paw']
    parent_keep(pw, arm if arm else root)
    return root


def export_cats():
    reset()
    for o in C.OUTFITS:
        make_cat('cat_player_' + o, 'orange', o, 0, False)
    for hid, fur, outfit in C.HELPERS:
        make_cat('cat_helper_' + hid, fur, outfit, 2, hid == 'kitten')
    print('cat tris', tri_count())
    export('cats')
    json.dump({'fur': C.FUR, 'outfits': C.OUTFITS, 'helpers': C.HELPERS},
              open(os.path.join(HERE, '..', 'game3d', 'src', 'catparams.json'), 'w'), indent=0)


# ---------- локации ----------
def collect_new(before):
    return [o for o in bpy.context.scene.objects if o.name not in before and o.parent is None]


def export_env():
    reset()
    P = SC.TOD['sunset']
    places = {}
    before = set(o.name for o in bpy.context.scene.objects)
    SC.island(P, 'sunset', 0.0)
    SC.island_extras()
    places['pier'] = collect_new(before)
    before = set(o.name for o in bpy.context.scene.objects)
    SC.cliffs(clay('cliff', hx('#c79f7d'), 0.9), clay('cliff2', hx('#a98563'), 0.9))
    places['bay'] = collect_new(before)
    before = set(o.name for o in bpy.context.scene.objects)
    SC.lighthouse(-7.5, 14.0)
    SC.rocks([(8, 8, 0.2, 1.2), (-3, 10, 0.1, 0.8), (12, 12, 0.2, 1.4)], clay('srock', hx('#8d97a3'), 0.9))
    places['sea'] = collect_new(before)
    before = set(o.name for o in bpy.context.scene.objects)
    SC.crystals()
    places['trench'] = collect_new(before)
    for k, lst in places.items():
        root = empty('env_' + k)
        for o in lst:
            parent_keep(o, root)
    # лодка с центром в точке кота
    before = set(o.name for o in bpy.context.scene.objects)
    SC.boat(Vector(SC.CAT) + Vector((0, 0, -0.52)), 1.0, 0)
    lst = collect_new(before)
    broot = empty('boat', tuple(SC.CAT))
    for o in lst:
        parent_keep(o, broot)
    empty('spot_cat', tuple(SC.CAT))
    empty('spot_bobber', tuple(SC.BOBBER))
    print('env tris', tri_count())
    export('env')


# ---------- поплавки ----------
def export_items():
    reset()
    for i, n in enumerate(['classic', 'neon', 'gold', 'duck', 'pearl', 'galaxy']):
        before = set(o.name for o in bpy.context.scene.objects)
        I.build_bobber(n)
        lst = collect_new(before)
        root = empty('bobber_' + n)
        for o in lst:
            parent_keep(o, root)
    print('items tris', tri_count())
    export('items')


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, '..', 'game3d', 'src'), exist_ok=True)
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['fish', 'cats', 'env', 'items']
    if 'fish' in a: export_fish()
    if 'cats' in a: export_cats()
    if 'env' in a: export_env()
    if 'items' in a: export_items()
