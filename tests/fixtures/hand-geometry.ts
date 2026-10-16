/** Real-browser oracle: inspect glyph boxes, not only CSS declaration strings.
 * Compact effects intentionally show two summary lines; full text stays in
 * the preview/selected card. Check that those visible lines aren't cut mid-glyph. */
export function auditHandText() {
  const issues: Array<{ card: string; part: string; problem: string }> = [];
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".hand-card-tab"));
  for (const card of cards) {
    const name = card.querySelector(".hand-card-tab-copy > strong")?.textContent ?? "";
    const box = card.getBoundingClientRect();
    const rows = Array.from(card.querySelectorAll<HTMLElement>(".hand-card-tab-copy > strong, .hand-card-tab-copy > .hand-card-tab-effect"));
    let previousBottom = -Infinity;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.top < box.top - .5 || rect.bottom > box.bottom + .5) issues.push({ card: name, part: row.className || "牌名", problem: "文字行超出卡牌上下边界" });
      if (rect.top < previousBottom - .5) issues.push({ card: name, part: row.className || "牌名", problem: "相邻文字行重叠" });
      previousBottom = rect.bottom;
      const text = row.matches("strong") ? row : row.querySelector("b");
      if (!text) continue;
      const textBox = text.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(text);
      const ink = Array.from(range.getClientRects());
      const visibleLines = row.matches("strong") ? ink : ink.slice(0, 2);
      if (visibleLines.some((line) => line.top < textBox.top - .5 || line.bottom > textBox.bottom + .5)) {
        issues.push({ card: name, part: row.className || "牌名", problem: "实际字形被行高裁切" });
      }
    }
    for (const text of card.querySelectorAll<HTMLElement>(".hand-card-hover-preview > span > strong, .hand-card-hover-preview b")) {
      if (text.scrollHeight > text.clientHeight + 1) issues.push({ card: name, part: "完整预览", problem: "预览文字纵向溢出" });
    }
  }
  return { cards: cards.length, issues };
}
