import { readFile } from "node:fs/promises";
import { UI_REPORT_PATH, uiFingerprint, validateUiReport } from "./ui-report.mjs";
try {
  const report=JSON.parse(await readFile(UI_REPORT_PATH,"utf8"));
  console.log(`Verified ${validateUiReport(report,await uiFingerprint())} real-browser Android layout/interaction cases against current source.`);
} catch(error) {
  console.error(error.code==="ENOENT"?"没有当前源码的浏览器UI验收报告。运行 npm run test:ui 并点击‘运行全部检查’，完成后重新执行测试。":error.message);
  process.exitCode=1;
}
