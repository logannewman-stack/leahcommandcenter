import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

// Light and dark follow the device, as the Practice's default does.
const dark = window.matchMedia?.("(prefers-color-scheme: dark)");
const follow = () => document.documentElement.classList.toggle("dark", Boolean(dark?.matches));
follow();
dark?.addEventListener?.("change", follow);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
