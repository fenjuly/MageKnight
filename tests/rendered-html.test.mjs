import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Mage Knight solo game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>魔法骑士：单人征服<\/title>/i);
  assert.match(html, /MAGE KNIGHT/);
  assert.match(html, /选择组件版本/);
  assert.match(html, /Ultimate Edition 全扩展/);
  assert.match(html, /使用此.*板块牌库开始/);
  assert.match(html, /随机抽板块，板块内容固定/);
  assert.match(html, /重抽预览/);
  assert.match(html, /游戏百科/);
  assert.match(html, /规则楔形/);
  assert.match(html, /全开放/);
  assert.match(html, /三列开放/);
  assert.match(html, /本地单人规则原型/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
