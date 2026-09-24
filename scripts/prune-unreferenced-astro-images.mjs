// Removes built images in dist/_astro that no page, stylesheet, script, or feed references.
// Astro emits an imported photo's original when its module loads, even when every page uses
// resized copies (withastro/astro#15505), so each deployment carried full-size files nobody
// could reach. Only generated files in the build output are removed; source photos in src/ are
// never touched. Pass --dry-run to list without removing, or --root=<dir> for another output.
import { lstat, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find((arg) => arg.startsWith('--root='));
const outDir = path.resolve(rootArg ? rootArg.slice('--root='.length) : 'dist');
const assetsDir = path.join(outDir, '_astro');
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.tif', '.tiff', '.webp']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt', '.webmanifest', '.xml']);

async function walk(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const resolved = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(resolved)));
		else if (entry.isFile()) files.push(resolved);
	}
	return files;
}

const referenced = new Set();
function recordReferences(text) {
	for (const match of text.matchAll(/\/_astro\/([^\s"'`()?#<>,]+)/g)) referenced.add(path.basename(match[1]));
	for (const match of text.matchAll(/%2F_astro%2F([^&"'<>\s]+)/gi)) {
		referenced.add(path.basename(decodeURIComponent(match[1])));
	}
}

let pages = 0;
for (const file of await walk(outDir)) {
	const extension = path.extname(file).toLowerCase();
	if (!textExtensions.has(extension)) continue;
	if (extension === '.html') pages += 1;
	recordReferences(await readFile(file, 'utf8'));
}
// A scan that found no pages or no references means something else went wrong; remove nothing.
if (pages === 0 || referenced.size === 0) {
	throw new Error(`Refusing to prune ${assetsDir}: found ${pages} pages and ${referenced.size} references.`);
}

let removedFiles = 0;
let removedBytes = 0;
for (const file of await walk(assetsDir)) {
	const name = path.basename(file);
	if (!imageExtensions.has(path.extname(name).toLowerCase()) || referenced.has(name)) continue;
	const stats = await lstat(file);
	if (!stats.isFile()) throw new Error(`Refusing to remove non-file output: ${file}`);
	removedFiles += 1;
	removedBytes += stats.size;
	if (dryRun) console.log(`would remove ${name} (${(stats.size / 1048576).toFixed(1)} MB)`);
	else await unlink(file);
}

console.log(
	`${dryRun ? 'Would remove' : 'Removed'} ${removedFiles} unreferenced images ` +
		`(${(removedBytes / 1048576).toFixed(1)} MB) from ${path.relative(process.cwd(), assetsDir) || assetsDir}; ` +
		`${pages} pages scanned, ${referenced.size} referenced files kept.`,
);
