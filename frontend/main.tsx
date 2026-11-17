import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { watchVisualViewport } from "./lib/visualViewport";

// Dialogs stay above a phone's keyboard (lib/visualViewport.ts).
watchVisualViewport();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("SW registered:", reg.scope);
      })
      .catch((err) => {
        console.log("SW registration failed:", err);
      });
  });
}
