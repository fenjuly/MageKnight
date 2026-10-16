import type { Plugin } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { UI_REPORT_PATH, readUiReportBody, uiFingerprint, validateUiReport } from "../scripts/ui-report.mjs";

/** Loopback dev-only report endpoint; never included in game/APK builds. */
export function uiTestPlugin():Plugin {
  return {name:"local-ui-regression",apply:"serve",configureServer(server){
    server.middlewares.use(async(req,res,next)=>{
      if(!req.url?.startsWith("/__ui-test/"))return next();
      res.setHeader("Content-Type","application/json"); res.setHeader("Cache-Control","no-store");
      try {
        if(req.method==="GET"&&req.url==="/__ui-test/version")return res.end(JSON.stringify({fingerprint:await uiFingerprint()}));
        if(req.method!=="POST"||req.url!=="/__ui-test/report"||req.headers.origin!==`http://${req.headers.host}`){res.statusCode=403;res.end('{}');return;}
        const report=await readUiReportBody(req);validateUiReport(report,await uiFingerprint());
        await mkdir(dirname(UI_REPORT_PATH),{recursive:true});await writeFile(UI_REPORT_PATH,JSON.stringify(report,null,2));
        res.end(JSON.stringify({saved:true}));
      }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error instanceof Error?error.message:String(error)}));}
    });
  }};
}
