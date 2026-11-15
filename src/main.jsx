import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { applyDark, initialDark } from "@/lib/theme";
import "@/index.css";
import "@/styles/command-center.css";

// Light or dark before the first paint: the team member's pick, else the device.
applyDark(initialDark());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
