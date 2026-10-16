"""Author CC0 textured environment miniatures; offline, reproducible Blender 4.5.

Run work/3d-converter/bin/python scripts/build-realistic-environments.py.
This module only writes env-* assets and its independent catalog/manifest.
Sources are explicitly opened with use_scripts=False, never executed.
"""
import argparse
import hashlib
import io
import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/models/realistic"
TEXTURES = ROOT / "work/environment-textures"
TERRAINS = dict(portal="传送门地表", forest="林地", desert="沙丘", hills="丘陵", swamp="沼泽", wasteland="荒地", lake="湖泊", mountain="山脉", city="城市石路")
SITES = dict(village="村庄", monastery="修道院", mageTower="法师塔", mine="水晶矿", glade="魔法林地", ruins="古代遗迹", monsterDen="怪物巢穴", tomb="古墓", spawningGrounds="怪物繁殖地", dungeon="地下城", maze="迷宫", labyrinth="深层迷宫", deepMine="深层矿井", refugeeCamp="难民营", graveyard="墓地", necropolis="墓园城", hiddenValley="隐秘山谷", volkareCamp="沃尔卡营地", city1="第一城市", city2="第二城市")
GROUND_CREDIT = dict(author="Poly Haven", title="Rocky Terrain 02", license="CC0-1.0", source="https://polyhaven.com/a/rocky_terrain_02", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/")
STONE_CREDIT = dict(author="Daniel Andersson", title="Medieval Gatehouse (stone and wood textures)", license="CC0-1.0", source="https://opengameart.org/content/medieval-gatehouse", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/")
ORIGINAL_CREDIT = dict(author="Mage Knight Solo project", title="Original modeled environment miniatures", license="CC0-1.0", source="scripts/build-realistic-environments.py", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/")
M = {}
MOBILE = False
RNG = random.Random(17)


def prepare_textures():
    TEXTURES.mkdir(parents=True, exist_ok=True)
    paths = {"stone": "StoneWall1.jpg", "wood": "Wood.jpg", "rock": "Stone.jpg"}
    if all((TEXTURES / f"{key}.jpg").exists() for key in paths):
        return
    source = next((ROOT / "work/realistic-sources/gatehouse").rglob("*.blend"))
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    for key, name in paths.items():
        image = bpy.data.images.get(name)
        if image is None or image.packed_file is None:
            raise RuntimeError(f"Missing packed licensed texture {name}")
        original = Image.open(io.BytesIO(bytes(image.packed_file.data))).convert("RGB")
        original.thumbnail((768, 768))
        original.save(TEXTURES / f"{key}.jpg", quality=90)


def material(name, color, texture=None, roughness=.8, metallic=0, normal=False):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    nodes, links = value.node_tree.nodes, value.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if texture:
        node = nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(texture), check_existing=True)
        links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    if normal:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(OUT / "ground-normal.jpg"), check_existing=True)
        tex.image.colorspace_settings.name = "Non-Color"
        convert = nodes.new("ShaderNodeNormalMap")
        links.new(tex.outputs["Color"], convert.inputs["Color"])
        links.new(convert.outputs["Normal"], bsdf.inputs["Normal"])
        rough = nodes.new("ShaderNodeTexImage")
        rough.image = bpy.data.images.load(str(OUT / "ground-roughness.jpg"), check_existing=True)
        rough.image.colorspace_settings.name = "Non-Color"
        links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    return value


def reset(seed):
    global M, RNG
    RNG = random.Random(seed)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {
        "ground": material("Rocky ground PBR · Poly Haven CC0", (.3, .28, .2), OUT / "ground-color.jpg", normal=True),
        "stone": material("Weathered masonry · Daniel Andersson CC0", (.48, .47, .42), TEXTURES / "stone.jpg"),
        "wood": material("Aged wood · Daniel Andersson CC0", (.25, .16, .09), TEXTURES / "wood.jpg"),
        "plaster": material("Aged lime plaster", (.6, .56, .42)),
        "roof": material("Weathered slate", (.16, .21, .23), TEXTURES / "rock.jpg"),
        "leaf": material("Leaf clusters", (.12, .22, .055)),
        "dark": material("Recess shadow and iron", (.038, .047, .044), roughness=.58, metallic=.15),
        "accent": material("Crystal / water", (.08, .31, .42), roughness=.22, metallic=.22),
        "rock": material("Natural fractured rock · Daniel Andersson CC0", (.4,.39,.36), TEXTURES / "rock.jpg", normal=True),
        "foliage": material("Individual curved leaves", (.13,.23,.055)),
        "cloth": material("Worn army canvas", (.22,.25,.12)),
    }
    leaves=M["foliage"]
    leaves.use_backface_culling=False
    vertex_color=leaves.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name="Leaf colors"
    leaves.node_tree.links.new(vertex_color.outputs["Color"],leaves.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])


def finish(obj, mat, bevel=0, smooth=False):
    obj.data.materials.append(M[mat])
    if bevel:
        modifier = obj.modifiers.new("Soft worn edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1 if MOBILE else 2
        modifier.affect = "EDGES"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def box(name, pos, size, mat="stone", bevel=.018, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=(0, 0, rot))
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, min(bevel, min(size)*.2))


def cylinder(name, pos, radius, height, mat="stone", vertices=None, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices or (12 if MOBILE else 20), radius1=radius, radius2=radius if top is None else top, depth=height, location=pos)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, .009, True)


def mesh(name, verts, faces, mat="stone", smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.uv_layers.new(name="UVMap")
    for loop in data.loops:
        point = data.vertices[loop.vertex_index].co
        data.uv_layers.active.data[loop.index].uv = (point.x*1.7 + point.z*.7, point.y*1.7+point.z*.9)
    finish(obj, mat, smooth=smooth)
    return obj


def tube(name, points, radii, mat="wood", sides=7):
    verts, faces = [], []
    for i, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(i+1, len(points)-1)])-Vector(points[max(0, i-1)])
        tangent.normalize()
        axis = tangent.cross(Vector((0, 1, 0)))
        if axis.length < .01:
            axis = tangent.cross(Vector((1, 0, 0)))
        axis.normalize()
        other = tangent.cross(axis).normalized()
        for side in range(sides):
            a = side/sides*math.tau
            verts.append(tuple(p+radii[i]*(math.cos(a)*axis+math.sin(a)*other)))
            if i:
                k = i*sides+side
                nxt = i*sides+(side+1)%sides
                faces.append((k-sides, nxt-sides, nxt, k))
    faces.extend([tuple(reversed(range(sides))), tuple(range((len(points)-1)*sides, len(points)*sides))])
    return mesh(name, verts, faces, mat, True)


def rock(pos, scale, mat="ground", seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1 if MOBILE else 2, radius=1, location=pos)
    obj = bpy.context.object
    obj.name = "Sculpted fractured boulder"
    for vertex in obj.data.vertices:
        co = vertex.co
        vertex.co *= 1+.18*math.sin(co.x*17+co.y*13+co.z*21+seed)
    obj.scale = scale
    finish(obj, mat, smooth=True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def hex_surface(kind="ground", relief=.025):
    rings, n = (9, 48) if MOBILE else (17, 72)
    vertices, faces = [(0, 0, .09)], []
    for ring in range(1, rings+1):
        for step in range(n):
            angle = step/n*6
            edge, frac = int(angle), angle % 1
            a, b = edge*math.pi/3+math.pi/6, (edge+1)*math.pi/3+math.pi/6
            x = .94*((1-frac)*math.cos(a)+frac*math.cos(b))*ring/rings
            y = .94*((1-frac)*math.sin(a)+frac*math.sin(b))*ring/rings
            z = .09+relief*(math.sin(x*6+y*3)*math.cos(y*8-x*3)+.2*math.sin(x*32+y*17))
            if kind == "hills":
                z += .3*math.exp(-((x+.2)**2+(y-.1)**2)*7)+.2*math.exp(-((x-.37)**2+(y+.3)**2)*16)
            if kind == "desert":
                z += .1*(math.sin(x*7+y*2)+1)*(.7+.3*math.cos(y*4))
            if kind == "mountain":
                z += .75*math.exp(-((x+.13)**2+(y-.04)**2)*9)+.52*math.exp(-((x-.4)**2+(y+.26)**2)*15)+.25*abs(math.sin(x*12+y*9))*(1-ring/rings)
            vertices.append((x, y, z))
            k = 1+(ring-1)*n+step
            nxt = 1+(ring-1)*n+(step+1)%n
            if ring == 1:
                faces.append((0, k, nxt))
            else:
                faces.extend([(k-n, k, nxt), (k-n, nxt, nxt-n)])
    surface_material = "accent" if kind == "lake" else "rock" if kind in {"mountain","wasteland"} else "ground"
    mesh("Sculpted hex terrain surface", vertices, faces, surface_material, True)
    # Seal the irregular top to its base: raised mountain/dune edges must not
    # float over the earth cut or reveal the background at grazing angles.
    rim = vertices[1+(rings-1)*n:]
    skirt = list(rim)+[(x,y,-.04) for x,y,_z in rim]
    side_faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    side_faces.append(tuple(reversed(range(n,2*n))))
    mesh("Continuous terrain edge skirt and closed base",skirt,side_faces,"rock" if kind in {"mountain","wasteland"} else "ground")


def foliage(center,scale):
    verts,faces,colors=[],[],[]
    for index in range(32 if MOBILE else 78):
        angle=RNG.random()*math.tau
        radius=RNG.random()**(1/3)
        vertical=RNG.uniform(-1,1)
        horizontal=math.sqrt(1-vertical*vertical)
        point=Vector(center)+Vector((math.cos(angle)*horizontal*scale[0],math.sin(angle)*horizontal*scale[1],vertical*scale[2]))*radius
        direction=Vector((math.cos(angle),math.sin(angle),RNG.uniform(-.3,.6))).normalized()
        side=direction.cross(Vector((0,0,1))).normalized()
        length=RNG.uniform(.04,.075)
        width=length*.36
        start=len(verts)
        verts.extend([tuple(point-direction*length*.5),tuple(point-side*width),tuple(point+Vector((0,0,.009))),tuple(point+side*width),tuple(point+direction*length*.5)])
        faces.extend([(start,start+1,start+2),(start+1,start+4,start+2),(start+4,start+3,start+2),(start+3,start,start+2)])
        shade=RNG.uniform(.72,1.2)
        colors.extend([(.1*shade,.22*shade,.035*shade,1)]*5)
    obj=mesh("Individually modeled folded leaves",verts,faces,"foliage",True)
    attribute=obj.data.color_attributes.new(name="Leaf colors",type="FLOAT_COLOR",domain="POINT")
    for i,color in enumerate(colors):
        attribute.data[i].color=color


def tree(x, y, height=.95, bare=False):
    bend = RNG.uniform(-.12, .12)
    points = [(x, y, .11), (x+.025, y, .11+height*.3), (x+bend, y+.02, .11+height*.65), (x+bend*.5, y-.03, .11+height)]
    tube("Tapered curved bark trunk", points, [height*.075, height*.06, height*.035, height*.009])
    for root in range(4):
        angle = root*math.pi/2+.3
        tube("Exposed spreading root", [(x+math.cos(angle)*height*.18,y+math.sin(angle)*height*.18,.1), (x+.02,y,.15), (x+.02,y,height*.3)], [.007,height*.045,height*.04], sides=5)
    for branch in range(4 if MOBILE else 6):
        angle = branch*2.39996
        h = height*(.43+branch*.065)
        end = (x+math.cos(angle)*height*.29, y+math.sin(angle)*height*.29, .11+h+height*.22)
        tube("Forked natural branch", [(x+bend*.5,y,.11+h), (x+math.cos(angle)*height*.14,y+math.sin(angle)*height*.14,.11+h+height*.08), end], [height*.026,height*.018,.004], sides=5)
        if not bare:
            foliage(end, (height*.23,height*.2,height*.24))
    if not bare:
        foliage((x+bend*.5,y,height+.09), (height*.2,height*.2,height*.23))


def arch(x, y, base, width, height, depth=.15, mat="stone", rotation=0):
    r = width/2
    for side in [-1, 1]:
        box("Arch pier", (x+side*(r+.07), y, base+(height-r)/2), (.14,depth,height-r), mat)
    for step in range(7 if MOBILE else 11):
        segments = 7 if MOBILE else 11
        a, b = math.pi*step/segments, math.pi*(step+1)/segments
        verts = []
        for yy in [-depth/2,depth/2]:
            for radius, angle in [(r,a),(r,b),(r+.14,b),(r+.14,a)]:
                verts.append((x+radius*math.cos(angle), y+yy, base+height-r+radius*math.sin(angle)))
        mesh("Individual arch voussoir", verts, [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)], mat)


def window(x, y, z, width=.1, height=.25):
    box("Deep window recess", (x,y,z), (width,.027,height), "dark", .007)
    for side in [-1,1]:
        box("Window jamb",(x+side*(width/2+.013),y-.013,z),(.025,.055,height+.03),"stone",.005)
    box("Carved window sill",(x,y-.025,z-height/2), (width+.07,.075,.027),"stone",.005)


def roof(x, y, width, depth, base, height=.3, mat="roof", shingles=True):
    mesh("Pitched roof main", [(x-width/2,y-depth/2,base),(x+width/2,y-depth/2,base),(x,y-depth/2,base+height),(x-width/2,y+depth/2,base),(x+width/2,y+depth/2,base),(x,y+depth/2,base+height)], [(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)], mat)
    # Individually overlapping shingle strips, modeled rather than a flat color.
    for side in [-1,1] if shingles else []:
        for row in range(3 if MOBILE else 5):
            n = 3 if MOBILE else 5
            t=(row+.5)/n
            xx=x+side*width*.5*t
            zz=base+height*(1-t)+.01
            count=4 if MOBILE else 6
            for col in range(count):
                yy=y-depth/2+depth*(col+.5)/count
                strip=box("Individual overlapping slate shingle",(xx,yy,zz+RNG.uniform(0,.004)),(width/n*.6,depth/count*.96,.023),mat,.004)
                strip.rotation_euler.y=side*math.atan2(height,width/2)
    box("Ridge weather cap",(x,y,base+height+.025),(.055,depth+.06,.055),mat if shingles else "wood",.01)


def cottage(x,y,w=.48,d=.42,h=.42):
    box("Plastered stone house",(x,y,.11+h/2),(w,d,h),"plaster")
    box("Stone foundation",(x,y,.14),(w+.035,d+.035,.12),"stone")
    roof(x,y,w+.11,d+.11,.11+h,.23)
    for side in [-1,1]:
        box("Oak corner post",(x+side*w*.47,y-d/2-.012,.11+h/2),(.035,.035,h),"wood",.006)
    box("Oak crossbeam",(x,y-d/2-.014,.11+h*.65),(w,.035,.03),"wood",.004)
    box("Plank door",(x-.08,y-d/2-.021,.25),(.12,.035,.26),"wood",.005)
    window(x+.12,y-d/2-.023,.38,.1,.14)
    box("Chimney",(x+w*.28,y+.05,.11+h+.18),(.09,.1,.35),"stone",.008)


def tower(x,y,r=.23,h=.95,point=True):
    cylinder("Stone tower shaft",(x,y,.11+h/2),r,h)
    for level in range(3):
        cylinder("Tower cornice",(x,y,.16+level*h*.32),r+.018,.045)
    # Broken masonry joints produce real surface depth, not one smooth cylinder.
    for level in range(3 if MOBILE else 5):
        for j in range(6 if MOBILE else 9):
            a=j/(6 if MOBILE else 9)*math.tau+level*.25
            box("Weathered facing block",(x+math.cos(a)*r*.97,y+math.sin(a)*r*.97,.24+level*h*.15),(.13,.05,.09),"stone",.008,rot=a+math.pi/2)
    window(x,y-r-.015,.11+h*.5,.09,.23)
    if point:
        cylinder("Conical slate roof",(x,y,.11+h+.22),r+.07,.48,"roof",16 if MOBILE else 24,top=.015)
        cylinder("Roof finial",(x,y,.11+h+.49),.022,.13,"dark",8,top=.006)
    else:
        cylinder("Tower parapet",(x,y,.11+h),r+.035,.12)
        for j in range(8):
            a=j*math.pi/4
            box("Crenellation",(x+math.cos(a)*r,y+math.sin(a)*r,.11+h+.1),(.1,.11,.14),"stone",.012,a)


def tent(x,y,w=.4,d=.45,h=.35,mat="plaster"):
    roof(x,y,w,d,.12,h,mat,shingles=False)
    box("Tent entrance shadow",(x,y-d/2-.012,.12+h*.32),(.11,.02,h*.55),"dark",.002)
    for side in [-1,1]:
        tube("Tent rope",[(x,y,.12+h+.015),(x+side*w*.75,y-d*.65,.1)],[.004,.004],"wood",4)


def rubble(count=7, area=.7, mat="stone"):
    for i in range(count):
        angle=i*2.39996
        radius=area*math.sqrt((i+.5)/count)
        rock((math.cos(angle)*radius,math.sin(angle)*radius,.12),(.07+RNG.random()*.05,.045+RNG.random()*.07,.04+RNG.random()*.06),mat,i)


def stairs(x,y,steps=6,width=.4):
    for i in range(steps):
        box("Worn stair tread",(x,y+i*.065,.11+(i+1)*.025),(width,.08,(i+1)*.05),"stone",.01)


def wall(x,y,w=.8,h=.6):
    box("Mortar wall core",(x,y,.11+h/2),(w,.13,h),"dark",.005)
    n=4 if MOBILE else 6
    rows=4 if MOBILE else 6
    for row in range(rows):
        for col in range(n):
            xx=x-w/2+w*(col+.5)/n
            if row%2:
                xx+=w/n*.2
            box("Coursed worn masonry block",(xx,y-.025,.11+(row+.5)*h/rows),(w/n*.94,.155,h/rows*.9),"stone",.008)
    box("Coping stone",(x,y,.11+h+.02),(w+.04,.19,.06),"stone",.014)


def altar(x=0,y=0):
    for level in range(3):
        box("Stepped ritual plinth",(x,y,.13+level*.055),(.55-level*.1,.45-level*.08,.07),"stone",.012)
    cylinder("Carved altar basin",(x,y,.35),.18,.14,"stone",12)
    rock((x,y,.46),(.07,.065,.15),"accent",3)


def build_terrain(key):
    if key=="desert":
        M["ground"].node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.6,.39,.14,1)
        links=M["ground"].node_tree.links
        for link in list(links):
            if link.to_socket.name=="Base Color":
                links.remove(link)
    if key=="swamp":
        M["accent"].node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.12,.18,.09,1)
    hex_surface(key, .005 if key=="lake" else .025)
    if key=="forest":
        for x,y,h in [(-.35,.25,.85),(.23,.27,1.0),(-.1,-.3,.88),(.43,-.22,.72)]:
            tree(x,y,h)
        rubble(5,.7,"ground")
    elif key=="portal":
        for i in range(3):
            cylinder("Ancient stone portal dais",(0,0,.15+i*.055),.52-i*.07,.07,"stone",24)
        arch(0,0,.26,.5,.95,.18)
        rock((0,0,.8),(.13,.075,.3),"accent",5)
        for side in [-1,1]:
            cylinder("Portal obelisk",(side*.53,.18,.4),.09,.55,"stone",6,top=.065)
    elif key=="hills":
        rubble(9,.75,"ground")
        tree(-.45,.3,.45)
    elif key=="mountain":
        for i in range(6):
            a=i*2.4
            rock((math.cos(a)*.5,math.sin(a)*.5,.24),(.18,.2,.28),"rock",i)
    elif key=="swamp":
        for x,y in [(-.35,.18),(.27,.27)]:
            rock((x,y,.08),(.32,.27,.025),"accent",3)
            tree(x+.05,y,.6,True)
        for i in range(12):
            a=i*2.4; x,y=math.cos(a)*.65,math.sin(a)*.65
            tube("Bent marsh reed",[(x,y,.12),(x+.03,y,.26),(x+.05,y+.02,.31)],[.006,.004,.002],"leaf",4)
    elif key=="wasteland":
        rubble(16,.72,"rock")
        tree(.32,.15,.57,True)
        for i in range(4):
            a=i*.8
            tube("Exposed fractured seam",[(-.4+i*.15,-.55,.12),(-.28+i*.12,-.1,.125),(-.3+i*.15,.5,.12)],[.009,.006,.004],"dark",3)
    elif key=="lake":
        for i in range(5):
            a=i*1.1
            rock((math.cos(a)*.72,math.sin(a)*.72,.1),(.15,.12,.1),"ground",i)
        for i in range(5):
            points=[(.2+math.cos(t/20*math.pi)*(.22+i*.065),-.05+math.sin(t/20*math.pi)*(.12+i*.035),.123+i*.001) for t in range(21)]
            tube("Water ripple crest",points,[.003]*21,"accent",3)
    elif key=="city":
        for row in range(9):
            for col in range(8):
                x=(col-3.5)*.16+(row%2)*.035;y=(row-4)*.14
                if x*x+y*y<.63:
                    box("Uneven cobblestone paving",(x,y,.12+RNG.random()*.012),(.15,.13,.035),"stone",.011)
    elif key=="desert":
        for i in range(4):
            rock((-.5+i*.3,.33,.18),(.07,.08,.07),"stone",i)


def build_site(key):
    # Every site has its own recognisable silhouette and modeled function.
    if key=="village":
        cottage(-.26,.19,.43,.4,.4);cottage(.28,.15,.37,.34,.32)
        cylinder("Village well curb",(.05,-.35,.23),.13,.25,"stone",12)
        for s in [-1,1]:box("Well roof post",(.05+s*.13,-.35,.49),(.025,.03,.49),"wood",.005)
        roof(.05,-.35,.38,.3,.69,.15)
        tree(-.5,-.28,.47)
    elif key=="monastery":
        box("Abbey nave",(0,.1,.42),(.56,.78,.62),"stone")
        roof(0,.1,.65,.87,.73,.35)
        tower(-.37,-.16,.15,1.1)
        for x in [-.17,.17]:window(x,-.3,.51,.11,.28)
        box("Abbey portal",(0,-.312,.27),(.18,.03,.31),"wood",.008)
        arch(0,-.34,.12,.18,.34,.07)
        stairs(0,-.68,4,.3)
        box("Cloister cross vertical",(0,-.1,1.2),(.035,.04,.19),"dark",.006)
        box("Cloister cross horizontal",(0,-.1,1.23),(.14,.04,.03),"dark",.004)
    elif key=="mageTower":
        tower(0,0,.25,1.3)
        for i in range(5):
            a=i*math.tau/5
            rock((math.cos(a)*.39,math.sin(a)*.39,.22),(.09,.08,.2),"accent",i)
        stairs(0,-.6,6,.26)
        cylinder("Observatory ring",(0,0,1.18),.32,.06,"accent",20)
    elif key in {"mine","deepMine"}:
        deep=key=="deepMine"
        rock((0,.16,.28),(.68,.43,.42 if deep else .35),"rock",4)
        box("Deep black tunnel entrance",(0,-.23,.28),(.31,.03,.34),"dark",.018)
        for s in [-1,1]:box("Mine pit prop",(s*.19,-.28,.3),(.07,.09,.43),"wood",.009)
        box("Mine entrance header",(0,-.28,.5),(.5,.1,.07),"wood",.009)
        for x in [-.095,.095]:box("Mine cart rail",(x,-.5,.12),(.016,.6,.022),"dark",.003)
        for y in [-.7,-.55,-.4]:box("Rail sleeper",(0,y,.11),(.32,.04,.025),"wood",.004)
        for i in range(5):
            cylinder("Crystal cluster",(.3+i*.04,-.3+(i%2)*.12,.22+i*.025),.035,.22+i*.035,"accent",5,top=0)
        if deep:
            for x in [-.3,.3]:box("Mine hoist mast",(x,.26,.7),(.06,.06,1.2),"wood",.008)
            box("Headframe top",(0,.26,1.23),(.75,.1,.1),"wood",.01)
            cylinder("Winch drum",(0,.26,1.1),.12,.27,"dark",16)
    elif key=="glade":
        for i in range(3):
            a=i*math.tau/3+.2;tree(math.cos(a)*.5,math.sin(a)*.5,.9)
        rock((0,0,.15),(.28,.22,.09),"accent",2)
        for i in range(5):
            a=i*math.tau/5
            rock((math.cos(a)*.27,math.sin(a)*.27,.18),(.06,.06,.08),"stone",i)
    elif key=="ruins":
        for x in [-.36,.36]:
            cylinder("Fluted ruined column base",(x,.05,.18),.17,.13,"stone",16)
            cylinder("Broken classical column",(x,.05,.4),.1,.43 if x<0 else .65,"stone",16)
            for j in range(8):
                a=j*math.pi/4
                tube("Column vertical fluting",[(x+.1*math.cos(a),.05+.1*math.sin(a),.2),(x+.1*math.cos(a),.05+.1*math.sin(a),.58)],[.009,.009],"stone",4)
        wall(0,.4,.85,.32)
        altar(0,-.18);rubble(10,.68)
    elif key in {"monsterDen","spawningGrounds"}:
        for i in range(7):
            a=math.pi*i/6
            rock((math.cos(a)*.4,.05+math.sin(a)*.18,.32+math.sin(a)*.25),(.23,.22,.26),"rock",i)
        box("Cavern opening darkness",(0,-.1,.23),(.35,.03,.29),"dark",.02)
        if key=="spawningGrounds":
            for i in range(7):
                a=i*2.4
                rock((math.cos(a)*.3,-.28+math.sin(a)*.2,.16),(.055,.07,.11),"accent",i)
        else:
            for side in [-1,1]:tube("Entrance fang bone",[(side*.2,-.18,.14),(side*.17,-.18,.31),(side*.12,-.17,.37)],[.035,.025,.001],"plaster",6)
        rubble(7,.72,"ground")
    elif key=="tomb":
        box("Tomb dais",(0,0,.15),(1,.75,.13),"stone")
        box("Sarcophagus casket",(0,.05,.34),(.35,.58,.28),"stone")
        box("Bevelled sarcophagus lid",(0,.05,.51),(.41,.64,.1),"stone",.035)
        for x in [-.37,.37]:cylinder("Crypt pillar",(x,.23,.48),.08,.65,"stone",10)
        arch(0,.24,.2,.55,.65,.15)
        stairs(0,-.61,5,.55)
    elif key=="dungeon":
        wall(0,.2,1,.65)
        box("Dungeon doorway shadow",(0,.09,.32),(.28,.035,.42),"dark")
        arch(0,.035,.11,.3,.5,.16)
        for x in [-.1,0,.1]:box("Dungeon iron grate",(x,-.055,.32),(.017,.02,.4),"dark",.003)
        stairs(0,-.49,5,.46)
        rubble(7,.7)
    elif key in {"maze","labyrinth"}:
        box("Ancient maze platform",(0,0,.13),(1.37,1.35,.1),"stone")
        # Distinct winding passages, physically modeled with walkable gaps.
        segments=[(-.6,0,.06,1.15),(.6,.12,.06,.95),(0,.57,1.2,.06),(-.15,-.57,.9,.06),(-.3,.08,.06,.7),(.15,-.12,.06,.62),(.3,.27,.6,.06),(-.14,-.25,.34,.06)]
        for x,y,w,d in segments:
            box("Weathered maze wall",(x,y,.33),(w,d,.35 if key=="maze" else .5),"leaf" if key=="maze" else "stone",.014)
        if key=="labyrinth":
            for x in [-.6,.6]:cylinder("Labyrinth corner column",(x,.57,.49),.085,.7,"stone",10)
            altar(.34,-.34)
    elif key in {"refugeeCamp","volkareCamp"}:
        for x,y,s in [(-.36,.18,.85),(.32,.22,.8),(0,-.31,1)]:
            tent(x,y,.42*s,.42*s,.37*s,"cloth" if key=="volkareCamp" else "plaster")
        for i in range(7):
            a=i*math.tau/7
            rock((.13+math.cos(a)*.08,-.03+math.sin(a)*.08,.13),(.025,.025,.022),"stone",i)
        if key=="volkareCamp":
            for i in range(13):
                a=i*math.pi/12
                cylinder("Sharpened palisade stake",(math.cos(a)*.71,math.sin(a)*.65,.31),.025,.43,"wood",5,top=0)
            box("War banner pole",(.5,-.35,.65),(.025,.025,1.08),"wood",.004)
            mesh("Hanging command banner",[(.5,-.35,1.16),(.78,-.35,1.13),(.76,-.35,.87),(.61,-.35,.81),(.5,-.35,.9)],[(0,1,2,3,4)],"accent")
    elif key in {"graveyard","necropolis"}:
        for i in range(7):
            x=(i%3-1)*.27;y=(i//3-1)*.28
            box("Grave mound",(x,y,.115),(.18,.29,.04),"ground",.018)
            stone=box("Weathered gravestone",(x,y+.08,.26),(.12,.055,.26),"stone",.027)
            stone.rotation_euler.y=(i%3-1)*.1
        wall(0,.55,1.2,.24)
        if key=="necropolis":
            box("Necropolis mausoleum",(0,.2,.48),(.46,.49,.62),"stone")
            roof(0,.2,.59,.6,.8,.25)
            arch(0,-.055,.14,.2,.43,.1)
            for x in [-.5,.5]:tower(x,.36,.105,.75)
        else:
            tree(-.53,.32,.75,True)
    elif key=="hiddenValley":
        for s in [-1,1]:
            rock((s*.47,.12,.3),(.25,.59,.39),"ground",int(s)+2)
            tree(s*.46,.25,.63)
        tube("Winding valley spring",[(-.05,-.63,.115),(.09,-.2,.12),(-.05,.19,.13),(.1,.55,.15)],[.065,.07,.04,.025],"accent",8)
        cottage(-.2,-.18,.27,.27,.25)
    elif key in {"city1","city2"}:
        # Citadel and a walled trade city have different skylines and footprints.
        for x,y,w,d,h in [(-.24,.03,.3,.35,.47),(.24,.09,.32,.32,.55),(0,.4,.42,.3,.68)]:
            cottage(x,y,w,d,h)
        wall(0,-.48,1.16,.38)
        arch(0,-.58,.11,.22,.38,.14)
        if key=="city1":
            tower(-.5,-.38,.14,.75,False);tower(.5,-.38,.14,.75,False)
            tower(0,.28,.18,1.16)
        else:
            tower(-.49,-.38,.13,.82);tower(.49,-.38,.13,.82)
            box("Great civic hall",(0,.32,.74),(.49,.33,.48),"plaster")
            roof(0,.32,.62,.45,.98,.36)
            cylinder("Council dome drum",(0,.32,1.24),.14,.13,"stone",16)
            rock((0,.32,1.34),(.19,.19,.18),"roof",4)


def pack_glb(path):
    data=path.read_bytes()
    size=int.from_bytes(data[12:16],"little")
    doc=json.loads(data[20:20+size])
    raw=data[28+size:]
    images={item["bufferView"]:item for item in doc.get("images",[]) if "bufferView" in item}
    blob=bytearray()
    for index,view in enumerate(doc.get("bufferViews",[])):
        start=view.get("byteOffset",0)
        content=raw[start:start+view["byteLength"]]
        if index in images:
            image=Image.open(io.BytesIO(content)).convert("RGB")
            image.thumbnail((512 if MOBILE else 768,)*2)
            encoded=io.BytesIO()
            image.save(encoded,format="JPEG",quality=88,subsampling=0)
            content=encoded.getvalue()
            images[index]["mimeType"]="image/jpeg"
        blob.extend(b"\0"*((4-len(blob)%4)%4))
        view["byteOffset"]=len(blob);view["byteLength"]=len(content)
        blob.extend(content)
    doc["buffers"][0]["byteLength"]=len(blob)
    blob.extend(b"\0"*((4-len(blob)%4)%4))
    doc["asset"]["copyright"]="Original environment meshes: Mage Knight Solo project, CC0-1.0. Ground PBR: Poly Haven, CC0-1.0. Stone/wood textures: Daniel Andersson, CC0-1.0."
    payload=json.dumps(doc,separators=(",",":")).encode()
    payload+=b" "*((4-len(payload)%4)%4)
    result=b"glTF"+(2).to_bytes(4,"little")+(28+len(payload)+len(blob)).to_bytes(4,"little")+len(payload).to_bytes(4,"little")+b"JSON"+payload+len(blob).to_bytes(4,"little")+b"BIN\0"+blob
    path.write_bytes(result)
    triangles=sum(doc["accessors"][p["indices"]]["count"]//3 for model in doc["meshes"] for p in model["primitives"])
    primitives=sum(len(model["primitives"]) for model in doc["meshes"])
    record=dict(file=path.name,bytes=len(result),triangles=triangles,primitives=primitives,sha256=hashlib.sha256(result).hexdigest(),animations=[])
    if primitives>10 or triangles>(11000 if MOBILE else 25000) or len(result)>(2_000_000 if MOBILE else 5_000_000):
        raise RuntimeError(f"Environment asset exceeds budget: {record}")
    return record


def export(kind,key,mobile):
    global MOBILE
    MOBILE=mobile
    reset(sum(map(ord,key)))
    if kind=="terrain":
        build_terrain(key)
    else:
        build_site(key)
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type=="MESH")
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=f"{kind} {key} · authored textured miniature"
    # Merge objects/material references into <=8 draw calls; all UVs are baked.
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.calc_loop_triangles()
    triangle_count = len(obj.data.loop_triangles)
    limit = 10000 if mobile else 23000
    if triangle_count > limit:
        modifier = obj.modifiers.new("Bounded architectural detail LOD", "DECIMATE")
        modifier.ratio = limit/triangle_count
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    path=OUT/f'env-{kind}-{key}{"-mobile" if mobile else ""}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_image_format="AUTO",export_extras=False)
    return pack_glb(path)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--only",help="Generate a single terrain/site key")
    parser.add_argument("--kind",choices=["terrain","site"],help="Generate just one asset category")
    args=parser.parse_args()
    prepare_textures()
    records=[];catalog=[]
    for kind,entries in [("terrain",TERRAINS),("site",SITES)]:
        if args.kind and args.kind != kind:
            continue
        for key,label in entries.items():
            if args.only and key!=args.only:
                continue
            for mobile in [False,True]:
                record=export(kind,key,mobile)
                print("ENV_ASSET",json.dumps(record),flush=True)
                records.append(record)
            catalog.append(dict(id=f"env-{kind}-{key}",kind=kind,key=key,label=label,file=f"env-{kind}-{key}.glb",mobile=f"env-{kind}-{key}-mobile.glb",credits=[ORIGINAL_CREDIT,GROUND_CREDIT,STONE_CREDIT],modifications="Original detailed beveled mesh with modeled architectural detail/vegetation; CC0 source stone, wood and ground PBR textures; mobile LOD and JPEG packing. Static environment model, not an official Mage Knight asset."))
    for filename,items,item_key in [("env-manifest.json",records,"file"),("env-catalog.json",catalog,"id")]:
        path=OUT/filename
        existing=json.loads(path.read_text()) if path.exists() else []
        merged={item[item_key]:item for item in existing+items}
        path.write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":
    main()
