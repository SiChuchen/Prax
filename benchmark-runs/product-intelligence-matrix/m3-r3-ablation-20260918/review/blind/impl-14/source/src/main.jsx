import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// 初始文档为模块内联数据：首屏即 ready，无加载态。
createRoot(document.getElementById("root")).render(<App />);
