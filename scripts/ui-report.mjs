import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { UI_SOURCE_FILES, uiCases, requiredUiChecks } from "./ui-contract.mjs";

export const UI_REPORT_PATH = fileURLToPath(new URL("../outputs/qa/android-ui-report.json",import.meta.url));
export async function readUiReportBody(stream) {
  const chunks=[];let size=0;
  for await(const chunk of stream){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>1_000_000)throw new Error("Report too large");chunks.push(bytes);}
  // HTTP chunks can split a Chinese UTF-8 character. Decode only after joining bytes.
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function uiFingerprint() {
  const hash=createHash("sha256");
  for(const path of UI_SOURCE_FILES) { hash.update(path);hash.update(await readFile(new URL(`../${path}`,import.meta.url))); }
  return hash.digest("hex");
}
export function validateUiReport(report,fingerprint) {
  if(report?.version!==1 || report.fingerprint!==fingerprint)throw new Error("UI验收报告缺失或源码已变化。请运行 npm run test:ui，在浏览器点击‘运行全部检查’。");
  const expected=uiCases(), seen=new Set();
  if(report.results?.length!==expected.length)throw new Error(`需要完整的${expected.length}组浏览器检查`);
  for(const entry of expected) {
    const result=report.results.find((item)=>item.id===entry.id);
    const failures=!result?["缺少场景"]:seen.has(result.id)?["重复场景"]:!result.passed?["场景失败"]:!result.checks?.length?["缺少检查"]:[
      ...result.checks.filter(c=>!c.passed).map(c=>c.name),
      ...requiredUiChecks(entry.scenario).filter(name=>!result.checks.some(c=>c.name===name&&c.passed)).map(name=>`缺少必测项：${name}`),
    ];
    if(failures.length)throw new Error(`UI验收未通过：${entry.id}（${failures.join("；")}）`);
    seen.add(result.id);
  }
  return expected.length;
}
