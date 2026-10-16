"""Build the licensed visual sample locally; never execute scripts in .blend files.

Requires Blender 4.5 (bpy==4.5.14) and Pillow. Sources/credits are documented in
REALISTIC_MODELS.md. This tool is for asset authoring, not APK builds at runtime.
"""
import argparse
import hashlib
import json
import math
import io
import sys
from pathlib import Path
import bpy
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "work/realistic-sources"
OUTPUT = ROOT / "public/models/realistic"
bpy.context.preferences.filepaths.use_scripts_auto_execute = False


def shader(material, color=None, normal=None, rough=None, metal=None, roughness=.75, metallic=0):
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1) if color else material.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    for image, socket in [(color, "Base Color"), (rough, "Roughness"), (metal, "Metallic")]:
        if not image:
            continue
        if socket != "Base Color":
            image.colorspace_settings.name = "Non-Color"
        node = nodes.new("ShaderNodeTexImage"); node.image = image
        links.new(node.outputs["Color"], bsdf.inputs[socket])
    if normal:
        normal.colorspace_settings.name = "Non-Color"
        node = nodes.new("ShaderNodeTexImage"); node.image = normal
        convert = nodes.new("ShaderNodeNormalMap")
        links.new(node.outputs["Color"], convert.inputs["Color"])
        links.new(convert.outputs["Normal"], bsdf.inputs["Normal"])


def open_source(kind):
    path = {"armored-knight": SOURCES / "knight/armor.blend", "orc-digger": SOURCES / "orc/Orc/orc.blend", "gatehouse": SOURCES / "gatehouse/GateHouse2Upload.blend"}[kind]
    if kind == "gatehouse":
        files = list((SOURCES / "gatehouse").rglob("*.blend"))
        if not files:
            raise RuntimeError("Missing unpacked gatehouse source")
        path = files[0]
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {"MESH", "ARMATURE"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    if kind == "armored-knight":
        images = bpy.data.images
        for material in bpy.data.materials:
            shader(material, images.get("armor_default_color.png"), images.get("armor_default_nmap.png"), images.get("armor_default_rough.png"), images.get("armor_default_metalness.png"))
    elif kind == "orc-digger":
        orc = bpy.data.images.load(str(path.parent / "orc.png"), check_existing=True)
        hammer = bpy.data.images.load(str(path.parent / "warhammer.png"), check_existing=True)
        for material in bpy.data.materials:
            shader(material, hammer if "hammer" in material.name else orc, roughness=.45 if material.name == "metal" else .85, metallic=.65 if material.name in {"metal", "hammermat"} else 0)
        for rig in [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]:
            rig.animation_data_create(); rig.animation_data.action = bpy.data.actions.get("wait")
        bpy.context.scene.frame_set(1)
    else:
        image_names = {"Black": "Black.jpg", "DoorType1_2": "DoorType1_2.jpg", "Flag": "Flag.png", "LogEdgeWeathered": "TreeLogEdgeWeathered.jpg", "RustedMetal": "Rusted Metal.jpg", "Stone": "Stone.jpg", "StoneWall": "StoneWall1.jpg", "Wood": "Wood.jpg"}
        for material in bpy.data.materials:
            nodes = list(material.node_tree.nodes) if material.use_nodes else []
            if any(node.type == "BSDF_PRINCIPLED" for node in nodes):
                continue
            images = [node.image for node in nodes if node.type == "TEX_IMAGE" and node.image]
            image = images[0] if images else bpy.data.images.get(image_names.get(material.name, ""))
            shader(material, image, roughness=.7 if material.name == "RustedMetal" else .9, metallic=.5 if material.name == "RustedMetal" else 0)
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = kind != "gatehouse"


def build_ground(mobile):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    material = bpy.data.materials.new("Rocky grass · Poly Haven CC0")
    shader(material, bpy.data.images.load(str(OUTPUT / "ground-color.jpg")), bpy.data.images.load(str(OUTPUT / "ground-normal.jpg")), bpy.data.images.load(str(OUTPUT / "ground-roughness.jpg")))
    vertices, faces = [(0, 0, .14)], []
    rings, sectors = (5, 24) if mobile else (16, 72)
    for ring in range(1, rings + 1):
        for step in range(sectors):
            angle = step / sectors * 6
            edge, fraction = int(angle), angle % 1
            a, b = (edge * math.pi / 3 + math.pi / 6), ((edge + 1) * math.pi / 3 + math.pi / 6)
            x = .94 * ((1-fraction)*math.cos(a)+fraction*math.cos(b))*ring/rings
            y = .94 * ((1-fraction)*math.sin(a)+fraction*math.sin(b))*ring/rings
            relief = (math.sin(x*19+y*7) * math.cos(y*23-x*9) + .5*math.sin(x*43+y*31))*.012
            vertices.append((x, y, .14+relief*(1-ring/rings*.5)))
            index = 1+(ring-1)*sectors+step; following = 1+(ring-1)*sectors+(step+1)%sectors
            if ring == 1:
                faces.append((0, index, following))
            else:
                faces.append((index-sectors, index, following, following-sectors))
    mesh = bpy.data.meshes.new("Sculpted hex surface"); mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new("Rock grass surface", mesh); bpy.context.collection.objects.link(obj)
    mesh.materials.append(material); uv = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        point = mesh.vertices[loop.vertex_index].co; uv.data[loop.index].uv = ((point.x+.94)/1.88, (point.y+.94)/1.88)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.94, depth=.14, end_fill_type="NGON", location=(0, 0, .03), rotation=(0, 0, math.pi/6))
    soil = bpy.data.materials.new("Earth cut"); soil.diffuse_color = (.13, .1, .065, 1); shader(soil)
    bpy.context.object.data.materials.append(soil)
    # Real curved blade meshes and weathered stone chips, not billboard grass.
    grass_material = bpy.data.materials.new("Grass blades"); grass_material.diffuse_color = (.14,.21,.055,1); shader(grass_material, roughness=.95)
    grass_material.use_backface_culling = False
    grass_vertices, grass_faces = [], []
    for tuft in range(12 if mobile else 64):
        angle = tuft*2.399963; radius = .73*math.sqrt((tuft+.5)/(12 if mobile else 64))
        x, y = math.cos(angle)*radius, math.sin(angle)*radius
        for blade in range(4 if mobile else 7):
            direction = angle+blade*2.1; length = .035+(tuft*7+blade*13)%17*.003
            offset = len(grass_vertices)
            for part in range(4):
                t = part/3; bend = length*.45*t*t; width = .004*(1-t)+.0003
                for side in [-1,1]:
                    grass_vertices.append((x+math.cos(direction)*bend+math.sin(direction)*width*side, y+math.sin(direction)*bend-math.cos(direction)*width*side, .151+t*length))
                if part:
                    end = offset+part*2; grass_faces.append((end-2,end-1,end+1,end))
    grass_mesh = bpy.data.meshes.new("Curved grass blades"); grass_mesh.from_pydata(grass_vertices,[],grass_faces); grass_mesh.update()
    grass_mesh.uv_layers.new(name="UVMap"); grass_mesh.materials.append(grass_material)
    grass = bpy.data.objects.new("Scattered grass tufts",grass_mesh); bpy.context.collection.objects.link(grass)
    for polygon in grass_mesh.polygons:
        polygon.use_smooth = True
    for index in range(3 if mobile else 7):
        angle = index*2.41; radius = .3+(index%3)*.16
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1 if mobile else 2, radius=1, location=(math.cos(angle)*radius,math.sin(angle)*radius,.151))
        stone = bpy.context.object; stone.name = "Weathered stone chip"
        stone.scale = (.028+index*.003,.035,.015+index*.002); stone.rotation_euler.z = angle; stone.data.materials.append(material)
        for vertex in stone.data.vertices:
            vertex.co *= 1+.15*math.sin(vertex.co.x*19+vertex.co.y*23+index)


def export(kind, mobile):
    if kind == "rocky-ground":
        build_ground(mobile)
    else:
        open_source(kind)
    if kind in {"armored-knight", "gatehouse"}:
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        for obj in bpy.context.scene.objects:
            obj.select_set(obj.type == "MESH")
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
    for image in bpy.data.images:
        if not image.size[0] or image.name in {"Render Result", "Viewer Node"}:
            continue
        maximum = 1024 if mobile else 2048
        if max(image.size) > maximum:
            scale = maximum/max(image.size); image.scale(round(image.size[0]*scale), round(image.size[1]*scale))
    if mobile and kind != "rocky-ground":
        for obj in bpy.context.scene.objects:
            if obj.type == "MESH" and len(obj.data.polygons) > 1500:
                modifier = obj.modifiers.new("Mobile geometry LOD", "DECIMATE"); modifier.ratio = .45 if kind == "armored-knight" else .6
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type in {"MESH", "ARMATURE"})
    path = OUTPUT / f'{kind}{"-mobile" if mobile else ""}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_animations=kind == "orc-digger", export_animation_mode="ACTIONS", export_nla_strips=False, export_force_sampling=True, export_image_format="AUTO", export_extras=False)
    data = path.read_bytes()
    length = int.from_bytes(data[12:16], "little")
    document = json.loads(data[20:20+length])
    # Keep JPEG-backed PBR maps compact; Blender may otherwise embed packed
    # 16-bit PNG originals. Repack all views with 4-byte alignment, never alter
    # geometry/animation accessor contents or their strides.
    source_binary = data[28+length:]
    image_views = {image["bufferView"]: image for image in document.get("images", []) if "bufferView" in image}
    packed_binary = bytearray()
    for index, view in enumerate(document.get("bufferViews", [])):
        start = view.get("byteOffset", 0)
        content = source_binary[start:start+view["byteLength"]]
        if index in image_views:
            image = Image.open(io.BytesIO(content)).convert("RGB")
            encoded = io.BytesIO(); image.save(encoded, format="JPEG", quality=90, subsampling=0)
            content = encoded.getvalue(); image_views[index]["mimeType"] = "image/jpeg"
        packed_binary.extend(b"\0"*((4-len(packed_binary)%4)%4))
        view["byteOffset"] = len(packed_binary); view["byteLength"] = len(content)
        packed_binary.extend(content)
    document["buffers"][0]["byteLength"] = len(packed_binary)
    packed_binary.extend(b"\0"*((4-len(packed_binary)%4)%4))
    document["asset"]["copyright"] = {"armored-knight": "piacenti, CC-BY-3.0; converted/LOD/material adaptation by this project", "orc-digger": 'Guillaume "GuieA_7" Englert, CC-BY-SA-4.0; adapted GLB remains CC-BY-SA-4.0', "gatehouse": "Daniel Andersson, CC0-1.0", "rocky-ground": "Poly Haven, CC0-1.0; original terrain mesh CC0-1.0"}[kind]
    chunk = json.dumps(document, separators=(",", ":")).encode()
    chunk += b" "*((4-len(chunk)%4)%4)
    binary = len(packed_binary).to_bytes(4,"little")+b"BIN\0"+bytes(packed_binary)
    result = b"glTF"+(2).to_bytes(4,"little")+(20+len(chunk)+len(binary)).to_bytes(4,"little")+len(chunk).to_bytes(4,"little")+b"JSON"+chunk+binary
    path.write_bytes(result)
    triangles = sum(document["accessors"][primitive["indices"]]["count"]//3 for mesh in document.get("meshes",[]) for primitive in mesh["primitives"] if "indices" in primitive)
    return dict(file=path.name, bytes=len(result), sha256=hashlib.sha256(result).hexdigest(), triangles=triangles, animations=[clip.get("name", "") for clip in document.get("animations", [])])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--only", choices=["armored-knight", "orc-digger", "gatehouse", "rocky-ground"])
    arguments = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [] if "--background" in sys.argv else sys.argv[1:]
    args = parser.parse_args(arguments)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for kind in [args.only] if args.only else ["armored-knight", "orc-digger", "gatehouse", "rocky-ground"]:
        for mobile in [False, True]:
            record = export(kind, mobile); print("ASSET", json.dumps(record), flush=True); records.append(record)
    existing = json.loads((OUTPUT/"manifest.json").read_text()) if (OUTPUT/"manifest.json").exists() else []
    updated = {record["file"]: record for record in existing+records}
    (OUTPUT/"manifest.json").write_text(json.dumps(list(updated.values()), indent=2)+"\n")
