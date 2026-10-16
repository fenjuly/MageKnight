import type { RuinToken } from "../lib/game-data";

const REWARD_GLYPHS: Record<RuinToken["reward"], string> = {
  artifact: "器",
  spell: "法",
  advanced: "进",
  crystals: "晶",
  fame: "誉",
};

const REWARD_LABELS: Record<RuinToken["reward"], string> = {
  artifact: "圣器",
  spell: "法术",
  advanced: "进阶",
  crystals: "水晶",
  fame: "名望",
};

export function RuinTokenBadge({ token, compact = false, hidden = false }: { token?: RuinToken; compact?: boolean; hidden?: boolean }) {
  const concealed = hidden || !token;
  return (
    <span
      className={`ruin-token-ui ${compact ? "compact" : ""} ${concealed ? "concealed" : "revealed"} ${token?.altarColor ? `altar mana-${token.altarColor}` : "encounter"}`}
      title={concealed ? "尚未翻开的黄色遗迹标记" : `${token?.name}：${token?.description}`}
      aria-label={concealed ? "尚未翻开的黄色遗迹标记" : `${token?.name}。${token?.description}`}
    >
      {concealed ? <strong className="ruin-token-back">⌁</strong> : <>
        <span className="ruin-token-pips" aria-hidden="true">
          {token.altarColor
            ? <i className={`ruin-mana-pip mana-${token.altarColor}`}>◆</i>
            : token.enemies.map((color, index) => <i key={`${color}-${index}`} className={`ruin-enemy-pip token-${color}`} />)}
        </span>
        <strong className="ruin-token-glyph">{token.altarColor ? "祭" : REWARD_GLYPHS[token.reward]}</strong>
        <small>{token.altarColor ? "3 → 7" : REWARD_LABELS[token.reward]}</small>
      </>}
    </span>
  );
}
