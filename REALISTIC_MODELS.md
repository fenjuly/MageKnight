# 精细 3D 微缩模型与素材许可

已将基础版与 Ultimate 扩展的 198 个可建模元素接入精细资源：7 名英雄、130 枚敌人标记、30 种盟军、10 种地形和 21 类地点。图鉴“精细模型”可查看并与原简约模型对比。当前有 166 份近景/移动 GLB（83 对），其中 80 对用于现有元素，另 3 对是备用原型。

这是面向写实材质与立体结构的桌游微缩风格，不是 AAA 写实画质、官方雕像复刻或 198 个完全独立雕刻。敌人数值变体、部分职业及元素色系会复用网格；例如龙族共用身体、火冰法师共用长袍，英雄与盟军也可能使用相同来源身体再适配装备。来源中部分较老模型的面数和纹理分辨率仍偏低；美术质量不能用技术覆盖率代替。

`npm run models:coverage` 生成 `outputs/model-coverage/coverage.md` 与 JSON，逐项检查映射、文件、SHA256，列出共享模型及实际文件复用。当前 198/198 技术覆盖、0 缺口，104 个外观映射使用 80 个近景几何文件。所有已交付 GLB（含备用）都参加预算、许可与材质测试。

## 资产来源

| 游戏组件 | 原素材、作者 | 许可 | 本项目修改 |
| --- | --- | --- | --- |
| 托瓦克 | [Knight — piacenti](https://opengameart.org/content/knight-2) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 将 Blender 材质转换为 glTF 金属/粗糙度 PBR，保留颜色、法线、金属度、粗糙度；生成低细节网格与压缩贴图，统一比例 |
| 掘地者（两枚数值变体） | [Orc (3D) — Guillaume “GuieA_7” Englert](https://opengameart.org/content/orc-3d) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 恢复旧纹理连接、转换金属与皮革材质、导出骨骼与原作者动画；两份衍生 GLB 仍按 CC BY-SA 4.0 提供 |
| 要塞 | [Medieval Gatehouse — Daniel Andersson](https://opengameart.org/content/medieval-gatehouse) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 合并静态网格以降低绘制调用，恢复石材、木材、锈铁与旗帜贴图，生成轻量版本 |
| 平原 | [Rocky Terrain 02 — Poly Haven](https://polyhaven.com/a/rocky_terrain_02) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 使用 1K 颜色/法线/粗糙度；本项目新建有厚度和起伏的六角地表、弯曲草叶与碎石，地表网格也按 CC0 提供 |

署名、许可和修改说明也显示在游戏内模型图鉴中，并写入 GLB 的 copyright 字段。上述作者不表示认可或赞助本项目。来源未执行任何自动脚本。未提取其他商业游戏的资产，未使用《魔法骑士》原版模型。

### 本批扩充来源与原创内容

| 范围 | 来源与许可 | 适配内容 |
| --- | --- | --- |
| 女性英雄、女祭司/大师、女巫 | [Elf — Contmike / Danimal](https://opengameart.org/content/elf-game-ready-and-animated)，CC-BY-SA-3.0；原头发 MajorNightmare、弓 Yd 的 CC0 贡献保留署名 | 站姿烘焙、服装/护甲/披风/双刃与权杖、保留透明发丝；不是人物原画复刻 |
| 精灵统帅、林务官/斥候 | [Elven Archer — thecubber](https://opengameart.org/content/rigged-textured-elven-archer)，CC-BY-SA-3.0；Julius 骨架与 OGA 社区署名 | 修复合并 UV、保留肤色与耳部，适配冠饰、肩甲或弓箭 |
| 德鲁伊、男性法师、僧侣/草药师等 | [Mage — thecubber](https://opengameart.org/content/rigged-textured-mage)，CC-BY-SA-3.0 | 不同职业工具、鹿角杖/环杖/药篓；共用长袍身体 |
| 龙人英雄、龙族召唤者 | [Rigged textured Reptile — thecubber / OGA](https://opengameart.org/content/rigged-textured-reptile)，选用 CC-BY-3.0 | 鳞片材质、龙翼膜与指骨、独立权杖角色 |
| 巨龙家族、兽人职业与狼骑兵 | [Dragon — GuieA_7](https://opengameart.org/content/dragon-3d)、上表 Orc，CC-BY-SA-4.0；狼另保留作者 | 同族共享身体，武器/肩甲/坐骑另行适配；元素色系明确是材质变体 |
| 狼人与巨狼 | [WarWolf — ThetankOmeter / TripleSnail](https://opengameart.org/content/warwolf)，CC0；[Wolf monsters — Micket / Poss / Danimal](https://opengameart.org/content/wolf-monsters-animated)，CC-BY-SA-4.0 | 双足狼人和四足狼使用不同模型；狼骑兵为坐骑与兽人组合 |
| 僵尸、恶魔、骷髅、石像鬼、牛头怪、土元素 | [Thin Zombie — Rosswet Mobile](https://opengameart.org/content/thin-zombie-awake-zombie-asset)、[Night Demon — Morgan Strauss / nubux](https://opengameart.org/content/night-demon)、[Minotaur — Clint Bellanger](https://opengameart.org/content/minotaur)、[Earth Elemental — piacenti](https://opengameart.org/content/earth-elemental-golem)，CC-BY-3.0；[Skeleton — Gord Goodwin](https://opengameart.org/content/skeleton-with-rig)、[Gargoyle — yd](https://opengameart.org/content/gargoyle)，CC0 | 修复 PBR、自然站姿、UV、骨质/雕塑石材；食尸鬼共用亡者网格并注明 |
| 环境与特殊物种 | 本项目原创建筑、地表、植被、羽片、蛇身、多头、幽灵、木乃伊、投石车等，CC0；石木/地表纹理来自上表 CC0 来源 | 美杜莎、水晶精灵、半人马组合了授权人物上身，整体 GLB 保留 CC-BY-SA-3.0；不是独立艺术家雕刻或摄影扫描 |

每个源与复合资源的作者、许可证、下载出处、修改说明都保存在 `public/models/realistic/*-catalog.json` 和离线 `CREDITS.txt`。新增脚本在载入任何 Blender 文件时禁用源脚本；FBX 仅解析数字几何数据。ShareAlike 衍生模型保留原资产许可，不将其误标为原创 CC0。

## 运行策略

- 默认“精细模型＋清晰”：所有已登记组件使用移动端 GLB，缺文件或加载失败时保留可选中的简约造型。
- “超清”加载近景完整版本与远景移动版，通过 LOD 切换；“省电”直接保留原简约造型。模型图鉴展示完整版本，方便近距离检查。
- 地图风格可切换为“简约”。模型风格和画质偏好会保存；切换不改变游戏状态或地图相机。
- GLB、贴图、动画全部在本地与 APK 内；运行时不访问模型网站，不需要在线解码服务。
- 同一渲染器按实际文件 URL 缓存，共享网格和纹理；实例使用独立骨骼与着色材质。同源色系不会重复下载。闲置缓存最多保留 4 份资源，活跃实例不被淘汰；关闭后清理纹理、几何体与动画，已销毁的实例不会被延迟加载重新添加。
- 加载失败保留可选中的简约模型，并显示回退提示。模型映射只接收规则层允许显示的敌人，不会加载面朝下敌人的身份模型。
- 原掘地者使用原作者待机动画；其余新增模型采用烘焙站姿，目前没有角色行走、攻击的完整动画状态机。没有在 Android 真机测量帧率、发热或 GPU 内存；桌面浏览器手机尺寸验收不等同真机性能验收。

## 重新生成资产

日常 `npm run android:apk` 直接使用已生成的资源，不需要 Blender。

需要修改模型时，准备 Blender 4.5 或隔离环境 `bpy==4.5.14`、Pillow，将三个来源 ZIP 解压到以下路径：

```text
work/realistic-sources/knight/armor.blend
work/realistic-sources/orc/Orc/orc.blend
work/realistic-sources/orc/Orc/orc.png
work/realistic-sources/orc/Orc/warhammer.png
work/realistic-sources/gatehouse/<原目录>/GateHouse2Upload.blend
```

三张 Poly Haven 1K JPEG 分别存为 `public/models/realistic/ground-color.jpg`、`ground-normal.jpg`、`ground-roughness.jpg`。颜色图为 sRGB，法线和粗糙度为线性数据。扩充源入口与材质映射见各脚本中的 SOURCES/SPECS 及 `work/realistic-sources/expansion-creatures/inventory.json`。原始来源文件另行收集，不随 APK 打包。

```bash
python scripts/build-realistic-models.py
python scripts/build-realistic-environments.py
python scripts/build-realistic-actors.py
python scripts/build-realistic-creatures.py
# 特殊物种含组合人物，应在 actors 导出后运行
python scripts/build-realistic-specials.py
npm run models:assemble
npm run models:coverage
# 或 Blender 后台模式（-- 后的参数按需指定 --only）
blender --background --python scripts/build-realistic-models.py
npm run test:3d
npm run test:full
npm run android:apk
```

各作者脚本写自己的 catalog/manifest；assemble 验证哈希后合并为主 `manifest.json`、离线署名和运行时目录。移动版每份 <2 MB / 11k 三角，近景 <5 MB / 25k 三角，最多 10 个材质绘制单元。透明头发保留 PNG，其余贴图压缩 JPEG。检查全部预算与许可后才能交付。原始 ZIP、模型编辑器和 Python 环境位于被忽略的 `work/`，不进入 APK。
