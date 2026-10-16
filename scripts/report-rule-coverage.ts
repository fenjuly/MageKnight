import { ALL_CARD_DEFS, ALL_ENEMY_TOKENS, ALL_HERO_SKILLS, ALL_RUIN_TOKENS, ALL_UNIT_DEFS } from "../lib/game-data";
import { CARD_RULE_GAPS, COMBAT_RULE_GAPS, OPEN_RULE_GAPS, SITE_COVERAGE, SITE_RULE_GAPS, SKILL_RULE_GAPS, UNIT_RULE_GAPS } from "../tests/rule-coverage-registry";

const executableCardBranches = Object.values(ALL_CARD_DEFS).reduce((sum, card) =>
  sum + (card.basic.choices?.length ?? 1) + (card.powered.choices?.length ?? 1), 0);
const explicitChoiceGuards = Object.values(ALL_CARD_DEFS).reduce((sum, card) =>
  sum + Number(Boolean(card.basic.choices?.length)) + Number(Boolean(card.powered.choices?.length)), 0);
const unitAbilities = Object.values(ALL_UNIT_DEFS).reduce((sum, unit) => sum + (unit.abilities?.length ?? 0), 0);

console.log("Mage Knight 规则覆盖报告");
console.log(`- 卡牌：${Object.keys(ALL_CARD_DEFS).length} 张；${executableCardBranches} 个可执行模式/分支；${explicitChoiceGuards} 个缺省选择拒绝用例`);
console.log(`- 盟军：${Object.keys(ALL_UNIT_DEFS).length} 种；${unitAbilities} 项可选能力`);
console.log(`- 英雄技能：${Object.values(ALL_HERO_SKILLS).flat().length} 项`);
console.log(`- 敌人：${ALL_ENEMY_TOKENS.length} 枚`);
console.log(`- 地点：${Object.keys(SITE_COVERAGE).length} 种；黄色遗迹标记：${ALL_RUIN_TOKENS.length} 枚`);
console.log(`- 明确规则缺口：${OPEN_RULE_GAPS.length}（卡牌 ${CARD_RULE_GAPS.length}、盟军 ${UNIT_RULE_GAPS.length}、技能 ${SKILL_RULE_GAPS.length}、地点 ${SITE_RULE_GAPS.length}、战斗 ${COMBAT_RULE_GAPS.length}）`);

if (OPEN_RULE_GAPS.length) {
  console.log("\n尚未完成的逐字规则语义：");
  for (const gap of OPEN_RULE_GAPS) console.log(`- [${gap.id}] ${gap.title}\n  ${gap.reason}`);
}
