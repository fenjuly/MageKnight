export type UiCase={id:string;width:number;height:number;fontScale:number;scenario:string};
export const UI_SIZES:Array<[number,number]>;
export const UI_SCENARIOS:string[];
export const UI_SCALES:number[];
export const UI_SOURCE_FILES:string[];
export function uiCases():UiCase[];
export function requiredUiChecks(scenario:string):string[];
