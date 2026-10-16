import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.local.mageknightsolo",
  appName: "魔法骑士：单人征服",
  webDir: "dist-mobile",
  backgroundColor: "#0c1818",
  loggingBehavior: "debug",
  android: {
    path: "android",
    allowMixedContent: false,
    captureInput: true,
    backgroundColor: "#0c1818",
  },
};

export default config;
