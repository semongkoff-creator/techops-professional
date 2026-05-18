import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.satriapiranti.techops",
  appName: "Satria Piranti Perkasa",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Keep single codebase: Android shell loads deployed web app.
    // Override with CAPACITOR_WEB_URL if needed.
    url: process.env.CAPACITOR_WEB_URL || "https://techops-professional.vercel.app",
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#F2F4F7",
      overlaysWebView: false,
    },
  },
};

export default config;
