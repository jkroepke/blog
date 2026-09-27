import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();

const ownedDirectories = [
  "assets/lib/autocomplete",
  "assets/lib/clipboard",
  "assets/lib/cookieconsent",
  "assets/lib/lazysizes",
  "assets/lib/lightgallery",
  "assets/lib/lunr",
  "assets/lib/sharer",
];

const files = [
  ["node_modules/autocomplete.js/dist/autocomplete.min.js", "assets/lib/autocomplete/autocomplete.min.js"],
  ["node_modules/clipboard/dist/clipboard.min.js", "assets/lib/clipboard/clipboard.min.js"],
  ["node_modules/cookieconsent/build/cookieconsent.min.css", "assets/lib/cookieconsent/cookieconsent.min.css"],
  ["node_modules/cookieconsent/build/cookieconsent.min.js", "assets/lib/cookieconsent/cookieconsent.min.js"],
  ["node_modules/lazysizes/lazysizes.min.js", "assets/lib/lazysizes/lazysizes.min.js"],
  ["node_modules/lightgallery/css/lightgallery-bundle.min.css", "assets/lib/lightgallery/css/lightgallery-bundle.min.css"],
  ["node_modules/lightgallery/lightgallery.min.js", "assets/lib/lightgallery/lightgallery.min.js"],
  ["node_modules/lightgallery/plugins/thumbnail/lg-thumbnail.min.js", "assets/lib/lightgallery/plugins/thumbnail/lg-thumbnail.min.js"],
  ["node_modules/lightgallery/plugins/zoom/lg-zoom.min.js", "assets/lib/lightgallery/plugins/zoom/lg-zoom.min.js"],
  ["node_modules/lunr/lunr.min.js", "assets/lib/lunr/lunr.min.js"],
  ["node_modules/sharer.js/sharer.min.js", "assets/lib/sharer/sharer.min.js"],
];

const directories = [
  ["node_modules/lightgallery/fonts", "assets/lib/lightgallery/fonts"],
  ["node_modules/lightgallery/images", "assets/lib/lightgallery/images"],
];

for (const directory of ownedDirectories) {
  rmSync(resolve(root, directory), { recursive: true, force: true });
}

for (const [source, destination] of files) {
  const sourcePath = resolve(root, source);
  const destinationPath = resolve(root, destination);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing npm asset: ${source}`);
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
}

for (const [source, destination] of directories) {
  const sourcePath = resolve(root, source);
  const destinationPath = resolve(root, destination);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing npm asset directory: ${source}`);
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true });
}

console.log("Vendored LoveIt frontend assets from npm.");
