import assert from "node:assert/strict";
import test from "node:test";
import {createServer} from "vite";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("server-renders the calculator and all six work-week choices", async () => {
  // Render the same React calculator used by the static browser entry.
  const vite=await createServer({configFile:false,appType:"custom",cacheDir:"node_modules/.vite-test-render",server:{middlewareMode:true}});
  try{
    const {default:Page}=await vite.ssrLoadModule("/app/page.tsx");
    const html=renderToStaticMarkup(React.createElement(Page));
    assert.match(html,/מחשבון עלות/);assert.match(html,/עלות מעסיק לשעת עבודה/);
    assert.match(html,/dir="rtl"/);assert.match(html,/פתיחה מהמחשב/);
    for(let day=1;day<=6;day++)assert.match(html,new RegExp(`option value="${day}"`));
  }finally{await vite.close();}
});
