"""Общая библиотека Blender для игры «Улов»: матовый «глиняный» low-poly стиль."""
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix, Euler

# ---------- сцена ----------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(w, h, transparent=True, samples=48):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.resolution_x = w
    s.render.resolution_y = h
    s.render.resolution_percentage = 100
    s.render.film_transparent = transparent
    try:
        s.eevee.taa_render_samples = samples
    except Exception:
        pass
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'Standard'
    try:
        s.view_settings.look = 'None'
    except Exception:
        pass
    # качество v2: трассировка лучей (отражения на воде), мягкие тени, быстрый GI
    e = s.eevee
    for k, v in (('use_raytracing', True), ('use_shadows', True), ('shadow_ray_count', 2),
                 ('shadow_step_count', 8), ('use_fast_gi', True), ('fast_gi_distance', 2.0)):
        try:
            setattr(e, k, v)
        except Exception:
            pass
    try:
        e.ray_tracing_options.resolution_scale = '1'
    except Exception:
        pass
    return s


def bloom(threshold=0.85, strength=0.55, size=0.6):
    """Свечение ярких мест (солнце, фонари, кристаллы) через композитор Blender 5."""
    s = bpy.context.scene
    try:
        ng = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = ng.nodes.new('CompositorNodeRLayers')
        gl = ng.nodes.new('CompositorNodeGlare')
        for val in ('Bloom', 'BLOOM'):
            try:
                gl.inputs['Type'].default_value = val
                break
            except Exception:
                pass
        for val in ('High', 'HIGH'):
            try:
                gl.inputs['Quality'].default_value = val
                break
            except Exception:
                pass
        gl.inputs['Threshold'].default_value = threshold
        gl.inputs['Strength'].default_value = strength
        gl.inputs['Size'].default_value = size
        out = ng.nodes.new('NodeGroupOutput')
        ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
        ng.links.new(gl.outputs[0], out.inputs[0])
        s.compositing_node_group = ng
    except Exception as ex:
        print('BLOOM_FAIL', ex)


def set_world(color=(0.9, 0.88, 0.9), strength=1.0):
    w = bpy.data.worlds.new('W')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*color, 1)
    bg.inputs[1].default_value = strength
    bpy.context.scene.world = w
    return w


def set_world_gradient(top, horizon, bottom=None, strength=1.0):
    """Небо: градиент по вертикали (Z)."""
    w = bpy.data.worlds.new('Sky')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs[1].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    mp = nt.nodes.new('ShaderNodeMapRange')
    mp.inputs[1].default_value = -0.15
    mp.inputs[2].default_value = 0.85
    nt.links.new(sep.outputs['Z'], mp.inputs[0])
    nt.links.new(mp.outputs[0], ramp.inputs[0])
    el = ramp.color_ramp.elements
    el[0].position = 0.0
    el[0].color = (*(bottom or horizon), 1)
    el[1].position = 1.0
    el[1].color = (*top, 1)
    e2 = el.new(0.42)
    e2.color = (*horizon, 1)
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    bpy.context.scene.world = w
    return w


def light_area(name, loc, target=(0, 0, 0), energy=500, size=3, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.size = size
    d.color = color
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    look_at(o, target)
    return o


def light_sun(name, rot_deg, energy=3, color=(1, 1, 1), angle_deg=8):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.color = color
    d.angle = math.radians(angle_deg)
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot_deg]
    return o


def look_at(obj, target):
    direction = Vector(target) - obj.location
    rot = direction.to_track_quat('-Z', 'Y')
    obj.rotation_euler = rot.to_euler()


def camera_ortho(loc, target, scale):
    cd = bpy.data.cameras.new('Cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = scale
    cd.clip_end = 200
    c = bpy.data.objects.new('Cam', cd)
    bpy.context.collection.objects.link(c)
    c.location = loc
    look_at(c, target)
    bpy.context.scene.camera = c
    return c


def camera_persp(loc, target, lens=50, fit_h=False):
    cd = bpy.data.cameras.new('Cam')
    cd.lens = lens
    if fit_h:
        cd.sensor_fit = 'HORIZONTAL'
        cd.sensor_width = 36
    cd.clip_end = 500
    c = bpy.data.objects.new('Cam', cd)
    bpy.context.collection.objects.link(c)
    c.location = loc
    look_at(c, target)
    bpy.context.scene.camera = c
    return c


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ---------- материалы ----------

def _set(bsdf, names, value):
    for n in names:
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = value
            return


def clay(name, color, rough=0.72, emit=None, emit_strength=0.0, spec=0.25, sss=0.12):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color[:3], 1)
    b.inputs['Roughness'].default_value = rough
    _set(b, ['Specular IOR Level', 'Specular'], spec)
    _set(b, ['Subsurface Weight', 'Subsurface'], sss)
    if emit is not None:
        _set(b, ['Emission Color', 'Emission'], (*emit[:3], 1))
        _set(b, ['Emission Strength'], emit_strength)
    return m


def glossy(name, color, rough=0.25, metal=0.0, spec=0.6):
    m = clay(name, color, rough=rough, spec=spec, sss=0.0)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Metallic'].default_value = metal
    return m


def assign(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def fish_material(name, base, belly, stripe=None, stripe_n=0, stripe_axis='X',
                  spot=None, spot_n=7, glow=None, glow_strength=0.0, belly_cut=-0.1,
                  rough=0.62, distort=1.5, scales=0.0, scale_dark=0.14, alpha=1.0, detail=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = rough
    _set(b, ['Specular IOR Level', 'Specular'], 0.35)
    _set(b, ['Subsurface Weight', 'Subsurface'], 0.1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    # брюшко: градиент по Z
    mp = nt.nodes.new('ShaderNodeMapRange')
    mp.inputs[1].default_value = belly_cut - 0.22
    mp.inputs[2].default_value = belly_cut + 0.22
    nt.links.new(sep.outputs['Z'], mp.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*belly, 1)
    ramp.color_ramp.elements[1].color = (*base, 1)
    nt.links.new(mp.outputs[0], ramp.inputs[0])
    color_out = ramp.outputs[0]

    def mix(fac_out, a_out, b_color):
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        nt.links.new(fac_out, mx.inputs[0])
        nt.links.new(a_out, mx.inputs[6])
        mx.inputs[7].default_value = (*b_color, 1)
        return mx.outputs[2]

    if stripe is not None and stripe_n > 0:
        wv = nt.nodes.new('ShaderNodeTexWave')
        wv.wave_type = 'BANDS'
        wv.bands_direction = 'X' if stripe_axis == 'X' else 'Z'
        wv.inputs['Scale'].default_value = stripe_n
        wv.inputs['Distortion'].default_value = distort
        wv.inputs['Detail'].default_value = detail
        nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
        r2 = nt.nodes.new('ShaderNodeValToRGB')
        r2.color_ramp.interpolation = 'CONSTANT'
        r2.color_ramp.elements[0].position = 0.0
        r2.color_ramp.elements[0].color = (0, 0, 0, 1)
        r2.color_ramp.elements[1].position = 0.62
        r2.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(wv.outputs['Fac'], r2.inputs[0])
        # полосы только выше брюшка
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        nt.links.new(r2.outputs[0], mul.inputs[0])
        nt.links.new(mp.outputs[0], mul.inputs[1])
        color_out = mix(mul.outputs[0], color_out, stripe)
    if spot is not None:
        vo = nt.nodes.new('ShaderNodeTexVoronoi')
        vo.inputs['Scale'].default_value = spot_n
        nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
        r3 = nt.nodes.new('ShaderNodeValToRGB')
        r3.color_ramp.interpolation = 'CONSTANT'
        r3.color_ramp.elements[0].position = 0.0
        r3.color_ramp.elements[0].color = (1, 1, 1, 1)
        r3.color_ramp.elements[1].position = 0.2
        r3.color_ramp.elements[1].color = (0, 0, 0, 1)
        nt.links.new(vo.outputs['Distance'], r3.inputs[0])
        mul2 = nt.nodes.new('ShaderNodeMath')
        mul2.operation = 'MULTIPLY'
        nt.links.new(r3.outputs[0], mul2.inputs[0])
        nt.links.new(mp.outputs[0], mul2.inputs[1])
        color_out = mix(mul2.outputs[0], color_out, spot)
    if scales > 0:
        # чешуя: ячейки Вороного -> лёгкое затемнение краёв + рельеф
        sv = nt.nodes.new('ShaderNodeTexVoronoi')
        sv.inputs['Scale'].default_value = scales
        nt.links.new(tc.outputs['Object'], sv.inputs['Vector'])
        k = nt.nodes.new('ShaderNodeMath')
        k.operation = 'MULTIPLY_ADD'
        k.inputs[1].default_value = -scale_dark * 1.6
        k.inputs[2].default_value = 1.0
        nt.links.new(sv.outputs['Distance'], k.inputs[0])
        hs = nt.nodes.new('ShaderNodeHueSaturation')
        nt.links.new(color_out, hs.inputs['Color'])
        nt.links.new(k.outputs[0], hs.inputs['Value'])
        color_out = hs.outputs[0]
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.22
        bump.inputs['Distance'].default_value = 0.03
        nt.links.new(sv.outputs['Distance'], bump.inputs['Height'])
        nt.links.new(bump.outputs[0], b.inputs['Normal'])
    nt.links.new(color_out, b.inputs['Base Color'])
    if glow is not None:
        _set(b, ['Emission Color', 'Emission'], (*glow, 1))
        _set(b, ['Emission Strength'], glow_strength)
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
    nt.links.new(b.outputs[0], out.inputs[0])
    return m


# ---------- примитивы ----------
LOW = {'on': False}   # лёгкая геометрия для экспорта в игру (GLB)


def _lseg(seg, rings):
    if LOW['on']:
        return max(8, min(seg, 14)), max(5, min(rings, 8))
    return seg, rings

def smooth(ob, levels=0):
    for p in ob.data.polygons:
        p.use_smooth = True
    if LOW['on']:
        levels = 0
    if levels:
        md = ob.modifiers.new('sub', 'SUBSURF')
        md.levels = levels
        md.render_levels = levels
    return ob


def sphere(loc=(0, 0, 0), scale=(1, 1, 1), mat=None, seg=32, rings=16, rot=(0, 0, 0)):
    seg, rings = _lseg(seg, rings)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc)
    ob = bpy.context.object
    ob.scale = scale
    ob.rotation_euler = [math.radians(a) for a in rot]
    smooth(ob)
    if mat:
        assign(ob, mat)
    return ob


def cone(loc=(0, 0, 0), r1=1, r2=0, depth=1, rot=(0, 0, 0), mat=None, verts=24):
    if LOW['on']:
        verts = max(4 if verts <= 6 else 6, min(verts, 12))
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    ob = bpy.context.object
    ob.rotation_euler = [math.radians(a) for a in rot]
    smooth(ob)
    if mat:
        assign(ob, mat)
    return ob


def cylinder(loc=(0, 0, 0), r=1, depth=1, rot=(0, 0, 0), mat=None, verts=32):
    if LOW['on']:
        verts = max(4 if verts <= 6 else 6, min(verts, 12))
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    ob = bpy.context.object
    ob.rotation_euler = [math.radians(a) for a in rot]
    smooth(ob)
    if mat:
        assign(ob, mat)
    return ob


def box(loc=(0, 0, 0), size=(1, 1, 1), mat=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.scale = size
    ob.rotation_euler = [math.radians(a) for a in rot]
    if bevel:
        bpy.ops.object.transform_apply(scale=True)
        md = ob.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = 3
    if mat:
        assign(ob, mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def torus(loc=(0, 0, 0), R=1, r=0.2, rot=(0, 0, 0), mat=None):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=R, minor_radius=r,
                                     major_segments=20 if LOW['on'] else 48, minor_segments=6 if LOW['on'] else 16)
    ob = bpy.context.object
    ob.rotation_euler = [math.radians(a) for a in rot]
    smooth(ob)
    if mat:
        assign(ob, mat)
    return ob


def poly_plate(points, thickness=0.05, mat=None, plane='XZ', loc=(0, 0, 0), sub=2, y=0.0):
    """Плоская пластина (плавник) по контуру points (2D), с толщиной и скруглением."""
    me = bpy.data.meshes.new('plate')
    ob = bpy.data.objects.new('plate', me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    vs = []
    for (a, b) in points:
        if plane == 'XZ':
            vs.append(bm.verts.new((a, y, b)))
        else:
            vs.append(bm.verts.new((a, b, y)))
    bm.faces.new(vs)
    bm.to_mesh(me)
    bm.free()
    md = ob.modifiers.new('sol', 'SOLIDIFY')
    md.thickness = thickness
    md.offset = 0
    if LOW['on']:
        sub = min(sub, 1)
    if sub:
        ms = ob.modifiers.new('sub', 'SUBSURF')
        ms.levels = sub
        ms.render_levels = sub
    ob.location = loc
    for p in me.polygons:
        p.use_smooth = True
    if mat:
        assign(ob, mat)
    return ob


def bounds_of(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        eo = o.evaluated_get(dg)
        for c in eo.bound_box:
            w = eo.matrix_world @ Vector(c)
            mn = Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
            mx = Vector((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
    return mn, mx


def frame_ortho_xz(objs, pad=1.16):
    """Ортокамера сбоку (из -Y) по ограничивающему боксу объектов."""
    mn, mx = bounds_of(objs)
    cx, cz = (mn.x + mx.x) / 2, (mn.z + mx.z) / 2
    size = max(mx.x - mn.x, mx.z - mn.z) * pad
    camera_ortho((cx, -20, cz), (cx, 0, cz), size)


def studio_lights(key_energy=700, fill=200, rim=300, world=(0.93, 0.9, 0.92), world_strength=0.9):
    set_world(world, world_strength)
    light_area('key', (-4, -6, 5), (0, 0, 0), key_energy, 7, (1.0, 0.95, 0.88))
    light_area('fill', (5, -5, 1), (0, 0, 0), fill, 7, (0.85, 0.92, 1.0))
    light_area('rim', (0, 5, 4), (0, 0, 0), rim, 5, (1.0, 0.9, 0.85))
    light_area('top', (0, -1, 7), (0, 0, 0), key_energy * 0.25, 6, (1.0, 1.0, 1.0))
