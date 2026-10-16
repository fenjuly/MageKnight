// One manifest is consumed by the real-browser runner and the report gate.
export const UI_SIZES = [[568,320],[640,360],[844,390],[960,540],[1280,720]];
export const UI_SCENARIOS = ["intel","play-draw","ranged","block","damage","attack","multi","resources"];
export const UI_SCALES = [1,1.25];
export const UI_SOURCE_FILES = [
  "app/game.tsx","app/globals.css","mobile/mobile.css","lib/game-engine.ts","lib/game-data.ts","lib/base-components.ts","lib/ultimate-components.ts",
  "tests/fixtures/android-control-states.ts",
  "tests/fixtures/android-controls.tsx","tests/fixtures/ui-reachability.ts","tests/fixtures/android-ui-runner.tsx",
  "tests/fixtures/combat-states.ts","scripts/ui-contract.mjs","scripts/ui-report.mjs","build/ui-test-plugin.ts",
  "mobile/android-ui-test.html","mobile/android-ui-case.html","mobile/android-ui-test.tsx","mobile/android-ui-case.tsx",
];
export function uiCases() {
  return UI_SIZES.flatMap(([width,height])=>UI_SCALES.flatMap(fontScale=>UI_SCENARIOS.map(scenario=>({
    id:`${width}x${height}@${fontScale}:${scenario}`,width,height,fontScale,scenario,
  }))));
}
export function requiredUiChecks(scenario){
  return ["实际视口匹配","抽牌前的敌人特性入口可达","敌人特性入口可达","特性说明在顶层打开","特性最后一段可滚动阅读","关闭特性说明可达","关闭特性后返回原界面","整页无纵向滚动",
    ...(scenario!=="intel"?["抽1张按钮可达","抽牌真实结算并消耗点数"]:[]),
    ...(scenario==="play-draw"?["选择卡牌抽牌效果","确认出牌"]:[]),
    ...(scenario==="resources"?["治疗按钮可达",...['red','blue','green','white'].map(c=>`凝聚${c}水晶按钮可达`)]:[]),
  ];
}
