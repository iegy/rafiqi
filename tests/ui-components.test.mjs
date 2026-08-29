import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

test("ships the complete Quran for offline reading", async () => {
  const payload = JSON.parse(await read("public/data/quran.json"));
  const surahs = payload.data?.surahs ?? [];
  const ayahs = surahs.reduce((total, surah) => total + surah.ayahs.length, 0);
  assert.equal(surahs.length, 114);
  assert.equal(ayahs, 6236);
});

test("offers multiple reciters and tafsir editions", async () => {
  const source = await read("components/rafiqi-app.tsx");
  assert.match(source, /ar\.alafasy/);
  assert.match(source, /ar\.abdulbasitmurattal/);
  assert.match(source, /ar\.husary/);
  assert.match(source, /ar\.minshawi/);
  assert.match(source, /ar\.minshawimujawwad/);
  assert.match(source, /mergeEditions\(fallbackReciters/);
  assert.match(source, /format=audio&language=ar&type=versebyverse/);
  assert.match(source, /format=text&language=ar&type=tafsir/);
  assert.match(source, /selectedReciter/);
  assert.match(source, /selectedTafsir/);
});

test("supports persistent custom tasbih phrases", async () => {
  const source = await read("components/rafiqi-app.tsx");
  assert.match(source, /custom-tasbih-phrases/);
  assert.match(source, /saveCustomDhikr/);
  assert.match(source, /إضافة ذكر مخصص/);
  assert.match(source, /removeSelectedCustomDhikr/);
});

test("ships an installable PWA manifest and offline worker", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  const worker = await read("public/sw.js");
  assert.equal(manifest.lang, "ar");
  assert.equal(manifest.dir, "rtl");
  assert.equal(manifest.display, "standalone");
  assert.match(worker, /data\/quran\.json/);
  assert.match(worker, /caches\.open/);
});

test("includes a real downloadable Android APK", async () => {
  const apk = await stat(`${root}/public/download/Rafiqi.apk`);
  assert.ok(apk.size > 1_000_000);
  const source = await read("components/rafiqi-app.tsx");
  assert.match(source, /\/download\/Rafiqi\.apk/);
});

test("audio player can be closed without covering the application", async () => {
  const source = await read("components/rafiqi-app.tsx");
  const css = await read("app/globals.css");
  assert.match(source, /const closeAudio/);
  assert.match(source, /aria-label="إغلاق مشغل التلاوة"/);
  assert.match(css, /\.app-content\.with-player/);
  assert.match(css, /\.mini-player/);
});

test("can continue recitation across ayahs and surahs", async () => {
  const source = await read("components/rafiqi-app.tsx");
  assert.match(source, /continue-recitation/);
  assert.match(source, /rafiqi:continue-recitation/);
  assert.match(source, /surah\.ayahs\[currentIndex \+ 1\]/);
  assert.match(source, /surah\.number \+ 1/);
  assert.match(source, /متابعة التلاوة تلقائيًا/);
});

test("declares the official domain and Islamic lattice background", async () => {
  const layout = await read("app/layout.tsx");
  const source = await read("components/rafiqi-app.tsx");
  const css = await read("app/globals.css");
  assert.match(layout, /https:\/\/rafiqi\.iegy\.net/);
  assert.match(source, /الموقع الرسمي/);
  assert.match(css, /body::before/);
  assert.match(css, /background-size:48px 48px/);
});
