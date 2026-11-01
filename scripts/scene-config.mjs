/**
 * The toolkit's section of the shared "Table Tools" tab in Scene Configuration (wanderers-core sceneTab; one tab for every module that
 * vendors core). Before 1.27.0 the toolkit added its own fields to the Basics tab. The section holds, for the tools that are on:
 * zone title card (zoneTitles), Dungeon (vendorTrash) and the scene's inns (restedInn). Title card and Dungeon are form fields named
 * flags.wayfarers-toolkit.* and save with the window; inns are records edited with their own buttons (saved at once).
 */
import { sceneTab } from "../vendor/wanderers-core/foundry/index.mjs";
import * as F from "./features.mjs";
import * as ZoneTitles from "./zone-titles.mjs";
import * as Trash from "./trash.mjs";
import * as Inn from "./inn.mjs";

const ID = "wayfarers-toolkit";
const head = t => `<h4 class="wct-st-head" style="margin:0.6em 0 0.2em;">${t}</h4>`;

/** Which parts the section shows, from the tools that are on (pure over `on`). */
export const parts = on => ["zoneTitles", "vendorTrash", "restedInn"].filter(id => on(id));

/** Called from init: adds the section when at least one of its tools is on (a turned-off tool adds nothing). */
export function init() {
  const p = parts(F.on); if (!p.length) return;
  sceneTab.addSection(ID, {
    title: "Wayfarer's Toolkit",
    order: 10,
    render: (app, scene) => {
      if (!game.user.isGM || !scene) return "";
      const el = document.createElement("div");
      if (p.includes("zoneTitles")) el.insertAdjacentHTML("beforeend", head("Title card") + ZoneTitles.sceneFields(scene));
      if (p.includes("vendorTrash")) el.insertAdjacentHTML("beforeend", head("Vendor Trash") + Trash.dungeonField(scene));
      if (p.includes("restedInn")) { el.insertAdjacentHTML("beforeend", head("Inns")); el.append(Inn.sceneSection(scene)); }
      return el;
    }
  });
}
