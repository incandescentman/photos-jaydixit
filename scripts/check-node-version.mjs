import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import process from 'node:process';

const root = new URL('../', import.meta.url);
const { engines } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const expectedMajor = engines.node.match(/^(\d+)\.x$/)?.[1];
const localPin = readFileSync(new URL('.nvmrc', root), 'utf8').trim();

if (!expectedMajor || localPin !== expectedMajor) {
	console.error(
		'Photos Node configuration is inconsistent: package.json engines.node and .nvmrc must pin the same major version.',
	);
	process.exitCode = 1;
} else if (process.versions.node.split('.')[0] !== expectedMajor) {
	console.error(
		`Photos requires Node ${engines.node}; this command is running ${process.version}.`,
	);
	console.error(
		`Run "nvm use" in ${fileURLToPath(root)} and retry. If Node ${expectedMajor} is not installed, run "nvm install" first.`,
	);
	process.exitCode = 1;
}
