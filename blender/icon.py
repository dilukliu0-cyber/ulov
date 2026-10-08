"""Иконка приложения (1024, без прозрачности) и картинка заставки (кот, прозрачный фон)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lib import *
from fish_data import hx, FISH
import cat as C
import items as I
import fish as FS

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')


def backdrop():
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 8, 1.1), rotation=(math.radians(90), 0, 0))
    ob = bpy.context.object
    ob.scale = (40, 30, 1)
    m = bpy.data.materials.new('sky')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    r = nt.nodes.new('ShaderNodeValToRGB')
    # Generated.Y = 0 (низ) .. 1 (верх)
    nt.links.new(sep.outputs['Y'], r.inputs[0])
    el = r.color_ramp.elements
    el[0].position = 0.0
    el[0].color = (*hx('#ff7a8a'), 1)
    el[1].position = 1.0
    el[1].color = (*hx('#ffb27a'), 1)
    e = el.new(0.36)
    e.color = (*hx('#ff9a6b'), 1)
    e0 = el.new(0.0)
    nt.links.new(r.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    ob.data.materials.append(m)
    # вода внизу: плоская «волна» из эллипсоида
    sea = clay('sea', hx('#34b9bd'), 0.5, emit=hx('#34b9bd'), emit_strength=0.5)
    sea2 = clay('sea2', hx('#7fe0dd'), 0.5, emit=hx('#7fe0dd'), emit_strength=0.5)
    sphere((0.0, 2.0, -1.3), (5.0, 3.0, 1.5), sea, 48, 24)
    sphere((-1.5, 1.0, -0.62), (2.2, 1.2, 0.35), sea2, 48, 24)
    sphere((2.2, 1.0, -0.6), (2.0, 1.0, 0.3), sea2, 48, 24)
    # солнце
    sunm = clay('sun', hx('#ffd9a0'), 0.4, emit=hx('#ffc77a'), emit_strength=1.3)
    sphere((0.0, 5.0, 1.6), (1.35, 0.5, 1.35), sunm, 48, 24)


def scene(opaque):
    reset()
    setup_render(1024, 1024, transparent=not opaque, samples=96)
    studio_lights(key_energy=430, fill=150, rim=260, world_strength=0.65)
    if opaque:
        backdrop()
    objs, anchors = C.build_cat('orange', 'sailor')
    # удочка в лапах
    paw = anchors['paw']
    rod = I.rod_objs('bamboo', p0=(paw.x - 0.25, paw.y - 0.05, paw.z - 0.25), p1=(paw.x + 1.5, paw.y - 0.05, paw.z + 1.7), thick=1.2, reel_s=0.5)
    # леска к поплавку
    tip = Vector((paw.x + 1.5, paw.y - 0.05, paw.z + 1.7))
    bob = Vector((paw.x + 1.65, -0.9, -0.05))
    line = FS.cyl_between(tip, bob, 0.012, clay('line', hx('#f4efe0'), 0.9))
    red = clay('red', hx('#e8483d'), 0.35)
    wht = clay('wht', hx('#f7f3ea'), 0.35)
    I.two_tone(bob + Vector((0, 0, 0.0)), 0.2, red, wht, 0.04)
    # светящаяся рыбка у воды
    p = [f for f in FISH if f['id'] == 'goldcarp'][0]
    fo = FS.build_fish(p)
    emp = bpy.data.objects.new('emp', None)
    bpy.context.collection.objects.link(emp)
    for o in fo:
        o.parent = emp
    emp.scale = (0.42, 0.42, 0.42)
    emp.location = (0.9, -1.2, -0.55)
    look_at_cam = C.camera_ortho((0.25, -12, 0.95), (0.25, 0, 0.95), 3.9)
    return objs


if __name__ == '__main__':
    scene(True)
    render(os.path.join(ASSETS, 'icon.png'))
    scene(False)
    render(os.path.join(ASSETS, 'splash-icon.png'))
    print('ICON DONE')
