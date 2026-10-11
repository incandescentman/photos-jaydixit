import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import publications from '../data/photo-publications.json';

export type PhotoPublication = (typeof publications)[keyof typeof publications];
const byHash: Record<string, PhotoPublication> = publications;
const cached = new Map<string, Promise<PhotoPublication | undefined>>();

/** Only the exact reviewed local source bytes inherit a verified publication record. */
export function photoPublication(moduleKey: string, pageFile: string) {
	const source = resolve(dirname(pageFile), moduleKey);
	let result = cached.get(source);
	if (!result) {
		result = readFile(source).then(
			(bytes) => byHash[createHash('sha256').update(bytes).digest('hex')],
		);
		cached.set(source, result);
	}
	return result;
}
