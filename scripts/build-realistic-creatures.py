"""Convert explicitly licensed creature sources to self-contained game GLBs.

Run with work/3d-converter/bin/python. Never enable scripts from source .blend
files. Source credits and caveats live in expansion-creatures/inventory.json.
"""
import argparse
import hashlib
import io
import json
import math
import re
import struct
from pathlib import Path

import bpy
from mathutils import Vector, Matrix
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "work/realistic-sources/expansion-creatures"
OUTPUT = ROOT / "public/models/realistic"
PREVIEW = ROOT / "work/realistic-sources/expansion-creatures/previews"
bpy.context.preferences.filepaths.use_scripts_auto_execute = False

SPECS = {
    "zombie": ("thin-zombie", "zombie/new_thin_zombie.blend", "僵尸", "undead", "new_thin_zombie"),
    "skeleton": ("rigged-skeleton", "skeleton.blend", "骷髅", "skeleton", "BONES_"),
    "demon": ("night-demon", "demon/demon.blend", "夜魔", "demon", ""),
    "gargoyle": ("gargoyle", "gargoyle.blend", "石像鬼", "gargoyle", ""),
    "minotaur": ("minotaur", "minotaur/minotaur.blend", "牛头人", "minotaur", ""),
    "wolf": ("textured-wolves", "wolves/Wolf.blend", "巨狼", "wolf", "Wolf.001"),
    "bone-golem": ("bone-golem", "bone-golem.blend", "骨骸魔像", "bone-golem", ""),
    "earth-elemental": ("earth-elemental", "", "土元素魔像", "golem", ""),
}


def image(path):
    return bpy.data.images.load(str(path), check_existing=True)


def material_shader(material, color=None, normal=None, metallic=0, roughness=.8, tint=None, rough=None, normal_strength=1):
    old_color = tuple(material.diffuse_color)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = tint or ((1, 1, 1, 1) if color else old_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    if color:
        node = nodes.new("ShaderNodeTexImage"); node.image = color
        links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
        # Preserve alpha only when the source actually uses transparency.
        if material.surface_render_method == "DITHERED" and old_color[3] < 1:
            links.new(node.outputs["Alpha"], bsdf.inputs["Alpha"])
    if normal:
        normal.colorspace_settings.name = "Non-Color"
        node = nodes.new("ShaderNodeTexImage"); node.image = normal
        convert = nodes.new("ShaderNodeNormalMap")
        convert.inputs["Strength"].default_value=normal_strength
        links.new(node.outputs["Color"], convert.inputs["Color"])
        links.new(convert.outputs["Normal"], bsdf.inputs["Normal"])
    if rough:
        rough.colorspace_settings.name="Non-Color"
        node=nodes.new("ShaderNodeTexImage"); node.image=rough
        links.new(node.outputs["Color"],bsdf.inputs["Roughness"])


def authored_surface(kind):
    """Original bone microstructure, or CC0 stone-derived PBR maps.

    This is material processing, not a downloaded model or generated fake
    photograph. Bone maps are deterministic original code-native textures.
    Stone color is Daniel Andersson's CC0 Stone.jpg from the gatehouse source.
    """
    folder=SOURCE/"authored-materials"; folder.mkdir(exist_ok=True)
    if kind=="bone":
        size=256
        heights=[]; colors=[]
        for y in range(size):
            for x in range(size):
                grain=(math.sin(x*.179+y*.061)+math.sin(x*.047-y*.127)*.6+math.sin(x*.619+y*.399)*.22)/1.82
                pores=max(0,math.sin(x*1.719+y*2.137)*math.sin(x*.729-y*1.91)-.73)
                value=grain*.035-pores*.07
                heights.append(round((.5+value)*255))
                colors.append(tuple(max(0,min(255,round(channel+value*170))) for channel in (184,171,143)))
        color=Image.new("RGB",(size,size)); color.putdata(colors)
        height=Image.new("L",(size,size)); height.putdata(heights)
        rough=height.point(lambda value:max(0,min(255,round(210+(value-128)*.25)))).convert("RGB")
    else:
        matches=list((ROOT/"work/realistic-sources/gatehouse").rglob("Stone.jpg"))
        if not matches: raise RuntimeError("Missing licensed CC0 gatehouse stone texture")
        color=Image.open(matches[0]).convert("RGB"); color.thumbnail((512,512))
        # Use fine-grained stone relief, avoiding brick seams on sculpture.
        height=color.convert("L").filter(ImageFilter.GaussianBlur(.6))
        rough=height.point(lambda value:round(205+value*.12)).convert("RGB")
    width,height_px=color.size; normal=Image.new("RGB",color.size)
    values=height.load(); normals=[]
    for y in range(height_px):
        for x in range(width):
            dx=(values[(x+1)%width,y]-values[(x-1)%width,y])/255
            dy=(values[x,(y+1)%height_px]-values[x,(y-1)%height_px])/255
            vector=Vector((-dx*1.5,-dy*1.5,1)).normalized()
            normals.append(tuple(round((component*.5+.5)*255) for component in vector))
    normal.putdata(normals)
    result=[]
    for suffix,picture in [("color",color),("normal",normal),("rough",rough)]:
        path=folder/f"{kind}-{suffix}.png"; picture.save(path,optimize=True); result.append(image(path))
    return result


def keep_meshes(kind, obj):
    if obj.type != "MESH": return False
    if kind == "zombie": return obj.name == "new_thin_zombie"
    if kind == "skeleton": return obj.name.startswith("BONES_")
    if kind == "demon": return len(obj.data.vertices) > 500 and not obj.name.startswith("WGT")
    if kind == "gargoyle": return obj.name in {"Cube.001", "Sphere"}
    if kind == "minotaur": return obj.name in {"Minotaur", "WarAxe", "Circle"}
    if kind == "wolf": return obj.name == "Wolf.001"
    if kind == "bone-golem": return obj.name in {"Bone_Golem", "Bone_Club"}
    return obj.type == "MESH" and len(obj.data.vertices) > 100 and not any(s in obj.name.lower() for s in ["plane", "ground", "shadow"])


def import_earth_ascii():
    """Read only geometry arrays from Blender's historical FBX 6.1 ASCII.

    Blender 4.5 rejects this obsolete ASCII format. This deliberately narrow
    importer is NOT a generic FBX interpreter: no expressions/scripts/drivers,
    no network paths, no animation execution, and explicit array validation.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    files=sorted((SOURCE/"earth-elemental").rglob("earth elemental.fbx"))
    if not files: raise RuntimeError("Missing completed earth elemental source archive")
    text=files[0].read_text()
    if not text.startswith("; FBX 6.1.0"): raise RuntimeError("Unexpected source FBX version")
    def numbers(name,cast=float):
        match=re.search(r"\b"+name+r":\s*([-+0-9.eE,\s]+)",text)
        if not match: raise RuntimeError("Missing geometry array "+name)
        result=[cast(value) for value in match.group(1).replace("\n","").replace("\t","").split(",") if value.strip()]
        if len(result)>1_000_000: raise RuntimeError("Unexpectedly large source array")
        return result
    coordinates=numbers("Vertices"); indices=numbers("PolygonVertexIndex",int)
    if len(coordinates)%3: raise RuntimeError("Invalid source vertices")
    vertices=[coordinates[index:index+3] for index in range(0,len(coordinates),3)]
    faces=[]; face=[]
    for index in indices:
        actual=-index-1 if index<0 else index
        if actual<0 or actual>=len(vertices): raise RuntimeError("Invalid source vertex index")
        face.append(actual)
        if index<0:
            if len(face)<3: raise RuntimeError("Degenerate source face")
            faces.append(face); face=[]
    if face: raise RuntimeError("Unterminated source polygon")
    mesh=bpy.data.meshes.new("Earth elemental author mesh"); mesh.from_pydata(vertices,[],faces); mesh.update()
    uvcoords=numbers("UV"); uvindices=numbers("UVIndex",int)
    if len(uvindices)!=len(mesh.loops): raise RuntimeError("Source UV corner mismatch")
    uv=mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        index=uvindices[loop.index]*2
        if index<0 or index+1>=len(uvcoords): raise RuntimeError("Invalid UV source index")
        uv.data[loop.index].uv=uvcoords[index:index+2]
    model=bpy.data.objects.new("Earth elemental",mesh); bpy.context.collection.objects.link(model)
    model.rotation_euler.x=math.pi/2
    material=bpy.data.materials.new("Earth elemental weathered rock")
    folder=files[0].parent/"textures"
    material_shader(material,image(folder/"low poly text.png"),image(folder/"low poly normal.png"),roughness=.93)
    mesh.materials.append(material)


def setup(kind, mobile):
    spec = SPECS[kind]
    source = SOURCE / spec[1]
    if kind == "earth-elemental":
        import_earth_ascii()
    else:
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    if bpy.context.object and bpy.context.object.mode != "OBJECT": bpy.ops.object.mode_set(mode="OBJECT")
    meshes = [obj for obj in bpy.context.scene.objects if keep_meshes(kind, obj)]
    if not meshes: raise RuntimeError("No intended creature mesh in " + str(source))
    # Use each source's recorded living/idle pose, not the default death timeline.
    if kind == "zombie":
        rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
        rig.animation_data_clear(); rig.animation_data_create(); rig.animation_data.action = bpy.data.actions["idle"]
    elif kind == "bone-golem":
        for rig in [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]:
            rig.animation_data_clear(); rig.animation_data_create(); rig.animation_data.action = bpy.data.actions.get("Idle Pose")
    bpy.context.scene.frame_set(1)
    if kind == "zombie":
        diffuse = image(SOURCE / "zombie/new_thin_zombie.png")
        for material in bpy.data.materials: material_shader(material, diffuse)
    elif kind == "demon":
        for material in bpy.data.materials:
            material_shader(material, image(SOURCE/"demon/colorMap.png"), image(SOURCE/"demon/normalMap.png"), roughness=.67)
    elif kind == "minotaur":
        fur, normal = image(SOURCE/"minotaur/catfur.jpg"), image(SOURCE/"minotaur/minotaur_muscle_normal.png")
        for material in bpy.data.materials:
            material_shader(material, fur if material.name == "Fur" else None, normal if material.name == "Skin" else None, metallic=.75 if material.name in {"Steel", "Iron", "Gold"} else 0, roughness=.45 if material.name in {"Steel", "Gold"} else .83)
    elif kind == "wolf":
        fur, normal = image(SOURCE/"wolves/boar-TT7020705.png"), image(SOURCE/"wolves/boar-TT7020705_nm.png")
        for material in bpy.data.materials:
            use = material.name.startswith("Fur")
            material_shader(material, fur if use else None, normal if use else None)
            # The source's blood-red Mouth material covers large muzzle/eye
            # triangles. Keep anatomical UV assignment but use natural tissue,
            # so no red eye-mask appears on the living wolf.
            if material.name.startswith("Mouth"):
                material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.025,.009,.008,1)
            elif material.name.startswith("Black"):
                material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.006,.008,.006,1)
            elif material.name.startswith("Teeth"):
                material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.56,.49,.35,1)
    elif kind == "bone-golem":
        for material in bpy.data.materials:
            nodes = list(material.node_tree.nodes) if material.use_nodes else []
            textures = [n.image for n in nodes if n.type == "TEX_IMAGE" and n.image]
            material_shader(material, textures[0] if textures else None)
    elif kind == "skeleton":
        color,normal,rough=authored_surface("bone")
        for material in bpy.data.materials:
            material_shader(material,color,normal,rough=rough,normal_strength=.3,roughness=.86)
    elif kind == "gargoyle":
        color,normal,rough=authored_surface("stone")
        for material in bpy.data.materials:
            material_shader(material,color,normal,rough=rough,normal_strength=.65,roughness=.91)
    elif kind != "earth-elemental":
        for material in bpy.data.materials:
            nodes = list(material.node_tree.nodes) if material.use_nodes else []
            textures = [n.image for n in nodes if n.type == "TEX_IMAGE" and n.image]
            # Old Blender Internal material image names are restored below.
            diffuse = textures[0] if textures else next((i for i in bpy.data.images if i.size[0] and any(s in i.name.lower() for s in ["diff", "color"])), None)
            material_shader(material, diffuse)
    # Bake current evaluated posing and geometry, removing rigs, shadow planes,
    # dead dismemberment versions and Rigify widget meshes from published GLBs.
    # Static snapshots are deliberately reported as such, not fake animations.
    for obj in bpy.context.scene.objects: obj.select_set(obj in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    for obj in meshes:
        for modifier in obj.modifiers:
            if modifier.type == "SUBSURF": modifier.levels = 1
            elif modifier.type == "MULTIRES": modifier.levels = min(modifier.total_levels, 2 if not mobile else 1)
        obj.hide_set(False); obj.hide_viewport = False; obj.hide_render = False
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    model = bpy.context.object
    model.name = f"creature-{kind}"
    # Clear animation without changing evaluated pose.
    model.animation_data_clear()
    matrix = model.matrix_world.copy(); model.parent = None; model.matrix_world = matrix
    for obj in list(bpy.context.scene.objects):
        if obj != model: bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.objects.active = model; model.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if kind == "demon":
        # The supplied non-rigged demon has a T pose. Pose its lateral arms down
        # anatomically without changing skin UVs or claiming an animation rig.
        inverse=model.matrix_world.inverted()
        for vertex in model.data.vertices:
            point=model.matrix_world@vertex.co; side=1 if point.x>0 else -1
            if abs(point.x)>.25 and point.z>1.08:
                pivot=Vector((side*.25,0,1.51)); weight=min(1,max(0,(abs(point.x)-.25)/.19))
                rotation=Matrix.Rotation(side*.98*weight,4,"Y")
                vertex.co=inverse@(pivot+rotation@(point-pivot))
    elif kind == "earth-elemental":
        # FBX source is a bind T pose. Lower lateral rock arms into a heavy
        # sentinel stance while retaining the artist's rock topology and UVs.
        inverse=model.matrix_world.inverted()
        for vertex in model.data.vertices:
            point=model.matrix_world@vertex.co; side=1 if point.x>0 else -1
            if abs(point.x)>2.8 and point.z>5.3:
                pivot=Vector((side*2.65,0,6.6)); weight=min(1,max(0,(abs(point.x)-2.8)/1.5))
                vertex.co=inverse@(pivot+Matrix.Rotation(side*.87*weight,4,"Y")@(point-pivot))
    elif kind == "wolf" and not mobile:
        modifier=model.modifiers.new("Close-range anatomical smoothing","SUBSURF"); modifier.levels=1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Material draws remain <= 10, and near/far geometry has explicit caps.
    model.data.calc_loop_triangles()
    target = 9000 if mobile else 22000
    tris = len(model.data.loop_triangles)
    if tris > target:
        modifier = model.modifiers.new("Mobile LOD" if mobile else "Game geometry budget", "DECIMATE")
        modifier.ratio = target / tris * .97
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in model.data.polygons: polygon.use_smooth = True
    # Normalize before authoring previews; loader also respects actual bounds.
    points = [model.matrix_world @ vertex.co for vertex in model.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    scale = 1.6 / max(high.z-low.z, high.x-low.x, high.y-low.y)
    center = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z))
    for vertex in model.data.vertices: vertex.co = (model.matrix_world @ vertex.co - center) * scale
    model.matrix_world.identity()
    # Source anatomical sculpture files have incomplete/constant UV layers;
    # make real non-degenerate islands for the authored bone/stone PBR maps.
    if kind in {"skeleton","gargoyle"} or not model.data.uv_layers:
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15192,island_margin=.015)
        bpy.ops.object.mode_set(mode="OBJECT")
    model.data.validate(clean_customdata=False); model.data.update()
    for texture in bpy.data.images:
        if not texture.size[0] or texture.name in {"Render Result", "Viewer Node"}: continue
        maximum = 768 if mobile else 1536
        if max(texture.size) > maximum:
            factor = maximum/max(texture.size); texture.scale(max(1,round(texture.size[0]*factor)), max(1,round(texture.size[1]*factor)))
    return model


def compact_glb(path, credit):
    data = path.read_bytes(); size = int.from_bytes(data[12:16],"little")
    document = json.loads(data[20:20+size]); source = data[28+size:]
    images = {i["bufferView"]:i for i in document.get("images",[]) if "bufferView" in i}
    binary = bytearray()
    for index, view in enumerate(document.get("bufferViews",[])):
        offset = view.get("byteOffset",0); content = source[offset:offset+view["byteLength"]]
        if index in images:
            picture = Image.open(io.BytesIO(content))
            # Preserve alpha for cutouts; JPEG only opaque images.
            transparent = "A" in picture.getbands() and picture.getchannel("A").getextrema()[0] < 255
            stream = io.BytesIO()
            if transparent: picture.save(stream,format="PNG",optimize=True); mime="image/png"
            else: picture.convert("RGB").save(stream,format="JPEG",quality=90,subsampling=0); mime="image/jpeg"
            content=stream.getvalue(); images[index]["mimeType"]=mime
        binary.extend(b"\0"*((4-len(binary)%4)%4)); view["byteOffset"]=len(binary); view["byteLength"]=len(content); binary.extend(content)
    document["buffers"][0]["byteLength"]=len(binary); binary.extend(b"\0"*((4-len(binary)%4)%4))
    document["asset"]["copyright"]=credit
    chunk=json.dumps(document,separators=(",",":")).encode(); chunk+=b" "*((4-len(chunk)%4)%4)
    result=b"glTF"+struct.pack("<II",2,28+len(chunk)+len(binary))+struct.pack("<I",len(chunk))+b"JSON"+chunk+struct.pack("<I",len(binary))+b"BIN\0"+binary
    path.write_bytes(result)
    primitives=[p for mesh in document.get("meshes",[]) for p in mesh["primitives"]]
    if any("NORMAL" not in p["attributes"] or "TEXCOORD_0" not in p["attributes"] for p in primitives):
        raise RuntimeError("Missing required normal/UV attributes in "+str(path))
    triangles=sum(document["accessors"][p["indices"]]["count"]//3 for p in primitives if "indices" in p)
    return {"file":path.name,"bytes":len(result),"sha256":hashlib.sha256(result).hexdigest(),"triangles":triangles,"drawCalls":len(primitives),"textures":len(document.get("textures",[])),"animations":[a.get("name","") for a in document.get("animations",[])]}


def preview(kind):
    scene=bpy.context.scene
    scene.render.engine="CYCLES"; scene.cycles.samples=48; scene.cycles.device="CPU"
    scene.render.resolution_x=384; scene.render.resolution_y=384; scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new("Neutral preview world"); scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.17,.19,.22,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.65
    for location,power,size in [((3,-4,5),350,4),((-3,-1,3),200,3),((0,3,4),300,3)]:
        data=bpy.data.lights.new("Studio area","AREA"); data.energy=power; data.shape="DISK"; data.size=size
        obj=bpy.data.objects.new("Studio area",data); scene.collection.objects.link(obj); obj.location=location; obj.rotation_euler=(Vector((0,0,.75))-obj.location).to_track_quat("-Z","Y").to_euler()
    data=bpy.data.cameras.new("Preview camera"); camera=bpy.data.objects.new("Preview camera",data); scene.collection.objects.link(camera)
    camera.location=(2.6,-4,2.6); camera.rotation_euler=(Vector((0,0,.72))-camera.location).to_track_quat("-Z","Y").to_euler(); data.type="ORTHO"; data.ortho_scale=2.05; scene.camera=camera
    scene.render.filepath=str(PREVIEW/f"{kind}.png"); bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--only",choices=list(SPECS)); parser.add_argument("--preview",action="store_true"); args=parser.parse_args()
    inventory=json.loads((SOURCE/"inventory.json").read_text()); credits={i["id"]:i for i in inventory["assets"]}
    OUTPUT.mkdir(parents=True,exist_ok=True); PREVIEW.mkdir(parents=True,exist_ok=True)
    records=[]; catalog=[]
    for kind in [args.only] if args.only else SPECS:
        spec=SPECS[kind]; meta=credits[spec[0]]
        for mobile in [False,True]:
            setup(kind,mobile)
            path=OUTPUT/f"creature-{kind}{'-mobile' if mobile else ''}.glb"
            bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_image_format="AUTO",export_extras=False)
            copyright=meta.get("attribution",meta["author"])+" | "+meta["license"]
            if kind=="skeleton": copyright+="; original bone PBR textures by this project CC0-1.0"
            if kind=="gargoyle": copyright+="; Stone.jpg by Daniel Andersson CC0-1.0, adapted normal/roughness maps CC0-1.0"
            record=compact_glb(path,copyright); records.append(record)
            if record["triangles"]>(11000 if mobile else 25000) or record["bytes"]>(2_000_000 if mobile else 5_000_000) or record["drawCalls"]>10: raise RuntimeError("Exceeded model budget: "+json.dumps(record))
            print("ASSET",json.dumps(record),flush=True)
            if args.preview and not mobile: preview(kind)
        catalog.append({"id":"creature-"+kind,"name":spec[2],"species":spec[3],"near":"creature-"+kind+".glb","far":"creature-"+kind+"-mobile.glb","author":meta["author"],"license":meta["license"],"licenseUrl":meta["licenseUrl"],"source":meta["source"],"credit":copyright,"notes":meta["notes"],"animationStatus":"static baked source pose; no runtime animation claimed"})
    for filename,items,key in [("creature-manifest.json",records,"file"),("creature-catalog.json",catalog,"id")]:
        path=OUTPUT/filename; previous=json.loads(path.read_text()) if path.exists() else []
        merged={item[key]:item for item in previous+items}; path.write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2)+"\n")
    if args.preview:
        available=[kind for kind in SPECS if (PREVIEW/f"{kind}.png").exists()]
        sheet=Image.new("RGB",(384*4,412*math.ceil(len(available)/4)),"#151d20")
        draw=ImageDraw.Draw(sheet)
        for index,kind in enumerate(available):
            x,y=(index%4)*384,(index//4)*412
            sheet.paste(Image.open(PREVIEW/f"{kind}.png").convert("RGB"),(x,y))
            draw.text((x+12,y+390),kind,fill="#e0d7bd")
        destination=ROOT/"outputs/previews/realistic-creatures.jpg"
        destination.parent.mkdir(parents=True,exist_ok=True); sheet.save(destination,quality=92)


if __name__=="__main__": main()
