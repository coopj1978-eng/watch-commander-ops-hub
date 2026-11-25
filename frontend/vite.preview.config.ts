import { defineConfig, type Plugin } from "vite";
import path from "path";
import fs from "fs";
import https from "https";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// A preview of the app on this computer only (Nov 2026).
//
// The pages come from the code in this folder — including changes that
// haven't been published — while everything the app asks the server for is
// passed on to the staging server. So a change can be looked at with real
// data before it reaches anyone's phone. Nothing here is deployed.
//
//   bunx vite --config vite.preview.config.ts --host 127.0.0.1 --port 5180
//
// Open it at http://127.0.0.1:5180 (not "localhost": the app treats that
// name as "the server is on this machine"). You sign in on it separately.
// Careful: it is the real staging data, so anything saved here is saved.

const STAGING = "staging-watch-commander-ops-hub-8spi.encr.app";

function passApiCallsToStaging(): Plugin {
  const isFile = (p: string) => {
    try { return fs.statSync(p).isFile(); } catch { return false; }
  };
  return {
    name: "pass-api-calls-to-staging",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const pathOnly = decodeURIComponent(url.split("?")[0]);
        const get = req.method === "GET" || req.method === "HEAD";
        // A page being opened, Vite's own files, or a file in this folder: ours.
        const page = get && (req.headers.accept ?? "").includes("text/html");
        const vite = pathOnly.startsWith("/@") || pathOnly.startsWith("/node_modules/") || pathOnly.startsWith("/__");
        const ours = get && (isFile(path.join(__dirname, pathOnly)) || isFile(path.join(__dirname, "public", pathOnly)));
        if (page || vite || ours) return next();

        // Anything else is the app talking to its server.
        const headers = { ...req.headers, host: STAGING };
        delete headers.origin;
        delete headers.referer;
        const upstream = https.request({ host: STAGING, path: url, method: req.method, headers }, (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        });
        upstream.on("error", (e) => {
          res.statusCode = 502;
          res.end(`Preview could not reach staging: ${String(e)}`);
        });
        req.pipe(upstream);
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "~backend/client": path.resolve(__dirname, "./client"),
      "~backend": path.resolve(__dirname, "../backend"),
    },
  },
  plugins: [passApiCallsToStaging(), tailwindcss(), react()],
  mode: "development",
});
