import { createRoot } from "react-dom/client";
import Game from "../app/game";
import "../app/globals.css";
import "./mobile.css";

const root = document.getElementById("root");
if (!root) throw new Error("Android application root was not found.");

createRoot(root).render(<Game />);
