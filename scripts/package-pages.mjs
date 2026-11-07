import {cp, mkdir, rm, writeFile} from "node:fs/promises";
// GitHub Pages serves this prebuilt folder without a build service or database.
await rm(new URL("../docs", import.meta.url), {recursive: true, force: true});
await mkdir(new URL("../docs", import.meta.url), {recursive: true});
await cp(new URL("../dist", import.meta.url), new URL("../docs", import.meta.url), {recursive: true});
await writeFile(new URL("../docs/.nojekyll", import.meta.url), "");
