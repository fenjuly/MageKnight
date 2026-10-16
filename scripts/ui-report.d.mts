export const UI_REPORT_PATH:string;
export function readUiReportBody(stream:AsyncIterable<Uint8Array>):Promise<unknown>;
export function uiFingerprint():Promise<string>;
export function validateUiReport(report:unknown,fingerprint:string):number;
