import ReactDOM from "react-dom/client";
import "./design-system/styles.css";
import "./site.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root; index.html should provide it");

ReactDOM.createRoot(root).render(<App />);
