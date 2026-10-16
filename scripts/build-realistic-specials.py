"""Original detailed fantasy miniatures, not official or AAA character art.

Offline authoring: work/3d-converter/bin/python scripts/build-realistic-specials.py
No source blend scripts are executed. Organic lofts, fitted armor, feathers,
serpent scales, facial detail and siege joinery are authored here, not ModelKit.
Only special-* files are written; app mappings and the main manifest are untouched.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/models/realistic"
WORK = ROOT / "work/special-textures"
NAMES = {
    "hydra": "多头蛇", "medusa": "美杜莎", "centaur": "半人马",
    "griffon": "狮鹫", "manticore": "蝎尾狮", "crypt-worm": "墓穴蠕虫",
    "spirit": "幽魂", "air-elemental": "风元素", "fire-elemental": "火元素",
    "water-elemental": "水元素", "earth-elemental": "土元素",
    "catapult": "投石车", "siege": "攻城器械", "mummy": "木乃伊",
    "sprite": "水晶精灵",
}
CREDIT = dict(author="Mage Knight Solo project", title="Original anatomically themed fantasy miniature meshes and PBR surface textures", license="CC0-1.0", source="scripts/build-realistic-specials.py", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/")
ELF_CREDIT = dict(author="Contmike, Danimal; bow Yd; hair MajorNightmare", title="Elf - game ready and animated", license="CC-BY-SA-3.0", source="https://opengameart.org/content/elf-game-ready-and-animated", licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/")
MALE_CREDIT = dict(author="thecubber; rig Julius; commissioned by the OpenGameArt.org community", title="Rigged textured elven archer", license="CC-BY-SA-3.0", source="https://opengameart.org/content/rigged-textured-elven-archer", licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/")
MOBILE = False
BUILDERS = {}
MATERIALS = {}


def texture_images():
    """Deterministic original textures; no copyrighted internet textures required."""
    WORK.mkdir(parents=True, exist_ok=True)
    palettes = {
        "scale": ((49, 73, 43), (88, 107, 62)),
        "fur": ((68, 42, 22), (134, 98, 47)),
        "feather": ((72, 64, 44), (183, 166, 117)),
        "skin": ((135, 96, 70), (192, 148, 113)),
        "steel": ((64, 73, 77), (129, 137, 139)),
        "bone": ((127, 115, 81), (227, 218, 178)),
        "linen": ((107, 94, 68), (192, 180, 140)),
        "wood": ((56, 35, 18), (132, 89, 42)),
        "stone": ((66, 69, 59), (137, 133, 105)),
        "spirit": ((51, 74, 84), (136, 174, 176)),
        "fire": ((109, 23, 7), (248, 160, 31)),
        "water": ((17, 63, 81), (100, 173, 184)),
        "dark": ((12, 16, 14), (37, 41, 33)),
        "gold": ((88, 54, 11), (202, 153, 58)),
    }
    revision=WORK/"revision.txt"
    current=revision.exists() and revision.read_text()=="2\n"
    for key, (low, high) in palettes.items():
        path = WORK / f"{key}.jpg"
        normalpath = WORK / f"{key}-normal.jpg"
        if current and path.exists() and normalpath.exists():
            continue
        size = 512
        image = Image.new("RGB", (size, size)); pixels = image.load()
        normal = Image.new("RGB", (size, size)); normalpixels = normal.load()
        for y in range(size):
            for x in range(size):
                grain = (math.sin(x*1.7+y*7.9)*math.sin(x*.31-y*1.13)+1)*.5
                wave = .5+.15*math.sin(x*.049+y*.019)+.1*math.sin(x*.113-y*.043)
                if key == "scale":
                    sx = (x+(y//24%2)*16)%32/32; sy = y%24/24
                    ridge = math.sin(math.pi*sx)*math.sin(math.pi*sy)
                    wave = .18+.65*ridge+grain*.12
                elif key in {"fur", "feather", "wood", "linen"}:
                    wave = .35+.2*math.sin(x*.38+math.sin(y*.031)*2)+.1*math.sin(x*1.3+y*.031)+grain*.18
                    if key == "linen": wave += .12*math.sin(y*1.1)
                    if key == "fur": wave = .38+.055*math.sin(x*2.7+math.sin(y*.019)*3)+grain*.19+.03*math.sin(y*.11)
                elif key == "fire": wave = .5+.3*math.sin(x*.07+math.sin(y*.023)*4)+grain*.12
                elif key == "stone": wave = .38+.2*math.sin(x*.17)*math.cos(y*.11)+grain*.25
                wave = max(0, min(1, wave))
                pixels[x, y] = tuple(round(a+(b-a)*wave) for a, b in zip(low, high))
                normalpixels[x, y] = (round(128+math.sin(x*1.7+y*.43)*7), round(128+math.cos(y*1.31-x*.47)*7), 254)
        image.save(path, quality=88); normal.save(normalpath, quality=88)
    revision.write_text("2\n")


def material(key):
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Roughness"].default_value = .38 if key in {"steel", "gold", "water"} else .82
    node.inputs["Metallic"].default_value = .72 if key in {"steel", "gold"} else .05
    color = mat.node_tree.nodes.new("ShaderNodeTexImage")
    color.image = bpy.data.images.load(str(WORK / f"{key}.jpg"), check_existing=True)
    mat.node_tree.links.new(color.outputs["Color"], node.inputs["Base Color"])
    normal = mat.node_tree.nodes.new("ShaderNodeTexImage")
    normal.image = bpy.data.images.load(str(WORK / f"{key}-normal.jpg"), check_existing=True)
    normal.image.colorspace_settings.name = "Non-Color"
    convert = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    convert.inputs["Strength"].default_value = .55
    mat.node_tree.links.new(normal.outputs["Color"], convert.inputs["Color"])
    mat.node_tree.links.new(convert.outputs["Normal"], node.inputs["Normal"])
    if key in {"fire", "spirit", "water"}:
        mat.node_tree.links.new(color.outputs["Color"], node.inputs["Emission Color"])
        node.inputs["Emission Strength"].default_value = .22 if key == "fire" else .055
    mat.use_backface_culling = False
    return mat


class Geometry:
    def __init__(self, key):
        self.key = key; self.vertices = []; self.faces = []; self.uvs = []

    def add(self, vertices, faces, uvs=None):
        start = len(self.vertices); self.vertices.extend(vertices)
        self.faces.extend(tuple(start+i for i in face) for face in faces)
        self.uvs.extend(uvs or [(p[0]*1.5+p[2]*.2, p[1]*1.5+p[2]*.8) for p in vertices])

    def finish(self):
        data = bpy.data.meshes.new(self.key); data.from_pydata(self.vertices, [], self.faces); data.update()
        obj = bpy.data.objects.new(self.key, data); bpy.context.collection.objects.link(obj)
        data.materials.append(MATERIALS[self.key]); uv = data.uv_layers.new(name="UVMap")
        for loop in data.loops: uv.data[loop.index].uv = self.uvs[loop.vertex_index]
        for poly in data.polygons: poly.use_smooth = self.key not in {"wood", "stone", "steel"}
        return obj


def geom(key):
    if key not in BUILDERS:
        BUILDERS[key] = Geometry(key); MATERIALS[key] = material(key)
    return BUILDERS[key]


def catmull(points, radii, steps):
    output, sizes = [], []
    for i in range(len(points)-1):
        p0, p1 = Vector(points[max(0, i-1)]), Vector(points[i])
        p2, p3 = Vector(points[i+1]), Vector(points[min(len(points)-1, i+2)])
        for j in range(steps):
            t = j/steps
            output.append((2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)*.5)
            a = radii[i] if isinstance(radii[i], tuple) else (radii[i], radii[i])
            b = radii[i+1] if isinstance(radii[i+1], tuple) else (radii[i+1], radii[i+1])
            sizes.append((a[0]*(1-t)+b[0]*t, a[1]*(1-t)+b[1]*t))
    output.append(Vector(points[-1])); last = radii[-1]
    sizes.append(last if isinstance(last, tuple) else (last, last))
    return output, sizes


def tube(points, radii, key="scale", sides=None, steps=None, ripple=0):
    sides = sides or (9 if MOBILE else 14); steps = steps or (2 if MOBILE else 4)
    centers, sizes = catmull(points, radii, steps)
    vertices, faces, uvs = [], [], []
    for i, (center, size) in enumerate(zip(centers, sizes)):
        tangent = (centers[min(i+1, len(centers)-1)]-centers[max(0, i-1)]).normalized()
        normal = tangent.cross(Vector((0, 1, 0)))
        if normal.length < .02: normal = tangent.cross(Vector((1, 0, 0)))
        normal.normalize(); other = tangent.cross(normal).normalized()
        for j in range(sides+1):
            a = j/sides*math.tau; detail = 1+ripple*math.sin(i*2.7+j*.7)
            vertices.append(tuple(center+normal*math.cos(a)*size[0]*detail+other*math.sin(a)*size[1]*detail))
            uvs.append((j/sides*2, i/max(1, len(centers)-1)*3))
            if i and j:
                end = i*(sides+1)+j; faces.append((end-sides-2, end-sides-1, end, end-1))
    faces.extend([tuple(reversed(range(sides))), tuple((len(centers)-1)*(sides+1)+j for j in range(sides))])
    geom(key).add(vertices, faces, uvs)


def ellipsoid(center, scale, key="fur", rotation=0, sculpt=0, sectors=None, rings=None):
    sectors = sectors or (12 if MOBILE else 20); rings = rings or (7 if MOBILE else 12)
    vertices, faces, uvs = [], [], []
    for i in range(rings+1):
        latitude = i/rings*math.pi
        for j in range(sectors+1):
            a = j/sectors*math.tau
            detail = 1+sculpt*math.sin(latitude*8+a*3)*math.sin(latitude)
            x = math.sin(latitude)*math.cos(a)*scale[0]*detail
            y = math.sin(latitude)*math.sin(a)*scale[1]*detail
            z = math.cos(latitude)*scale[2]*detail
            vertices.append((center[0]+x*math.cos(rotation)-y*math.sin(rotation), center[1]+x*math.sin(rotation)+y*math.cos(rotation), center[2]+z))
            uvs.append((j/sectors, i/rings))
            if i and j:
                end = i*(sectors+1)+j; faces.append((end-sectors-2, end-sectors-1, end, end-1))
    geom(key).add(vertices, faces, uvs)


def box(center, scale, key="wood", rotation=0):
    verts = []
    for z in [-1, 1]:
        for y in [-1, 1]:
            for x in [-1, 1]:
                vx, vy = x*scale[0]/2, y*scale[1]/2
                verts.append((center[0]+vx*math.cos(rotation)-vy*math.sin(rotation), center[1]+vx*math.sin(rotation)+vy*math.cos(rotation), center[2]+z*scale[2]/2))
    geom(key).add(verts, [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])


def horn(points, base=.045, key="bone"):
    tube(points, [base*(1-i/(len(points)-1))+.0005 for i in range(len(points))], key, sides=6 if MOBILE else 9)


def eyes(center, width, facing=-1, key="gold"):
    for side in [-1, 1]:
        point = (center[0]+side*width, center[1], center[2])
        ellipsoid(point, (.025, .014, .023), key, sectors=9, rings=5)
        ellipsoid((point[0], point[1]+facing*.012, point[2]), (.009, .006, .016), "dark", sectors=8, rings=4)


def reptile_head(center, size=.19, angle=0):
    x, y, z = center
    ellipsoid((x,y,z), (size*.76,size,size*.62), "scale", rotation=angle, sculpt=.065)
    ellipsoid((x,y-size*.8,z-size*.16), (size*.62,size*.79,size*.3), "scale", rotation=angle)
    ellipsoid((x,y-size*.87,z-size*.36), (size*.53,size*.65,size*.1), "dark", rotation=angle)
    ellipsoid((x,y-size*.8,z-size*.44), (size*.59,size*.72,size*.13), "scale", rotation=angle)
    eyes((x,y-size*.6,z+size*.21),size*.58)
    for side in [-1,1]:
        horn([(x+side*size*.6,y+.02,z+size*.23),(x+side*size*.86,y+.08,z+size*.65),(x+side*size*.9,y+.12,z+size*.95)],size*.16)
        for i in range(3):
            xx=x+side*size*.48; yy=y-size*(.6+i*.3)
            horn([(xx,yy,z-size*.28),(xx,yy,z-size*.55)],size*.065)


def quadruped(key="fur", horse=False):
    tube([(0,.52,.64),(0,.28,.76),(0,-.15,.75),(0,-.46,.76)],[(.19,.23),(.29,.29),(.27,.28),(.2,.23)],key,steps=4,ripple=.018)
    for side in [-1,1]:
        for front in [-1,1]:
            y=-.36 if front<0 else .37; x=side*.2
            tube([(x,y,.7),(x+side*.035,y+front*.02,.44),(x+side*.01,y-front*.07,.21),(x+side*.015,y-.03,.08)],[(.12,.15),(.068,.076),(.042,.046),(.046,.05)],key)
            ellipsoid((x+side*.015,y-.075,.065),(.065,.1,.065),"dark" if horse else key, sectors=10,rings=6)
            if not horse:
                for toe in range(3): horn([(x+(toe-1)*.035,y-.13,.07),(x+(toe-1)*.035,y-.2,.05)],.013)


def human_head(origin, female=False, skin="skin", size=1):
    x,y,z=origin
    tube([(x,y,z-.12*size),(x,y,z-.04*size),(x,y,z+.06*size),(x,y,z+.16*size)],[(.055*size,.06*size),(.083*size,.068*size),(.105*size,.088*size),(.06*size,.06*size)],skin,sides=12 if MOBILE else 18,steps=3)
    ellipsoid((x,y-.065*size,z+.015*size),(.062*size,.038*size,.06*size),skin,sectors=12,rings=7)
    tube([(x,y-.083*size,z+.07*size),(x,y-.112*size,z+.015*size),(x,y-.103*size,z-.01*size)],[.015*size,.022*size,.014*size],skin,sides=7,steps=2)
    for side in [-1,1]:
        ellipsoid((x+side*.043*size,y-.075*size,z+.045*size),(.024*size,.015*size,.011*size),"bone",sectors=8,rings=4)
        ellipsoid((x+side*.043*size,y-.087*size,z+.045*size),(.008*size,.006*size,.01*size),"dark",sectors=8,rings=4)
        tube([(x+side*.02*size,y-.086*size,z+.07*size),(x+side*.068*size,y-.068*size,z+.073*size)],[.009*size,.008*size],"dark",sides=5,steps=2)
        ellipsoid((x+side*.1*size,y,z+.025*size),(.025*size,.026*size,.04*size),skin,sectors=8,rings=5)
    tube([(x-.035*size,y-.088*size,z-.033*size),(x,y-.102*size,z-.04*size),(x+.035*size,y-.088*size,z-.033*size)],[.006*size,.008*size,.005*size],"dark",sides=5,steps=2)
    if female:
        for side in [-1,1]:
            tube([(x+side*.035*size,y+.03*size,z+.16*size),(x+side*.1*size,y+.045*size,z+.1*size),(x+side*.115*size,y+.05*size,z-.11*size)],[.055*size,.048*size,.025*size],"dark")


def human_upper(origin=(0,0,.8), female=False, armor="steel", arms=True, size=1):
    x,y,z=origin
    tube([(x,y,z),(x,y,z+.13*size),(x,y,z+.31*size),(x,y,z+.42*size)],[(.14*size,.1*size),(.115*size,.09*size),(.19*size,.11*size),(.17*size,.09*size)],armor,sides=12 if MOBILE else 18,steps=3)
    # Fitted articulated cuirass, collar, belt and overlapping hip plates.
    for side in [-1,1]:
        ellipsoid((x+side*.075*size,y-.055*size,z+.29*size),(.09*size,.075*size,.105*size),armor,sculpt=.015)
        tube([(x+side*.08*size,y-.075*size,z+.17*size),(x+side*.1*size,y-.07*size,z+.04*size),(x+side*.17*size,y-.055*size,z-.05*size)],[.035*size,.037*size,.04*size],armor,sides=6)
    tube([(x,y,z+.41*size),(x,y,z+.51*size)],[.065*size,.06*size],"skin",sides=10,steps=2)
    human_head((x,y-.01*size,z+.59*size),female,size=size)
    tube([(x-.14*size,y-.083*size,z+.08*size),(x,y-.105*size,z+.07*size),(x+.14*size,y-.083*size,z+.08*size)],[.018*size,.02*size,.018*size],"gold",sides=6)
    if arms:
        for side in [-1,1]:
            tube([(x+side*.18*size,y,z+.39*size),(x+side*.27*size,y-.01*size,z+.22*size),(x+side*.33*size,y-.18*size,z+.32*size)],[(.07*size,.075*size),(.047*size,.052*size),(.035*size,.037*size)],armor)
            ellipsoid((x+side*.335*size,y-.19*size,z+.33*size),(.039*size,.046*size,.05*size),"skin",sectors=10,rings=6)


def feather(start, end, width, key="feather"):
    start,end=Vector(start),Vector(end); direction=(end-start).normalized()
    side=direction.cross(Vector((0,0,1)))
    if side.length<.01: side=direction.cross(Vector((0,1,0)))
    side.normalize(); verts=[]; faces=[]; uvs=[]
    cuts=4 if MOBILE else 7
    for i in range(cuts+1):
        t=i/cuts; center=start.lerp(end,t); center.z+=math.sin(t*math.pi)*width*.25
        w=width*math.sin(math.pi*(t*.92+.04))*(1-.5*t)
        for s in [-1,0,1]:
            verts.append(tuple(center+side*w*s)); uvs.append(((s+1)/2,t))
        if i:
            p=i*3
            faces.extend([(p-3,p,p+1,p-2),(p-2,p+1,p+2,p-1)])
    geom(key).add(verts,faces,uvs)


def bird_wings():
    for side in [-1,1]:
        tube([(side*.15,.04,.92),(side*.56,.16,1.21),(side*1.05,.14,1.47)],[.08,.052,.015],"feather")
        count=9 if MOBILE else 15
        for i in range(count):
            t=i/(count-1)
            feather((side*(.2+t*.82),.1+t*.04,.98+t*.44),(side*(.38+t*.95),-.45+math.sin(t*math.pi)*.13,.73+t*.57),.065 if MOBILE else .052)
        for i in range(7 if MOBILE else 12):
            t=i/(6 if MOBILE else 11)
            feather((side*(.2+t*.7),.04,1.01+t*.35),(side*(.35+t*.74),-.18,1.0+t*.3),.065)


def membrane_wings():
    for side in [-1,1]:
        root=(side*.18,.1,.92); upper=(side*.6,.1,1.45); tip=(side*1.12,.1,1.27)
        tube([root,upper,tip],[.06,.036,.005],"fur")
        ribs=[(side*.95,-.35,.95),(side*.67,-.45,.72),(side*.39,-.24,.77)]
        previous=tip
        for end in ribs:
            tube([upper,((upper[0]+end[0])/2,-.06,(upper[2]+end[2])/2),end],[.018,.015,.004],"bone",sides=6)
            verts=[upper,previous,((previous[0]+end[0])/2,-.1,(previous[2]+end[2])/2-.08),end]
            geom("scale").add(verts,[(0,1,2),(0,2,3)])
            previous=end
        geom("scale").add([upper,previous,root],[(0,1,2)])


def build_hydra():
    quadruped("scale")
    tube([(0,.48,.7),(0,.78,.55),(.22,1,.24),(.46,1.03,.09)],[.18,.13,.07,.005],"scale")
    for i in range(5):
        side=(i-2)*.2; height=1.16+(i%3)*.17
        tube([(side*.35,-.3,.73),(side*.75,-.46,.95),(side,-.39,height-.13),(side,-.55,height)],[.095,.076,.061,.07],"scale",ripple=.025)
        reptile_head((side,-.57,height),.11)
    for i in range(7):
        y=.65-i*.16
        horn([(0,y,.92),(0,y+.05,1.09)],[.055][0],"bone")


def build_medusa():
    points=[]; radii=[]
    for i in range(24):
        t=i/23; a=t*math.tau*1.4
        points.append((math.sin(a)*(.5-.22*t),math.cos(a)*(.5-.22*t),.1+.2*t))
        radii.append(.015+.115*t)
    points += [(0,0,.48),(0,0,.7)];radii += [.15,.13]
    tube(points,radii,"scale",sides=10 if MOBILE else 16,steps=2)
    import_female(True,.73,.68,False)
    for i in range(7 if MOBILE else 11):
        a=i*2.4; x=math.cos(a)*.1;y=math.sin(a)*.075
        end=(math.cos(a)*.2,math.sin(a)*.14,1.43+(i%3)*.055)
        tube([(x,y,1.34),(x*1.8,y*1.8,1.54),end],[.024,.025,.018],"scale",sides=7,steps=3)
        ellipsoid(end,(.025,.04,.024),"scale",sectors=8,rings=5)
    # Spear and scale shoulder guards keep the feminine torso fully armored.
    tube([(.34,-.18,.64),(.34,-.18,1.55)],[.012,.012],"wood",sides=7,steps=1)
    horn([(.34,-.18,1.53),(.34,-.18,1.76)],.045,"steel")


def build_centaur():
    quadruped("fur",True)
    import_female(True,.71,.82,True,male=True,offset=(0,-.35))
    tube([(0,.53,.8),(0,.72,.68),(.08,.79,.34)],[.07,.065,.012],"dark")
    for i in range(7):
        y=.5-i*.1
        tube([(0,y,.98),(.02,y+.03,1.06)],[.03,.007],"dark",sides=6,steps=2)
    tube([(-.37,-.2,.89),(-.48,-.24,1.17),(-.37,-.2,1.49)],[.018,.025,.018],"wood",sides=7,steps=4)
    tube([(-.37,-.2,.89),(-.37,-.2,1.49)],[.004,.004],"bone",sides=4,steps=1)


def build_griffon():
    quadruped("fur")
    bird_wings()
    tube([(0,-.35,.83),(0,-.47,1.03),(0,-.51,1.2)],[.17,.14,.115],"feather")
    ellipsoid((0,-.55,1.25),(.13,.14,.15),"feather",sculpt=.035)
    tube([(0,-.64,1.28),(0,-.8,1.22),(0,-.79,1.16)],[.075,.053,.005],"gold",sides=10)
    eyes((0,-.65,1.3),.087)
    for side in [-1,1]:
        for i in range(5): feather((side*.08,-.46,1.2-i*.04),(side*(.13+i*.01),-.25,1.01-i*.04),.035)
    tube([(0,.5,.7),(.12,.78,.66),(.27,.86,.89)],[.047,.032,.008],"fur")
    for i in range(4):feather((.23,.83,.83),(.33+(i-1.5)*.07,.95,.96+i*.02),.04)


def build_manticore():
    quadruped("fur");membrane_wings()
    ellipsoid((0,-.45,1),(.22,.2,.24),"fur",sculpt=.06)
    ellipsoid((0,-.64,.94),(.16,.12,.1),"fur")
    ellipsoid((0,-.72,.98),(.075,.035,.045),"dark")
    eyes((0,-.61,1.09),.125)
    for i in range(12 if MOBILE else 20):
        a=i/(12 if MOBILE else 20)*math.tau
        feather((math.cos(a)*.17,-.39,1+math.sin(a)*.19),(math.cos(a)*.32,-.27,.98+math.sin(a)*.33),.05,"fur")
    for side in [-1,1]:
        horn([(side*.13,-.68,.95),(side*.1,-.72,.81)],.025)
        horn([(side*.17,-.38,1.15),(side*.25,-.3,1.37)],.042)
    tail=[(0,.48,.68),(0,.76,.85),(.06,.86,1.2),(.04,.66,1.48),(.01,.45,1.46)]
    tube(tail,[.09,.077,.055,.035,.02],"scale",sides=10 if MOBILE else 14,steps=5,ripple=.11)
    horn([(.01,.45,1.46),(0,.31,1.36),(0,.33,1.25)],.055,"dark")


def build_crypt_worm():
    points=[(-.45,.36,.12),(-.35,.1,.25),(-.16,-.17,.4),(.08,-.21,.63),(.12,-.29,.88)]
    tube(points,[.055,.15,.23,.24,.2],"scale",sides=16 if MOBILE else 24,steps=7,ripple=.065)
    for i in range(12 if MOBILE else 22):
        a=i/(12 if MOBILE else 22)*math.tau
        start=(.12+math.cos(a)*.19,-.34+math.sin(a)*.07,.89+math.sin(a)*.14)
        end=(.12+math.cos(a)*.075,-.53,.89+math.sin(a)*.075)
        horn([start,end],.031)
    ellipsoid((.12,-.32,.88),(.15,.025,.15),"dark",sectors=14,rings=8)
    for side in [-1,1]:
        for i in range(6):
            x=-.35+i*.1;y=.25-i*.06;z=.13+i*.07
            horn([(x+side*.12,y,z),(x+side*.29,y-.08,z-.06),(x+side*.3,y-.19,.04)],.035,"bone")


def ribbon(points,widths,key,twist=0):
    centers,sizes=catmull(points,widths,4 if MOBILE else 7);verts=[];faces=[];uvs=[]
    for i,(p,size) in enumerate(zip(centers,sizes)):
        angle=twist+i*.09
        offset=Vector((math.cos(angle)*size[0],math.sin(angle)*size[0],0))
        for side in [-1,0,1]:
            v=p+offset*side;v.z+=size[0]*.14*(1-abs(side));verts.append(tuple(v));uvs.append(((side+1)/2,i/len(centers)*3))
        if i:
            k=i*3;faces.extend([(k-3,k,k+1,k-2),(k-2,k+1,k+2,k-1)])
    geom(key).add(verts,faces,uvs)


def build_spirit():
    # A face, shoulders, long sleeves and torn shroud rather than a generic orb.
    human_head((0,-.015,1.3),skin="bone")
    tube([(0,0,.5),(0,0,.8),(0,0,1.1),(0,0,1.33)],[(.19,.12),(.21,.13),(.27,.14),(.12,.1)],"spirit")
    for side in [-1,1]:
        tube([(side*.23,0,1.1),(side*.43,-.08,.94),(side*.48,-.22,1.04)],[.11,.09,.04],"spirit")
        for finger in range(4):tube([(side*.48+(finger-1.5)*.018,-.22,1.04),(side*.5+(finger-1.5)*.022,-.29,1.13)],[.008,.002],"bone",sides=5,steps=2)
    for i in range(8):
        a=i*math.tau/8;x=math.cos(a);y=math.sin(a)
        ribbon([(x*.2,y*.12,.85),(x*.22,y*.2,.45),(x*.34,y*.18,.1),(x*.39,y*.25,.02)],[.13,.11,.05,.001],"spirit",a)
    for side in [-1,1]:
        ribbon([(side*.12,.015,1.38),(side*.18,-.08,1.36),(side*.2,-.11,1.15),(side*.23,-.03,.9)],[.07,.09,.065,.04],"spirit",math.pi/2)


def build_elemental(kind):
    key={"air-elemental":"spirit","fire-elemental":"fire","water-elemental":"water","earth-elemental":"stone"}[kind]
    if kind=="earth-elemental":
        # Fractured boulder anatomy; legs, hands and head occupy distinct masses.
        for center,scale in [((0,0,.74),(.32,.19,.35)),((0,0,1.17),(.18,.14,.21)),((-.21,0,.26),(.15,.14,.3)),((.21,0,.26),(.15,.14,.3))]:ellipsoid(center,scale,key,sculpt=.17,sectors=10 if MOBILE else 16,rings=7)
        for side in [-1,1]:
            tube([(side*.29,0,.97),(side*.44,-.07,.73),(side*.49,-.16,.55)],[.18,.14,.15],key,sides=9,steps=2,ripple=.17)
            for i in range(3):box((side*.49+(i-1)*.045,-.2,.5),(.045,.12,.11),key)
        eyes((0,-.13,1.21),.068,key="gold")
        for i in range(9):
            a=i*2.4;ellipsoid((math.cos(a)*.24,math.sin(a)*.15,.7+(i%3)*.18),(.12,.09,.12),key,sculpt=.25,sectors=8,rings=5)
        return
    tube([(0,0,.3),(0,0,.65),(0,0,.97),(0,0,1.22)],[(.09,.09),(.17,.12),(.25,.14),(.1,.08)],key,ripple=.11)
    ellipsoid((0,-.01,1.31),(.11,.09,.15),key,sculpt=.1)
    eyes((0,-.085,1.33),.046,key="bone")
    for side in [-1,1]:
        tube([(side*.22,0,1),(side*.39,-.03,.83),(side*.48,-.18,1.02)],[.1,.07,.025],key,ripple=.1)
    if kind=="air-elemental":
        for strand in range(3):
            points=[];widths=[]
            for i in range(24):
                t=i/23;a=t*math.tau*1.7+strand*math.tau/3;r=.4*(1-t)+.08
                points.append((math.cos(a)*r,math.sin(a)*r,t*.84+.025));widths.append(.085*(1-t)+.015)
            ribbon(points,widths,key,twist=strand)
        for side in [-1,1]:ribbon([(side*.25,0,1.02),(side*.47,.1,1.27),(side*.65,.1,1.39)],[.12,.08,.001],key)
    elif kind=="fire-elemental":
        for i in range(10 if MOBILE else 17):
            a=i*2.4;x=math.cos(a)*.23;y=math.sin(a)*.18
            ribbon([(x,y,.09),(x*.8,y*.8,.55),(x*1.5+.04,y,1+(i%4)*.18),(x*1.6-.02,y,1.2+(i%4)*.14)],[.1,.08,.06,.001],key,a)
    else:
        for i in range(5):
            a=i*math.tau/5
            tube([(math.cos(a)*.1,math.sin(a)*.1,.05),(math.cos(a)*.28,math.sin(a)*.28,.2),(math.cos(a+.7)*.24,math.sin(a+.7)*.24,.47),(0,0,.74)],[.025,.085,.085,.04],key,ripple=.04)
        for side in [-1,1]:ribbon([(side*.22,0,1.02),(side*.42,.04,1.2),(side*.44,-.04,1.43),(side*.33,-.13,1.48)],[.09,.08,.055,.001],key)


def wheel(x,y,z,radius=.2):
    # Separate wooden rim, spokes, axle hub and iron tyre.
    for r,key in [(radius,"dark"),(radius-.018,"wood")]:
        pts=[]
        for i in range(25):
            a=i/24*math.tau;pts.append((x,y+math.cos(a)*r,z+math.sin(a)*r))
        tube(pts,[.023]*len(pts),key,sides=5,steps=1)
    tube([(x-.05,y,z),(x+.05,y,z)],[.053,.053],"wood",sides=10,steps=1)
    for i in range(8):
        a=i*math.tau/8
        tube([(x,y,z),(x,y+math.cos(a)*radius*.88,z+math.sin(a)*radius*.88)],[.016,.019],"wood",sides=5,steps=1)


def beam(start,end,width=.06,key="wood"):
    start,end=Vector(start),Vector(end);direction=(end-start).normalized()
    normal=direction.cross(Vector((0,0,1)))
    if normal.length<.01:normal=direction.cross(Vector((0,1,0)))
    normal.normalize();other=direction.cross(normal).normalized()
    verts=[]
    for p in [start,end]:
        for a,b in [(-1,-1),(-1,1),(1,1),(1,-1)]:verts.append(tuple(p+normal*a*width/2+other*b*width/2))
    geom(key).add(verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])


def build_siege(trebuchet=False):
    for x in [-.29,.29]:
        beam((x,-.43,.28),(x,.44,.28),.09)
        for y in [-.31,.31]:wheel(x*1.35,y,.21,.19)
    for y in [-.33,.25]:beam((-.31,y,.28),(.31,y,.28),.07)
    if trebuchet:
        for side in [-1,1]:
            beam((side*.28,-.33,.31),(side*.19,.13,1.13),.09)
            beam((side*.28,.43,.31),(side*.19,.13,1.13),.09)
        beam((-.28,.13,1.1),(.28,.13,1.1),.065,"steel")
        beam((0,-.5,1.56),(0,.37,.9),.075)
        box((0,.34,.72),(.27,.23,.28),"stone")
        tube([(0,-.5,1.56),(.04,-.73,1.36),(0,-.79,1.04)],[.011,.011,.011],"linen",sides=5,steps=2)
        ellipsoid((0,-.77,1.03),(.11,.09,.085),"linen",sectors=10,rings=6)
    else:
        for side in [-1,1]:beam((side*.24,.17,.31),(side*.18,.14,.81),.085)
        beam((-.24,.14,.73),(.24,.14,.73),.08)
        beam((0,.29,.34),(0,-.47,1.08),.075)
        for i in range(7):
            y=.04+i*.023;tube([(-.23,y,.47),(.23,y,.47)],[.011,.011],"linen",sides=5,steps=1)
        ellipsoid((0,-.49,1.09),(.13,.15,.06),"wood",sectors=12,rings=5)
        ellipsoid((0,-.49,1.15),(.095,.1,.085),"stone",sectors=9,rings=6)
        for side in [-1,1]:tube([(side*.23,-.28,.34),(side*.2,.17,.79)],[.009,.009],"linen",sides=5,steps=2)
    for x in [-.28,.28]:
        for y in [-.33,.25]:ellipsoid((x,y,.33),(.025,.025,.016),"steel",sectors=7,rings=4)


def build_mummy():
    # Anatomical silhouette under separate winding cloth strips, no ghoul reuse.
    tube([(0,0,.57),(0,0,.76),(0,0,.98),(0,0,1.1)],[(.13,.09),(.12,.08),(.2,.12),(.16,.09)],"linen")
    human_head((0,-.015,1.25),skin="linen")
    for side in [-1,1]:
        tube([(side*.09,0,.61),(side*.12,-.025,.33),(side*.16,-.05,.08)],[(.085,.09),(.063,.06),(.037,.04)],"linen")
        ellipsoid((side*.16,-.11,.06),(.058,.12,.05),"linen")
        tube([(side*.19,0,1.05),(side*.3,-.04,.86),(side*.37,-.24,.99)],[.065,.045,.031],"linen")
        ellipsoid((side*.38,-.27,1.01),(.037,.057,.035),"bone",sectors=10,rings=6)
    # Irregular raised helical wrap edges remain visible at close gallery zoom.
    for body in ["torso","head","leftleg","rightleg"]:
        turns=10 if body=="torso" else 7
        pts=[]
        for i in range(turns*(7 if MOBILE else 12)+1):
            t=i/(turns*(7 if MOBILE else 12));a=t*math.tau*turns
            if body=="torso":cx=0;cy=0;z=.61+t*.48;rx=.13+.055*math.sin(t*math.pi);ry=.09
            elif body=="head":cx=0;cy=-.015;z=1.16+t*.23;rx=.087*math.sin(t*math.pi*.75+.3);ry=.085
            else:cx=(-1 if body=="leftleg" else 1)*(.16-.07*t);cy=-.05*(1-t);z=.1+t*.5;rx=.045+.035*t;ry=.045+.04*t
            pts.append((cx+math.cos(a)*rx,cy+math.sin(a)*ry,z))
        tube(pts,[.007]*len(pts),"bone",sides=4,steps=1)
    for side in [-1,1]:ribbon([(side*.13,-.085,.88),(side*.19,-.08,.63),(side*.24,-.13,.39)],[.022,.019,.001],"linen",side)
    # Continuous raised fabric strips wrap each anatomical segment, including
    # forearms and shins, rather than merely tinting an uncovered human model.
    for side in [-1,1]:
        bandage((side*.19,0,1.045),(side*.3,-.04,.86),.071,.051,5)
        bandage((side*.3,-.04,.86),(side*.37,-.24,.99),.05,.037,5)
        bandage((side*.09,0,.59),(side*.12,-.025,.33),.091,.069,6)
        bandage((side*.12,-.025,.33),(side*.16,-.05,.085),.068,.043,6)
    bandage((0,-.015,1.19),(0,-.015,1.36),.089,.085,5)


def bandage(start,end,r0,r1,turns):
    start,end=Vector(start),Vector(end);direction=(end-start).normalized()
    normal=direction.cross(Vector((0,1,0)))
    if normal.length<.01:normal=direction.cross(Vector((1,0,0)))
    normal.normalize();other=direction.cross(normal).normalized()
    count=turns*(7 if MOBILE else 12);verts=[];faces=[];uvs=[]
    width=(end-start).length/turns*.81
    for i in range(count+1):
        t=i/count;a=t*math.tau*turns;r=r0*(1-t)+r1*t
        p=start.lerp(end,t)+(normal*math.cos(a)+other*math.sin(a))*r
        for side in [-1,1]:verts.append(tuple(p+direction*side*width/2));uvs.append(((side+1)/2,t*turns))
        if i:
            k=i*2;faces.append((k-2,k,k+1,k-1))
    geom("bone").add(verts,faces,uvs)


def build_sprite():
    import_female(False,1.08,.025,True)
    for side in [-1,1]:
        # Faceted crystalline dragonfly-like wings: physical surfaces and veins.
        for upper in [True,False]:
            root=(side*.095,.09,.8 if upper else .64)
            tip=(side*.68,.14,1.18 if upper else .48)
            edge=(side*.45,.19,.69 if upper else .35)
            ridge=(side*.4,.08,.9 if upper else .55)
            geom("water").add([root,tip,edge,ridge],[(0,1,3),(1,2,3),(2,0,3)])
            for end in [tip,edge,ridge]:tube([root,end],[.009,.002],"gold",sides=4,steps=1)
    for i in range(5):
        x=(i-2)*.024;horn([(x,-.03,1.035),(x,-.02,1.13-(abs(i-2)*.014))],.013,"gold")


def import_female(upper_only,target_height,bottom,hair=True,male=False,offset=(0,0)):
    """Adapt static licensed, clothed female anatomy; remove added weapon faces.

    No blend file or embedded script is opened. Imported glTF is data only.
    Material boundaries preserve the original Elf UVs and visual identity.
    """
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/("actor-norowas.glb" if male else "actor-wolfhawk.glb")))
    imported=[obj for obj in bpy.context.scene.objects if obj not in before]
    meshes=[obj for obj in imported if obj.type=="MESH"]
    points=[obj.matrix_world@vertex.co for obj in meshes for vertex in obj.data.vertices]
    low=min(p.z for p in points);high=max(p.z for p in points)
    center_x=(min(p.x for p in points)+max(p.x for p in points))*.5
    center_y=(min(p.y for p in points)+max(p.y for p in points))*.5
    cutoff=low+(high-low)*.49 if upper_only else low-.001
    for obj in meshes:
        transform=obj.matrix_world.copy();bm=bmesh.new();bm.from_mesh(obj.data)
        for vertex in bm.verts:vertex.co=transform@vertex.co
        names={"low_leather_mat","low_hand_mat","low_cloth_math","low_hair_mat","low_head"} if male else ({"ElfSkin","ElfCloth","ElfHair"} if hair else {"ElfSkin","ElfCloth"})
        allowed={index for index,slot in enumerate(obj.material_slots) if slot.material and slot.material.name.split(".")[0] in names}
        bmesh.ops.delete(bm,geom=[face for face in bm.faces if face.material_index not in allowed],context="FACES")
        bmesh.ops.delete(bm,geom=[vertex for vertex in bm.verts if vertex.co.z<cutoff or not vertex.link_faces],context="VERTS")
        if not bm.verts:
            bm.free();bpy.data.objects.remove(obj,do_unlink=True);continue
        part_low=min(v.co.z for v in bm.verts);part_high=max(v.co.z for v in bm.verts);factor=target_height/(part_high-part_low)
        for vertex in bm.verts:
            p=vertex.co;vertex.co=(offset[0]+(p.x-center_x)*factor,offset[1]+(p.y-center_y)*factor,bottom+(p.z-part_low)*factor)
        bm.to_mesh(obj.data);bm.free();obj.matrix_world.identity();obj.name="Licensed clothed anatomy - adapted elf"
        # Remove now-unused weapon material slots, then keep detail budget stable.
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.material_slot_remove_unused()
        if MOBILE and len(obj.data.polygons)>3500:
            modifier=obj.modifiers.new("Mobile anatomy detail","DECIMATE");modifier.ratio=.58
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    for obj in imported:
        if obj.name in bpy.data.objects and obj.type!="MESH":bpy.data.objects.remove(obj,do_unlink=True)


def build(kind):
    if kind=="hydra":build_hydra()
    elif kind=="medusa":build_medusa()
    elif kind=="centaur":build_centaur()
    elif kind=="griffon":build_griffon()
    elif kind=="manticore":build_manticore()
    elif kind=="crypt-worm":build_crypt_worm()
    elif kind=="spirit":build_spirit()
    elif kind.endswith("elemental"):build_elemental(kind)
    elif kind in {"catapult","siege"}:build_siege(kind=="siege")
    elif kind=="mummy":build_mummy()
    elif kind=="sprite":build_sprite()


def pack(path, kind):
    raw=path.read_bytes();length=int.from_bytes(raw[12:16],"little");doc=json.loads(raw[20:20+length]);source=raw[28+length:]
    images={image["bufferView"]:image for image in doc.get("images",[]) if "bufferView" in image};binary=bytearray()
    for i,view in enumerate(doc["bufferViews"]):
        start=view.get("byteOffset",0);content=source[start:start+view["byteLength"]]
        if i in images:
            image=Image.open(io.BytesIO(content)).convert("RGB");image.thumbnail((256 if MOBILE else 512,)*2)
            stream=io.BytesIO();image.save(stream,format="JPEG",quality=87,subsampling=0);content=stream.getvalue();images[i]["mimeType"]="image/jpeg"
        binary.extend(b"\0"*((4-len(binary)%4)%4));view["byteOffset"]=len(binary);view["byteLength"]=len(content);binary.extend(content)
    doc["buffers"][0]["byteLength"]=len(binary);binary.extend(b"\0"*((4-len(binary)%4)%4))
    doc["asset"]["copyright"]="Original modeled fantasy miniature and PBR textures: Mage Knight Solo project, CC0-1.0. Not official Mage Knight art."
    if kind in {"medusa","sprite"}:doc["asset"]["copyright"]="Female anatomy: Contmike, Danimal; hair MajorNightmare; bow credit Yd. CC-BY-SA-3.0. Original creature/wing adaptations by Mage Knight Solo project; complete derivative remains CC-BY-SA-3.0. Not official Mage Knight art."
    if kind=="centaur":doc["asset"]["copyright"]="Male elf upper anatomy: thecubber; rig Julius; commissioned by the OpenGameArt.org community, CC-BY-SA-3.0. Original equine anatomy and bow adaptations by Mage Knight Solo project; complete derivative remains CC-BY-SA-3.0. Not official Mage Knight art."
    payload=json.dumps(doc,separators=(",",":")).encode();payload+=b" "*((4-len(payload)%4)%4)
    result=b"glTF"+(2).to_bytes(4,"little")+(28+len(payload)+len(binary)).to_bytes(4,"little")+len(payload).to_bytes(4,"little")+b"JSON"+payload+len(binary).to_bytes(4,"little")+b"BIN\0"+binary
    path.write_bytes(result)
    triangles=sum(doc["accessors"][primitive["indices"]]["count"]//3 for mesh in doc["meshes"] for primitive in mesh["primitives"])
    primitives=sum(len(mesh["primitives"]) for mesh in doc["meshes"])
    record=dict(file=path.name,bytes=len(result),sha256=hashlib.sha256(result).hexdigest(),triangles=triangles,primitives=primitives,animations=[])
    if triangles>=(11000 if MOBILE else 25000) or len(result)>=(2_000_000 if MOBILE else 5_000_000) or primitives>10:raise RuntimeError(f"Asset budget exceeded: {record}")
    # Accessors are sampled for invalid authoring output, not trusted merely by file size.
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            if not all(attribute in primitive["attributes"] for attribute in ["NORMAL","TEXCOORD_0"]):raise RuntimeError(f"Missing lit/UV geometry: {kind}")
    return record


def export(kind,mobile):
    global MOBILE,BUILDERS,MATERIALS
    MOBILE=mobile;BUILDERS={};MATERIALS={}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute=False
    build(kind)
    for builder in BUILDERS.values():builder.finish()
    bpy.ops.object.select_all(action="SELECT")
    path=OUT/f'special-{kind}{"-mobile" if mobile else ""}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_image_format="AUTO",export_extras=False)
    return pack(path,kind)


def preview_grid():
    """Neutral offline contact sheet to inspect silhouettes, not a game screenshot."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for i,kind in enumerate(NAMES):
        before=set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT/f"special-{kind}.glb"))
        imported=[obj for obj in bpy.context.scene.objects if obj not in before]
        offset=Vector(((i%5-2)*2.55,(i//5-1)*-2.7,0))
        for obj in imported:
            if not obj.parent:obj.location+=offset
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=1.04,depth=.055,location=offset+Vector((0,0,-.06)))
        mat=bpy.data.materials.get("Neutral preview plate") or bpy.data.materials.new("Neutral preview plate")
        mat.diffuse_color=(.17,.2,.18,1);bpy.context.object.data.materials.append(mat)
        bpy.ops.object.text_add(location=offset+Vector((0,-.96,.02)))
        text=bpy.context.object;text.data.body=kind;text.data.align_x="CENTER";text.data.size=.16
        labelmat=bpy.data.materials.get("Preview label") or bpy.data.materials.new("Preview label")
        labelmat.diffuse_color=(.7,.74,.68,1);text.data.materials.append(labelmat)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.1))
    mat=bpy.data.materials.new("Neutral preview floor");mat.diffuse_color=(.025,.037,.032,1);bpy.context.object.data.materials.append(mat)
    bpy.ops.object.camera_add(location=(3,-13.5,11))
    camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.25))-camera.location).to_track_quat("-Z","Y").to_euler();camera.data.type="ORTHO";camera.data.ortho_scale=15.3
    bpy.context.scene.camera=camera
    for pos,power,size in [((-4,-5,9),2500,6),((6,1,8),1800,6),((0,5,7),1500,5)]:
        bpy.ops.object.light_add(type="AREA",location=pos);light=bpy.context.object;light.data.energy=power;light.data.size=size
        light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat("-Z","Y").to_euler()
    scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.samples=32
    scene.world=bpy.data.worlds.new("Preview ambient");scene.world.color=(.25,.25,.25)
    scene.render.resolution_x=2400;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="JPEG";scene.render.image_settings.quality=93;scene.view_settings.view_transform="AgX"
    path=ROOT/"outputs/previews/special-model-grid.jpg";path.parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--only",choices=list(NAMES));parser.add_argument("--preview",action="store_true");args=parser.parse_args()
    if args.preview:preview_grid();raise SystemExit(0)
    OUT.mkdir(parents=True,exist_ok=True);texture_images();records=[];catalog=[]
    for kind in [args.only] if args.only else NAMES:
        for mobile in [False,True]:
            record=export(kind,mobile);records.append(record);print("ASSET",json.dumps(record),flush=True)
        composite=kind in {"medusa","sprite","centaur"}
        anatomy_credit=MALE_CREDIT if kind=="centaur" else ELF_CREDIT
        catalog.append(dict(id=f"special-{kind}",kind="creature",key=kind,label=NAMES[kind],file=f"special-{kind}.glb",mobile=f"special-{kind}-mobile.glb",species=kind,role="siege engine" if kind in {"catapult","siege"} else "fantasy creature",sourceKind="licensed-anatomy-original-composite" if composite else "original-procedural-sculpt",license="CC-BY-SA-3.0" if composite else "CC0-1.0",artisticReview="Not AAA realism; original detailed static miniature. Species silhouette verified separately; not official artwork.",credits=[CREDIT,anatomy_credit] if composite else [CREDIT],modifications="Original anatomical lofts, modeled feather vanes/scales/cloth and authored PBR textures; static near/mobile detail levels; no animation or source model scripts."+(" Licensed clothed elf anatomy adapted, old weapon faces removed; female upper body for Medusa, full female for sprite, male upper body for centaur. Original species-specific serpent/equine lower body or crystal wings added. Whole composite CC-BY-SA-3.0." if composite else "")))
    for filename,values,key in [("special-manifest.json",records,"file"),("special-catalog.json",catalog,"id")]:
        path=OUT/filename;existing=json.loads(path.read_text()) if path.exists() else []
        combined={item[key]:item for item in existing+values};path.write_text(json.dumps(list(combined.values()),ensure_ascii=False,indent=2)+"\n")
