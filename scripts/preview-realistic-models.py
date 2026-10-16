"""Render a local authored-model QA contact sheet (not an in-game screenshot)."""
import argparse, math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(); parser.add_argument('output'); parser.add_argument('models',nargs='+'); args=parser.parse_args()
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.ops.wm.read_factory_settings(use_empty=True)
for i,id in enumerate(args.models):
    before=set(bpy.context.scene.objects); bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/realistic'/f'{id}.glb'))
    objects=set(bpy.context.scene.objects)-before; meshes=[o for o in objects if o.type=='MESH']; bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    low=Vector(tuple(min(p[a] for p in points) for a in range(3))); high=Vector(tuple(max(p[a] for p in points) for a in range(3)))
    scale=2.2/max(high-low); center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    offset=Vector(((i%3-1)*3.3,(i//3)*3.3,0))
    for o in meshes:
        matrix=o.matrix_world.copy(); o.parent=None; o.matrix_world=matrix
        for v in o.data.vertices: v.co=(matrix@v.co-center)*scale+offset
        o.matrix_world.identity()
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.25,depth=.06,location=offset+Vector((0,0,-.05)))
    mat=bpy.data.materials.get('Pedestal') or bpy.data.materials.new('Pedestal'); mat.diffuse_color=(.12,.16,.13,1); bpy.context.object.data.materials.append(mat)
    bpy.ops.object.text_add(location=offset+Vector((-.9,-.95,.03))); text=bpy.context.object; text.data.body=id.replace('actor-','').replace('creature-','').replace('special-',''); text.data.size=.15; text.data.extrude=.001
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.world=bpy.data.worlds.new('QA world'); scene.world.color=(.3,.3,.3)
for pos,energy,size in [((-6,-7,10),1700,8),((6,-3,7),1300,7),((0,7,10),1900,5)]:
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object; o.data.energy=energy; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
target=Vector((0,1.5,.85)); bpy.ops.object.camera_add(location=(7,-12,10)); camera=bpy.context.object; camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=11.5; scene.camera=camera
scene.render.resolution_x=1500; scene.render.resolution_y=1050; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='JPEG'; scene.render.image_settings.quality=93
path=ROOT/args.output; path.parent.mkdir(parents=True,exist_ok=True); scene.render.filepath=str(path); bpy.ops.render.render(write_still=True)
