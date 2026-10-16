# 官方素材收集与许可边界

截至 2026-08-13，项目只自动下载 WizKids 在《Mage Knight: Ultimate Edition》产品页明确标为下载项的三份官方文档：基础规则、扩展规则和教学册。它们仅进入本机 `.cache/official-assets/reference/`，用于规则核查，不进入 `public/`、网页构建或 Android 包，也不会提交到版本库。

运行：

```bash
npm run assets:official
```

收集完成后，`.cache/official-assets/report.json` 会记录最终来源、文件大小、SHA-256、用途限制及发现但未下载的候选图片。下载器只接受 `official-assets/manifest.json` 中的 HTTPS 官方域名和白名单状态，遇到重定向到非官方域名、错误内容类型或缺少许可证据时会直接失败。

## 当前审计结论

- [Ultimate Edition 官方产品页](https://wizkids.com/mage-knight-ultimate-edition/)公开了三份规则文档下载和一组宣传图库。
- [WizKids/NECA 使用条款](https://win.wizkids.com/terms.php)只授予访问、使用和展示网站的有限许可，并禁止未经书面许可复制、修改、再分发或制作衍生内容。
- 因此，规则 PDF 可作为本机参考资料归档，但不能随游戏发布；产品宣传图只能登记 URL，不能下载后裁切成卡牌、Token、人物或地点 UI。
- 当前可直接接入游戏 UI 的官方原版图片数量为 **0**。这不是资源缺失，而是尚未发现覆盖该用途的明确授权。

## 获取书面授权后如何启用

将官方书面许可保存在本地留档后，为对应清单项补充 `permissionEvidence`、许可范围、期限和署名要求，再把状态改为明确授权状态。测试会拒绝任何缺少书面证据却被标记为 `uiEligible` 的资源。

建议向 `press@wizkids.com` 询问以下精确范围：允许在仅供本人使用、不公开分发的本地网页应用中，下载、裁切、缩放并显示 Mage Knight: Ultimate Edition 官方产品图或组件图；是否允许打包进本地 Android APK；是否需要署名或版权声明。不要把普通产品页、零售商素材页或“可下载”按钮自行解释为上述授权。
