import "./style.css";
import { GameApp } from "./core/GameApp";

/** Root host element used by Pixi renderer canvas. */
const host = document.querySelector<HTMLDivElement>("#app");

if (!host) {
  throw new Error("Missing #app container");
}

const game = new GameApp();

/** Bootstrap and surface startup errors in the page for quick debugging. */
game.init(host).catch((error) => {
  console.error("Failed to bootstrap game", error);
  host.innerHTML =
    "<pre style='padding:24px;color:#ffd5dd'>Failed to start game. See console for details.</pre>";
});
