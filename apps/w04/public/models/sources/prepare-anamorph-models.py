import bpy, os, math, json
from mathutils import Vector
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
models = os.path.join(root, 'public', 'models')
os.makedirs(models, exist_ok=True)

def normalize(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector([min(c[i] for c in corners) for i in range(3)])
    mx = Vector([max(c[i] for c in corners) for i in range(3)])
    center=(mn+mx)*.5
    scale=2/max(mx-mn)
    for v in obj.data.vertices:
        v.co=(obj.matrix_world @ v.co-center)*scale
    obj.matrix_world.identity()
    bpy.context.view_layer.update()

def export_model(obj, name):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    normalize(obj)
    for p in obj.data.polygons: p.use_smooth=True
    bpy.ops.wm.ply_export(filepath=os.path.join(models,name+'.ply'), export_selected_objects=True, export_normals=True, export_uv=False, export_colors='NONE', apply_modifiers=True, ascii_format=False, forward_axis='Z', up_axis='Y')
    print('MODEL_EXPORT', name, len(obj.data.vertices),len(obj.data.polygons))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_monkey_add()
monkey=bpy.context.object
modifier=monkey.modifiers.new('Smooth reference mesh','SUBSURF')
modifier.levels=1
bpy.ops.object.modifier_apply(modifier=modifier.name)
# PLY exporter converts Blender Z-up to the app's Y-up.
export_model(monkey,'suzanne')
