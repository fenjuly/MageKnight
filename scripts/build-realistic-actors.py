"""Convert licensed actors and author role-specific equipment, never source scripts.

Blender 4.5 + Pillow. Raw sources stay in work/; GLBs are offline self-contained.
These are adapted tabletop representations, not official character likenesses.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'work/realistic-sources'
OUT = ROOT / 'public/models/realistic'
CC = 'https://creativecommons.org/licenses/'
SOURCES = {
    'elf': dict(path='elf/Elf-Final.blend', author='Contmike, Danimal; bow/quiver: Yd; hair: MajorNightmare', license='CC-BY-SA-3.0', source='https://opengameart.org/content/elf-game-ready-and-animated', licenseUrl=CC+'by-sa/3.0/', species='elf', gender='female'),
    'male-elf': dict(path='male-elf.blend', author='thecubber; rig: Julius; commissioned by the OpenGameArt.org community', license='CC-BY-SA-3.0', source='https://opengameart.org/content/rigged-textured-elven-archer', licenseUrl=CC+'by-sa/3.0/', species='elf', gender='male'),
    'mage': dict(path='mage.blend', author='thecubber; rig: Julius; commissioned by the OpenGameArt.org community', license='CC-BY-SA-3.0', source='https://opengameart.org/content/rigged-textured-mage', licenseUrl=CC+'by-sa/3.0/', species='human', gender='male'),
    'reptile': dict(path='reptile/raptile_rig_fin.blend', author='thecubber, commissioned by the OpenGameArt.org community (http://opengameart.org)', license='CC-BY-3.0', source='https://opengameart.org/content/rigged-textured-reptile', licenseUrl=CC+'by/3.0/', species='dragonkin', gender='male'),
    'dragon': dict(path='dragon/Dragon/dragon.blend', author='Guillaume "GuieA_7" Englert', license='CC-BY-SA-4.0', source='https://opengameart.org/content/dragon-3d', licenseUrl=CC+'by-sa/4.0/', species='dragon', gender='unspecified'),
    'orc': dict(path='orc/Orc/orc.blend', author='Guillaume "GuieA_7" Englert', license='CC-BY-SA-4.0', source='https://opengameart.org/content/orc-3d', licenseUrl=CC+'by-sa/4.0/', species='orc', gender='male'),
    'knight': dict(path='knight/armor.blend', author='piacenti', license='CC-BY-3.0', source='https://opengameart.org/content/knight-2', licenseUrl=CC+'by/3.0/', species='human', gender='unspecified'),
    'warwolf': dict(path='warwolf.blend', author='ThetankOmeter, TripleSnail', license='CC0-1.0', source='https://opengameart.org/content/warwolf', licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/', species='werewolf', gender='male'),
}
SPECS = {
    'actor-wolfhawk': ('elf','狼鹰 · 双刃猎手','hunter'),
    'actor-arythea': ('elf','艾莉希娅 · 血火女战士','blood-warrior'),
    'actor-goldyx': ('reptile','戈迪克斯 · 有翼龙人','dragonkin'),
    'actor-norowas': ('male-elf','诺洛瓦斯 · 精灵统帅','commander'),
    'actor-krang': ('orc','克朗 · 兽人萨满','shaman'),
    'actor-braevalar': ('mage','布雷瓦拉 · 德鲁伊','druid'),
    'actor-female-mage': ('elf','女性施法者 · 德尔法娜大师','priestess'),
    'actor-hag': ('elf','诅咒女巫','hag'),
    'actor-mage': ('mage','法师 · 奥术权杖','mage'),
    'actor-monk': ('mage','战斗僧侣 · 环杖','monk'),
    'actor-necromancer': ('mage','蒙面死灵法师 · 骨饰','necromancer'),
    'actor-peasant': ('mage','农民 · 劳作长叉','peasant'),
    'actor-herbalist': ('mage','草药师 · 药篓与木杖','herbalist'),
    'actor-archer': ('male-elf','森林弓手 · 弓与箭囊','archer'),
    'actor-crossbowman': ('knight','弩手 · 机弩','crossbow'),
    'actor-guardsman': ('knight','卫兵 · 长枪和盾','guard'),
    'actor-swordsman': ('knight','剑士 · 双刃护手剑','sword'),
    'actor-gunner': ('knight','炮手 · 符文火铳','gunner'),
    'actor-orc-shaman': ('orc','兽人召唤师 · 颅骨权杖','shaman'),
    'actor-orc-armored': ('orc','铁甲兽人 · 分层肩甲','orc-armor'),
    'actor-orc-tracker': ('orc','兽人追踪者 · 猎弓','tracker'),
    'actor-orc-skirmisher': ('orc','兽人散兵 · 双斧','skirmisher'),
    'actor-orc-stonethrower': ('orc','兽人投石手 · 岩石背篓','stonethrower'),
    'actor-dragon': ('dragon','有翼巨龙','dragon'),
    'actor-werewolf': ('warwolf','狼人 · 毛皮与锁链','werewolf'),
    'actor-wolf-rider': ('orc','兽人狼骑兵 · 巨狼与骑手','wolf-rider'),
    'actor-dragon-summoner': ('reptile','龙族召唤者 · 龙人法杖','dragon-summoner'),
}
M = {}
HANDS = {}
BODY_POINTS = []


def shader(mat, color=None, normal=None, metallic=0, alpha=False):
    mat.use_nodes=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    nodes.clear(); out=nodes.new('ShaderNodeOutputMaterial'); bs=nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value=mat.diffuse_color
    bs.inputs['Roughness'].default_value=.75; bs.inputs['Metallic'].default_value=metallic
    links.new(bs.outputs['BSDF'],out.inputs['Surface'])
    if color:
        tex=nodes.new('ShaderNodeTexImage'); tex.image=color; links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        if alpha:
            links.new(tex.outputs['Alpha'],bs.inputs['Alpha']); mat.surface_render_method='DITHERED'; mat.use_backface_culling=False
    if normal:
        normal.colorspace_settings.name='Non-Color'; tex=nodes.new('ShaderNodeTexImage'); tex.image=normal
        node=nodes.new('ShaderNodeNormalMap'); links.new(tex.outputs['Color'],node.inputs['Color']); links.new(node.outputs['Normal'],bs.inputs['Normal'])


def open_source(source, role):
    global HANDS, BODY_POINTS
    path=SRC/SOURCES[source]['path']
    bpy.context.preferences.filepaths.use_scripts_auto_execute=False
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    if bpy.context.object and bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.context.scene.objects):
        if o.type not in {'MESH','ARMATURE'} or (o.type=='MESH' and not len(o.data.polygons)):
            bpy.data.objects.remove(o,do_unlink=True)
    images=bpy.data.images
    get=lambda key: images.get(key) if key else None
    if source=='elf':
        mapping={'ElfCloth':('ElfCloth.jpg','ElfClothNormal.jpg'), 'ElfSkin':('ElfSkin .JPG','ElfSkinNormal.jpg.001'), 'ElfHair':('ElfHair.png',None), 'bowArrowQuiver':('bow01D','bow01N.jpg')}
        for mat in bpy.data.materials:
            c,n=mapping.get(mat.name,(None,None)); shader(mat,get(c),get(n),alpha=mat.name=='ElfHair')
        for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
            rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('idle')
        bpy.context.scene.frame_set(40)
        # All female adaptations retain source clothing. Weapon roles are rebuilt.
        for o in list(bpy.context.scene.objects):
            if o.name in {'bow','quiver','Arrow'}: bpy.data.objects.remove(o,do_unlink=True)
    elif source=='male-elf':
        for mat in bpy.data.materials:
            hair='hair' in mat.name; head='head' in mat.name
            shader(mat,get('hair_diff_512px.tga' if hair else 'low_head_color1.tga' if head else 'prop_dif.tga' if 'bow' in mat.name else 'low_all_diff.tga'),get('hair_normal_512px.tga' if hair else 'low_head_normal_1k.tg' if head else 'prop_normal.tga' if 'bow' in mat.name else 'low_all_normal.tga'),alpha=hair)
        if role=='commander':
            bpy.data.objects.remove(bpy.data.objects['LOW_bow'],do_unlink=True)
        bpy.context.scene.frame_set(1)
    elif source=='mage':
        for mat in bpy.data.materials: shader(mat,get('color.tga'),get('normal.tga'))
        bpy.context.scene.frame_set(1)
    elif source=='reptile':
        for mat in bpy.data.materials: shader(mat,get('diff2k+color.tga.jpg'),get('normal.jpg'))
        bpy.context.scene.frame_set(1)
    elif source=='dragon':
        color=images.load(str(path.parent/'dragon.png'),check_existing=True)
        for mat in bpy.data.materials: shader(mat,color)
        for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
            rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('wait')
        bpy.context.scene.frame_set(1)
    elif source=='orc':
        color=images.load(str(path.parent/'orc.png'),check_existing=True); hammer=images.load(str(path.parent/'warhammer.png'),check_existing=True)
        for mat in bpy.data.materials: shader(mat,hammer if 'hammer' in mat.name else color,metallic=.6 if mat.name in {'metal','hammermat'} else 0)
        for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
            rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('wait')
        bpy.context.scene.frame_set(1)
        if role!='orc-armor':
            for o in list(bpy.context.scene.objects):
                if o.type=='MESH' and 'hammer' in o.name.lower(): bpy.data.objects.remove(o,do_unlink=True)
    elif source=='warwolf':
        for mat in bpy.data.materials:
            mapping={'Wolf':('WereWolf_Diff.png','WereWolf.png'),'Wolf_Legs':('WereWolf_Legs_Diff.psd','untitled.002'),'Material.005':('untitled.001','untitled'),'Material.003':('afadfdf.png','untitled.003')}
            c,n=mapping.get(mat.name,(None,None)); shader(mat,get(c),get(n))
        for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
            rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Roar')
        bpy.context.scene.frame_set(1)
    else:
        for mat in bpy.data.materials: shader(mat,get('armor_default_color.png'),get('armor_default_nmap.png'),metallic=.7)
    # Bake the evaluated standing pose: incompatible old rig constraints are not
    # exported as broken glTF rigs, and no source animation/script is executed.
    bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get()
    # Capture evaluated finger-root/palm anchors before freezing the rigs.
    # They are later normalized with precisely the same transform as anatomy.
    raw_hands={}
    for side,names in {'positive':['finger_middle.01.L','finger_middle.01.l','LeftHandIndex1','LeftFingerBase','finger2_a.L','hand.L','LeftHand','wrist.L'], 'negative':['finger_middle.01.R','finger_middle.01.r','RightHandIndex1','RightFingerBase','finger2_a.R','hand.R','RightHand','wrist.R']}.items():
        for name in names:
            found=next(((rig,rig.pose.bones.get(name)) for rig in bpy.context.scene.objects if rig.type=='ARMATURE' and rig.pose.bones.get(name)),None)
            if found:
                rig,bone=found;raw_hands[side]=rig.matrix_world@bone.head
                break
    meshes=[]
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH': continue
        evaluated=o.evaluated_get(deps); data=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
        # Preserve each source's render UV explicitly. Otherwise joining an
        # elf head's UVTex with body UVMap silently fills head UVMap with zero.
        if data.uv_layers:
            active=next((uv for uv in data.uv_layers if uv.active_render),data.uv_layers.active)
            coordinates=[tuple(point.uv) for point in active.data]
            for uv in list(data.uv_layers):data.uv_layers.remove(uv)
            uv=data.uv_layers.new(name='UVMap')
            for point,co in zip(uv.data,coordinates):point.uv=co
        new=bpy.data.objects.new(o.name+' · posed',data); bpy.context.collection.objects.link(new); new.matrix_world=o.matrix_world.copy()
        meshes.append(new); bpy.data.objects.remove(o,do_unlink=True)
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH': bpy.data.objects.remove(o,do_unlink=True)
    points=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    low=Vector(tuple(min(p[i] for p in points) for i in range(3))); high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    factor=2/(high.z-low.z); center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    for o in meshes:
        for v in o.data.vertices: v.co=(o.matrix_world@v.co-center)*factor
        o.matrix_world.identity()
        for p in o.data.polygons: p.use_smooth=True
    BODY_POINTS=[v.co.copy() for o in meshes for v in o.data.vertices]
    HANDS={side:(point-center)*factor for side,point in raw_hands.items()}
    # Static knight has no rig: use the actual glove surface nearest the
    # expected hand region, rather than floating equipment beside the model.
    for side,sign in [('positive',1),('negative',-1)]:
        if side not in HANDS:
            candidates=[point for point in BODY_POINTS if sign*point.x>.2 and .55<point.z<1.15]
            guess=Vector((sign*.43,-.05,.86))
            HANDS[side]=min(candidates,key=lambda point:(point-guess).length).copy() if candidates else guess
    return meshes


def new_material(name,color,metal=0):
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*color,1); shader(mat,metallic=metal); M[name]=mat; return mat


def finish(obj,mat):
    obj.data.materials.append(M[mat]); obj.data.uv_layers.new(name='UVMap') if not obj.data.uv_layers else None
    for p in obj.data.polygons: p.use_smooth=True
    return obj


def rod(name,a,b,r=.022,mat='wood'):
    direction=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r*.8,depth=direction.length,location=(Vector(a)+Vector(b))/2)
    obj=bpy.context.object; obj.name=name; obj.rotation_euler=direction.to_track_quat('Z','Y').to_euler(); return finish(obj,mat)


def sphere(name,p,scale,mat='gold'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=p); o=bpy.context.object; o.name=name; o.scale=scale; return finish(o,mat)


def curve(name,points,r=.018,mat='wood'):
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.resolution_u=6; data.bevel_depth=r; data.bevel_resolution=2
    spl=data.splines.new('BEZIER'); spl.bezier_points.add(len(points)-1)
    for p,v in zip(spl.bezier_points,points): p.co=v; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.data.materials.append(M[mat]); bpy.context.view_layer.objects.active=obj; obj.select_set(True); bpy.ops.object.convert(target='MESH'); obj.select_set(False)
    return obj


def blade(x=.46,y=-.13,z=.75,length=.65):
    vertices=[(x,y-.025,z),(x-.065,y,z+.12),(x-.028,y,z+length-.1),(x,y,z+length),(x+.028,y,z+length-.1),(x+.065,y,z+.12),(x,y+.025,z)]
    faces=[(0,1,2,3),(0,3,4,5),(6,5,4,3),(6,3,2,1),(0,5,6,1)]
    data=bpy.data.meshes.new('Tempered blade'); data.from_pydata(vertices,[],faces); data.update(); o=bpy.data.objects.new('Tempered blade',data); bpy.context.collection.objects.link(o); finish(o,'steel')
    rod('Leather wrapped grip',(x,y,z-.17),(x,y,z),.024)
    rod('Swept gold guard',(x-.12,y,z),(x+.12,y,z),.018,'gold')


def anchored(build,reference,side='positive',vertical=True):
    before=set(bpy.context.scene.objects)
    build()
    offset=HANDS[side]-Vector(reference)
    if not vertical:offset.z=0
    for obj in set(bpy.context.scene.objects)-before:
        obj.location+=offset


def mesh_part(name,vertices,faces,material):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);finish(obj,material)
    return obj


def cloak(material,length=1.0,width=.4):
    # A curved, folded cloth volume with a collar and thickened hem.
    vertices=[];faces=[];rows=9;cols=15
    for row in range(rows):
        t=row/(rows-1);z=1.6-t*length
        for col in range(cols):
            u=col/(cols-1)*2-1
            vertices.append((u*(width*.55+t*width*.45),.14+t*.18+.045*math.cos(u*math.pi*4)*(t+.15),z+.025*math.cos(u*math.pi*2)*t))
            if row and col:
                k=row*cols+col;faces.append((k-cols-1,k-cols,k,k-1))
    obj=mesh_part('Folded travelling cloak',vertices,faces,material)
    mod=obj.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.009
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    curve('Clasped collar',[(-.18,.13,1.6),(0,-.06,1.57),(.18,.13,1.6)],.018,'gold' if material=='crimson' else 'leather')


def fitted_armor(material):
    vertices=[];faces=[];n=16
    for level,(z,rx) in enumerate([(1.0,.17),(1.13,.145),(1.3,.17),(1.46,.22),(1.56,.175)]):
        core=[point for point in BODY_POINTS if abs(point.x)<rx and abs(point.z-z)<.045]
        center_y=(min(p.y for p in core)+max(p.y for p in core))/2 if core else .025
        ry=(max(p.y for p in core)-min(p.y for p in core))/2+.02 if core else .14
        for side in range(n):
            a=side/n*math.tau;vertices.append((rx*math.cos(a),center_y+ry*math.sin(a),z))
            if level:
                k=level*n+side;faces.append((k-n,(level-1)*n+(side+1)%n,level*n+(side+1)%n,k))
    mesh_part('Fitted articulated torso cuirass',vertices,faces,material)
    for z in [1.06,1.17]:
        curve('Belts and armor edging',[(-.16,0,z),(0,-.16,z),(.16,0,z)],.018,'leather')


def shoulder_plates(material='steel'):
    for side in [-1,1]:
        for layer in range(3):
            x=side*(.23+layer*.045);z=1.53-layer*.025
            vertices=[(x-.055,-.12,z),(x+.055,-.12,z),(x+.07,0,z+.07),(x+.055,.13,z),(x-.055,.13,z),(x-.07,0,z+.07)]
            mesh_part('Layered curved shoulder plate',vertices,[(0,1,2),(0,2,5),(5,2,3,4),(0,5,4),(1,3,2)],material)


def curved_wings():
    for side in [-1,1]:
        anchor=Vector((side*.18,.21,1.43))
        tips=[Vector((side*.43,.26,1.93)),Vector((side*.79,.3,1.78)),Vector((side*1.03,.29,1.24)),Vector((side*.62,.21,1.17)),Vector((side*.39,.18,1.02))]
        for index in range(len(tips)-1):
            vertices=[];faces=[];n=8
            for row in range(n+1):
                t=row/n
                for col in range(n+1):
                    u=col/n
                    edge=tips[index].lerp(tips[index+1],u)
                    p=anchor.lerp(edge,t)
                    p.y+=.13*math.sin(t*math.pi)*math.sin(u*math.pi)
                    p.z-=.07*math.sin(u*math.pi)*t*t
                    vertices.append(tuple(p))
                    if row and col:
                        k=row*(n+1)+col;faces.append((k-n-2,k-n-1,k,k-1))
            obj=mesh_part('Curved ribbed dragonkin wing membrane',vertices,faces,'wing')
            mod=obj.modifiers.new('Wing membrane thickness','SOLIDIFY');mod.thickness=.008
            bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        for tip in tips:
            middle=anchor.lerp(tip,.5);middle.y+=.035
            curve('Curved wing finger bones',[tuple(anchor),tuple(middle),tuple(tip)],.017,'leather')


def staff(role):
    rod('Carved spellstaff',(.52,-.12,.04),(.52,-.12,1.9),.026)
    if role in {'druid','herbalist'}:
        for side in [-1,1]:
            curve('Antler branches',[(.52,-.12,1.62),(.52+side*.1,-.14,1.84),(.52+side*.22,-.11,1.99),(.52+side*.19,-.1,2.08)],.018)
            rod('Branch fork',(.52+side*.1,-.14,1.84),(.52+side*.03,-.08,2.02),.013)
        sphere('Living seed',(.52,-.12,1.93),(.07,.055,.09),'green')
    elif role=='monk':
        bpy.ops.mesh.primitive_torus_add(major_radius=.12,minor_radius=.018,major_segments=24,minor_segments=6,location=(.52,-.12,1.93),rotation=(math.pi/2,0,0)); finish(bpy.context.object,'gold')
    elif role in {'shaman','necromancer','hag'}:
        sphere('Ritual skull',(.52,-.12,1.95),(.095,.07,.11),'bone')
        for side in [-1,1]: sphere('Carved dark eye',(.52+side*.035,-.18,1.98),(.023,.02,.026),'dark')
        for side in [-1,1]: curve('Skull horn',[(.52+side*.07,-.12,1.99),(.52+side*.14,-.1,2.07),(.52+side*.16,-.12,2.17)],.018,'bone')
    else:
        sphere('Faceted mana focus',(.52,-.12,1.98),(.08,.06,.12),'blue')
        for side in [-1,1]: curve('Focus holder',[(.52,-.12,1.85),(.52+side*.11,-.12,1.95),(.52+side*.07,-.12,2.06)],.012,'gold')


def gear(role):
    for name,c,metal in [('wood',(.15,.075,.03),0),('steel',(.29,.34,.36),.8),('gold',(.44,.29,.095),.7),('bone',(.55,.5,.35),0),('dark',(.025,.03,.025),0),('blue',(.055,.29,.4),.3),('green',(.065,.16,.045),0),('leather',(.13,.07,.035),0),('crimson',(.32,.018,.028),0),('wing',(.24,.11,.055),0)]: new_material(name,c,metal)
    if role in {'mage','monk','necromancer','shaman','druid','herbalist','priestess','hag','dragon-summoner'}:
        anchored(lambda:staff(role),(.52,-.12,.9),vertical=False)
    if role in {'blood-warrior','hunter','commander','sword','skirmisher'}:
        anchored(lambda:blade(),(.46,-.13,.665))
        if role in {'blood-warrior','hunter','skirmisher'}:
            anchored(lambda:blade(-.46,-.1,.62,.5),(-.46,-.1,.535),side='negative')
    if role=='blood-warrior':
        cloak('crimson',1.17,.37);fitted_armor('crimson');shoulder_plates('steel')
    elif role=='hunter':
        cloak('green',.94,.36);fitted_armor('leather');shoulder_plates('leather')
        sphere('Leather hunting quiver',(.15,.32,1.23),(.1,.09,.29),'leather')
        for i in range(4):rod('Quiver arrow',(.12+i*.02,.32,1.32),(.1+i*.025,.33,1.67),.006,'wood')
    elif role in {'priestess','hag'}:
        cloak('blue' if role=='priestess' else 'dark',1.16,.36)
        fitted_armor('blue' if role=='priestess' else 'dark')
    if role in {'commander','priestess'}:
        for step in range(7):
            angle=step/7*math.tau; x,y=.125*math.cos(angle),.125*math.sin(angle)
            rod('Crown prong',(x,y,1.84),(x*1.1,y*1.1,1.98+(.03 if step%2 else 0)),.014,'gold')
    if role in {'peasant','guard'}:
        before=set(bpy.context.scene.objects)
        rod('Ash spear shaft',(.46,-.13,.03),(.46,-.13,2.25),.026)
        for offset in ([-.08,0,.08] if role=='peasant' else [0]): rod('Fork tine' if role=='peasant' else 'Spear tip',(.46+offset,-.13,2.15),(.46+offset,-.13,2.39),.017,'steel')
        offset=HANDS['positive']-Vector((.46,-.13,.9));offset.z=0
        for obj in set(bpy.context.scene.objects)-before:obj.location+=offset
    if role in {'crossbow','gunner'}:
        before=set(bpy.context.scene.objects)
        rod('Weapon stock',(.45,-.48,.83),(.45,.09,1.12),.045)
        if role=='crossbow':
            curve('Steel crossbow prod',[(.16,-.35,1.0),(.28,-.46,1.01),(.45,-.49,1.02),(.62,-.46,1.01),(.74,-.35,1.0)],.018,'steel')
            rod('Taut bowstring',(.16,-.35,1.0),(.74,-.35,1.0),.005,'bone')
        else:
            rod('Engraved gun barrel',(.45,-.62,.93),(.45,-.02,1.13),.045,'steel')
            for y in [-.5,-.34,-.18]: sphere('Brass barrel band',(.45,y,1.08),(.049,.014,.049),'gold')
        offset=HANDS['positive']-Vector((.45,-.05,1.05))
        for obj in set(bpy.context.scene.objects)-before:obj.location+=offset
    if role=='tracker':
        before=set(bpy.context.scene.objects)
        curve('Orc hunting bow',[(.48,-.1,.5),(.65,-.16,.78),(.72,-.17,1.15),(.65,-.16,1.4),(.48,-.1,1.7)],.025)
        rod('Bowstring',(.48,-.1,.5),(.48,-.1,1.7),.005,'bone')
        offset=HANDS['positive']-Vector((.72,-.17,1.15))
        for obj in set(bpy.context.scene.objects)-before:obj.location+=offset
    if role in {'orc-armor','commander'}:shoulder_plates()
    if role=='dragonkin':
        curved_wings()
    if role in {'herbalist','stonethrower'}:
        sphere('Woven back basket',(0,.27,1.02),(.23,.16,.3),'wood')
        for i in range(6):
            x=(i-2.5)*.065; rod('Basket upright',(x,.41,.78),(x,.41,1.28),.01)
            if role=='stonethrower': sphere('Sling stone',(x,.28,1.29+(i%2)*.05),(.065,.06,.065),'steel')


def mounted_wolf(mobile):
    """Combine two compatible CC BY-SA 4.0 sources; wolf faces Blender -Y.

    The orc source has a naturally bent-knee stance. Scale it to a small seated
    rider, straddle the real quadruped's back, add saddle and hand-held reins.
    """
    riders=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/f'creature-wolf{"-mobile" if mobile else ""}.glb'))
    imported=[obj for obj in bpy.context.scene.objects if obj not in before]
    wolves=[obj for obj in imported if obj.type=='MESH']
    points=[]
    for obj in wolves:
        matrix=obj.matrix_world.copy();obj.parent=None
        for vertex in obj.data.vertices:
            vertex.co=matrix@vertex.co;points.append(vertex.co.copy())
        obj.matrix_world.identity()
        # Both Fur materials use the identical restored fur PBR. Share the
        # same material without altering UVs, keeping total draws <= 10.
        fur=next((mat for mat in obj.data.materials if mat and mat.name.startswith('Fur.')),None)
        if fur:
            for i,mat in enumerate(obj.data.materials):
                if mat and mat.name.startswith('Fur ligth'):obj.data.materials[i]=fur
    for obj in imported:
        if obj.type!='MESH' and obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
    back=max(point.z for point in points if abs(point.x)<.14 and abs(point.y)<.24)
    offset=Vector((0,.11,back-.41))
    for obj in riders:
        for vertex in obj.data.vertices:
            p=vertex.co.copy()
            # Bend knees farther out to clear the wolf's flanks. UVs stay intact.
            if p.z<.83:
                p.x+=math.copysign(.14*(.83-p.z)/.83,p.x)
                p.y-=.16*(.83-p.z)/.83
            vertex.co=p*.52+offset
    sphere('Fitted leather riding saddle',(0,.11,back+.015),(.19,.26,.045),'leather')
    for side in ['positive','negative']:
        hand=HANDS[side]*.52+offset
        sign=1 if side=='positive' else -1
        curve('Hand-held leather reins',[(sign*.085,-.62,.82),(sign*.16,-.33,.76),tuple(hand)],.009,'wood')


def pack(path,credit,mobile):
    data=path.read_bytes(); n=int.from_bytes(data[12:16],'little'); doc=json.loads(data[20:20+n]); binary=data[28+n:]
    image_views={i['bufferView']:i for i in doc.get('images',[])}; packed=bytearray()
    # Old TGA normal/diffuse sources may have meaningless alpha channels. Only
    # preserve alpha for images actually connected to a transparent material.
    alpha_views=set()
    for mat in doc.get('materials',[]):
        texture=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if mat.get('alphaMode','OPAQUE')!='OPAQUE' and texture:
            image=doc['images'][doc['textures'][texture['index']]['source']]; alpha_views.add(image['bufferView'])
    for index,view in enumerate(doc.get('bufferViews',[])):
        start=view.get('byteOffset',0); content=binary[start:start+view['byteLength']]
        if index in image_views:
            im=Image.open(io.BytesIO(content)); im.thumbnail((480,480) if mobile else (1024,1024)); encoded=io.BytesIO()
            alpha=index in alpha_views and im.mode=='RGBA' and im.getextrema()[3][0]<255
            if alpha: im.save(encoded,format='PNG',optimize=True); mime='image/png'
            else: im.convert('RGB').save(encoded,format='JPEG',quality=86,subsampling=0); mime='image/jpeg'
            content=encoded.getvalue(); image_views[index]['mimeType']=mime
        packed.extend(b'\0'*((-len(packed))%4)); view['byteOffset']=len(packed); view['byteLength']=len(content); packed.extend(content)
    doc['buffers'][0]['byteLength']=len(packed); packed.extend(b'\0'*((-len(packed))%4)); doc['asset']['copyright']=credit
    chunk=json.dumps(doc,separators=(',',':')).encode(); chunk+=b' '*((-len(chunk))%4)
    result=b'glTF'+(2).to_bytes(4,'little')+(28+len(chunk)+len(packed)).to_bytes(4,'little')+len(chunk).to_bytes(4,'little')+b'JSON'+chunk+len(packed).to_bytes(4,'little')+b'BIN\0'+bytes(packed); path.write_bytes(result)
    tris=sum(doc['accessors'][p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'])
    assert tris< (11000 if mobile else 25000),(path.name,tris)
    assert len(result)<(2000000 if mobile else 5000000),(path.name,len(result))
    assert sum(len(m['primitives']) for m in doc['meshes'])<=10
    return dict(file=path.name,bytes=len(result),triangles=tris,sha256=hashlib.sha256(result).hexdigest(),animations=[])


def export(id,mobile):
    source,label,role=SPECS[id]; open_source(source,role); gear(role)
    if role=='wolf-rider':mounted_wolf(mobile)
    # Smooth object poses are frozen; merge by material and decimate only LOD.
    bpy.ops.object.select_all(action='DESELECT'); meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.join(); obj=bpy.context.object
    tris=sum(len(p.vertices)-2 for p in obj.data.polygons)
    target=9500 if mobile else 22000
    if tris>target:
        modifier=obj.modifiers.new('Geometry LOD','DECIMATE'); modifier.ratio=target/tris
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.validate(verbose=False,clean_customdata=False)
    obj.data.update()
    # UVs for newly authored equipment use box projection; source UVs survive.
    for image in bpy.data.images:
        if image.size[0] and image.name not in {'Render Result','Viewer Node'}:
            maximum=480 if mobile else 1024
            if max(image.size)>maximum:
                scale=maximum/max(image.size); image.scale(round(image.size[0]*scale),round(image.size[1]*scale))
    path=OUT/f'{id}{"-mobile" if mobile else ""}.glb'; credit=f'{SOURCES[source]["author"]}, {SOURCES[source]["license"]}; adapted posed mesh, original equipment, LOD and PBR conversion by Mage Knight Solo project; derivative GLB retains source license'
    if role=='wolf-rider':credit+='; wolf by Danimal, Micket and Poss, CC-BY-SA-4.0 (https://opengameart.org/content/wolf-monsters-animated); composite GLB CC-BY-SA-4.0'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_image_format='AUTO',export_extras=False)
    return pack(path,credit,mobile)


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--only',choices=list(SPECS)); args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True); records=[]; catalog=[]
    for id in ([args.only] if args.only else SPECS):
        source,label,role=SPECS[id]
        for mobile in [False,True]:
            record=export(id,mobile); records.append(record); print('ASSET',json.dumps(record),flush=True)
        catalog.append(dict(id=id,name=label,role=role,sourceBase=source,**{k:v for k,v in SOURCES[source].items() if k!='path'},height=1.38,width=1.25,modifications='Posed licensed mesh with newly modeled role equipment; static tabletop adaptation, not an official likeness; shared anatomy is disclosed.'))
        if role=='wolf-rider':
            catalog[-1]['species']='mounted-orc'
            catalog[-1]['author']+='; wolf: Danimal, Micket, Poss'
            catalog[-1]['secondarySources']=[dict(author='Danimal, Micket, Poss',license='CC-BY-SA-4.0',source='https://opengameart.org/content/wolf-monsters-animated',licenseUrl=CC+'by-sa/4.0/')]
            catalog[-1]['modifications']='Compatible CC BY-SA 4.0 orc and real quadruped wolf combined into a static mounted rider; scaled seated orc, bent legs, fitted saddle and hand-held reins. Composite remains CC BY-SA 4.0.'
        for name,items in [('actor-manifest.json',records),('actor-catalog.json',catalog)]:
            path=OUT/name; previous=json.loads(path.read_text()) if path.exists() else []; key='file' if 'manifest' in name else 'id'; merged={x[key]:x for x in previous+items}; path.write_text(json.dumps(list(merged.values()),indent=2,ensure_ascii=False)+'\n')
