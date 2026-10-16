import assert from "node:assert/strict";
import test from "node:test";
import { uiCases, requiredUiChecks } from "../scripts/ui-contract.mjs";
import { readUiReportBody, validateUiReport } from "../scripts/ui-report.mjs";
const report=()=>({version:1,fingerprint:"current",results:uiCases().map(c=>({...c,passed:true,checks:requiredUiChecks(c.scenario).map(name=>({name,passed:true}))}))});
test("the UI gate requires all 80 real-browser cases",()=>assert.equal(validateUiReport(report(),"current"),80));
test("stale source fingerprints cannot reuse an earlier passing report",()=>assert.throws(()=>validateUiReport(report(),"new-source"),/源码已变化/));
test("missing cases, duplicated cases and failed hit tests block delivery",()=>{
  const missing=report();missing.results.pop();assert.throws(()=>validateUiReport(missing,"current"));
  const duplicate=report();duplicate.results[1]=duplicate.results[0];assert.throws(()=>validateUiReport(duplicate,"current"));
  const blocked=report();blocked.results[0].checks[0].passed=false;assert.throws(()=>validateUiReport(blocked,"current"));
  const skipped=report();skipped.results[0].checks.pop();assert.throws(()=>validateUiReport(skipped,"current"));
});
test("HTTP chunks splitting Chinese characters preserve every required check",async()=>{
  const bytes=Buffer.from(JSON.stringify(report()));
  async function* oneByteChunks(){for(const byte of bytes)yield Buffer.from([byte]);}
  assert.equal(validateUiReport(await readUiReportBody(oneByteChunks()),"current"),80);
});
test("oversized HTTP reports cannot be persisted",async()=>{
  async function* huge(){yield Buffer.alloc(1_000_001);}
  await assert.rejects(readUiReportBody(huge()),/Report too large/);
});
