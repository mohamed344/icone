import { STORAGE_KEY } from "./theme-config";

/**
 * A self-contained script string injected synchronously into <head> so the
 * correct theme / direction / background / style is applied BEFORE first paint
 * (no flash). Must not reference anything outside its own closure.
 * Mirrors applyTheme() in theme-config.ts.
 */
export const NO_FLASH_SCRIPT = `(function(){try{
  var KEY=${JSON.stringify(STORAGE_KEY)};
  var accents={sky:["#0ea5e9","#22d3ee","#ffffff"],ocean:["#0284c7","#0ea5e9","#ffffff"],indigo:["#4f46e5","#818cf8","#ffffff"],teal:["#0d9488","#2dd4bf","#ffffff"],violet:["#7c3aed","#c084fc","#ffffff"],rose:["#e11d48","#fb7185","#ffffff"],amber:["#d97706","#fbbf24","#1a1304"],slate:["#475569","#94a3b8","#ffffff"]};
  var backgrounds={white:["#ffffff","#f4f7fb"],sky:["#e0f2fe","#f0f9ff"],cloud:["#eef2f7","#f8fafc"],sand:["#f7f1e7","#fffdf8"],mint:["#dcf5ea","#f0fdf9"],lavender:["#ece9fb","#f6f4fe"]};
  var fonts={geist:"var(--font-geist-sans)",display:"var(--font-display)","mono-ish":"var(--font-geist-mono)"};
  var s={mode:"light",accent:"sky",background:"white",style:"flat",font:"geist",density:"comfortable",language:"fr"};
  try{var raw=localStorage.getItem(KEY);if(raw){var p=JSON.parse(raw);for(var k in p){if(p[k]!=null)s[k]=p[k];}}}catch(e){}
  var r=document.documentElement;
  var mode=s.mode;
  if(mode==="system"){mode=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
  r.dataset.theme=mode;
  r.dataset.density=s.density;
  r.dataset.font=s.font;
  r.dataset.style=s.style;
  r.dir=s.language==="ar"?"rtl":"ltr";
  r.lang=s.language;
  var a=accents[s.accent]||accents.sky;
  r.style.setProperty("--accent",a[0]);
  r.style.setProperty("--accent-2",a[1]);
  r.style.setProperty("--accent-contrast",a[2]);
  r.style.setProperty("--app-font",(fonts[s.font]||fonts.geist)+", system-ui, sans-serif");
  if(mode==="light"){var b=backgrounds[s.background]||backgrounds.white;r.style.setProperty("--bg",b[0]);r.style.setProperty("--bg-2",b[1]);}
}catch(e){}})();`;
