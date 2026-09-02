#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildLocalPortfolioInventory } from './lib/portfolio-inventory.js';

const API_URL = 'https://commons.wikimedia.org/w/api.php';
const COMMONS_USER = 'Jaydixit';
const DEFAULT_INVENTORY =
	'/Users/jay/Dropbox/roam/photography/20260902015339-photo_publication_inventory.org';
const COMMONS_START_MARKER = '# BEGIN GENERATED COMMONS INVENTORY';
const COMMONS_END_MARKER = '# END GENERATED COMMONS INVENTORY';
const SITE_START_MARKER = '# BEGIN GENERATED PORTFOLIO SITE INVENTORY';
const SITE_END_MARKER = '# END GENERATED PORTFOLIO SITE INVENTORY';
const USER_AGENT = 'photo-publication-inventory/1.0 (Jay Dixit)';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const PRODUCTION_ORIGIN = 'https://photos.jaydixit.com';

function sleep(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function apiRequest(parameters, attempt = 1) {
	const url = new URL(API_URL);
	url.search = new URLSearchParams({
		action: 'query',
		format: 'json',
		formatversion: '2',
		maxlag: '5',
		...parameters,
	}).toString();
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if ((response.status === 429 || response.status === 503) && attempt <= 6) {
		const retryAfter = Number(response.headers.get('retry-after')) || attempt * 2;
		await sleep(retryAfter * 1000);
		return apiRequest(parameters, attempt + 1);
	}
	if (!response.ok) throw new Error(`Commons API returned HTTP ${response.status}`);
	const payload = await response.json();
	if (payload.error?.code === 'maxlag' && attempt <= 6) {
		await sleep(attempt * 2000);
		return apiRequest(parameters, attempt + 1);
	}
	if (payload.error)
		throw new Error(`Commons API error: ${payload.error.info || payload.error.code}`);
	return payload;
}

async function fetchUploadLog(limit = 'max') {
	const events = [];
	let continuation = {};
	do {
		const payload = await apiRequest({
			list: 'logevents',
			letype: 'upload',
			leuser: COMMONS_USER,
			lelimit: limit,
			leprop: 'ids|title|timestamp|comment|details',
			...continuation,
		});
		events.push(...(payload.query?.logevents || []));
		continuation = payload.continue || null;
	} while (continuation && limit === 'max');
	return events;
}

function chunk(values, size) {
	const groups = [];
	for (let index = 0; index < values.length; index += size)
		groups.push(values.slice(index, index + size));
	return groups;
}

async function fetchCurrentFiles(pageIds) {
	const pages = new Map();
	for (const ids of chunk(pageIds, 25)) {
		let continuation = {};
		do {
			const payload = await apiRequest({
				pageids: ids.join('|'),
				prop: 'imageinfo|categories',
				iiprop: 'url|timestamp|user|sha1|size|extmetadata',
				cllimit: 'max',
				clshow: '!hidden',
				...continuation,
			});
			for (const page of payload.query?.pages || []) {
				const key = String(page.pageid);
				const existing = pages.get(key);
				pages.set(key, {
					...existing,
					...page,
					categories: [...(existing?.categories || []), ...(page.categories || [])],
				});
			}
			continuation = payload.continue || null;
		} while (continuation);
		await sleep(250);
	}
	return pages;
}

function decodeHtml(value) {
	return String(value || '')
		.replace(/<br\s*\/?\s*>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function orgSafe(value) {
	return String(value ?? '')
		.replace(/[\r\n]+/g, ' ')
		.replaceAll(']]', '] ]')
		.trim();
}

function commonsUrl(title) {
	return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replace('%3A', ':').replaceAll('%20', '_')}`;
}

function groupEvents(events) {
	const groups = new Map();
	for (const event of events) {
		const key = event.pageid ? `page:${event.pageid}` : `title:${event.title}`;
		const existing = groups.get(key) || { key, pageid: event.pageid || null, events: [] };
		existing.events.push(event);
		groups.set(key, existing);
	}
	return [...groups.values()];
}

function renderEntry(group, currentPage, refreshedAt) {
	const events = [...group.events].sort((left, right) =>
		left.timestamp.localeCompare(right.timestamp),
	);
	const first = events[0];
	const latest = events.at(-1);
	const imageInfo = currentPage?.imageinfo?.[0] || {};
	const ext = imageInfo.extmetadata || {};
	const title = currentPage?.title || latest.title;
	const status =
		currentPage && !currentPage.missing && imageInfo.url ? 'current' : 'missing-or-deleted';
	const description = decodeHtml(ext.ImageDescription?.value || ext.ObjectName?.value);
	const categories = (currentPage?.categories || [])
		.map((category) => category.title.replace(/^Category:/, ''))
		.join('|');
	const dimensions =
		imageInfo.width && imageInfo.height ? `${imageInfo.width}x${imageInfo.height}` : '';
	return `** ${orgSafe(title)}
:PROPERTIES:
:COMMONS_PAGE_ID: ${group.pageid || ''}
:STATUS: ${status}
:FIRST_UPLOAD_BY_JAY: ${first.timestamp}
:LATEST_UPLOAD_BY_JAY: ${latest.timestamp}
:UPLOAD_EVENT_COUNT: ${events.length}
:SHA1: ${imageInfo.sha1 || latest.params?.img_sha1 || ''}
:DIMENSIONS: ${dimensions}
:LAST_REFRESHED: ${refreshedAt}
:END:
- Commons :: [[${commonsUrl(title)}][${orgSafe(title)}]]
- Description :: ${orgSafe(description) || 'Not available'}
- Categories :: ${orgSafe(categories) || 'Not available'}
- Latest upload comment :: ${orgSafe(latest.comment) || 'None'}
`;
}

function replaceGeneratedSection(content, startMarker, endMarker, generated) {
	const start = content.indexOf(startMarker);
	const end = content.indexOf(endMarker);
	if (start < 0 || end < start)
		throw new Error(`Inventory is missing its generated-section markers: ${startMarker}`);
	return `${content.slice(0, start)}${startMarker}\n${generated.trim()}\n${endMarker}${content.slice(end + endMarker.length)}`;
}

async function syncCommonsInventory(content, dryRun) {
	const events = await fetchUploadLog();
	const groups = groupEvents(events);
	const pageIds = groups.filter((group) => group.pageid).map((group) => String(group.pageid));
	const currentPages = await fetchCurrentFiles(pageIds);
	const refreshedAt = new Date().toISOString();
	const latest = [...events].sort((left, right) =>
		right.timestamp.localeCompare(left.timestamp),
	)[0];
	const entries = groups
		.map((group) => renderEntry(group, currentPages.get(String(group.pageid)), refreshedAt))
		.sort((left, right) => left.localeCompare(right));
	if (entries.length !== groups.length)
		throw new Error(
			`Source-contract failure: ${groups.length} distinct Commons files produced ${entries.length} entries`,
		);
	const generated = `* Wikimedia Commons snapshot
:PROPERTIES:
:COMMONS_USER: ${COMMONS_USER}
:LAST_REFRESHED: ${refreshedAt}
:LATEST_UPLOAD_LOG_ID: ${latest?.logid || ''}
:LATEST_UPLOAD_AT: ${latest?.timestamp || ''}
:UPLOAD_EVENT_COUNT: ${events.length}
:DISTINCT_FILE_COUNT: ${groups.length}
:END:

The generated registry contains ${groups.length} distinct Commons file records derived from ${events.length} upload-log events for ~${COMMONS_USER}~. Files remain listed when the current page is missing or deleted.

* Wikimedia Commons files

${entries.join('\n')}`;
	return {
		content: dryRun
			? content
			: replaceGeneratedSection(content, COMMONS_START_MARKER, COMMONS_END_MARKER, generated),
		summary: {
			commons_user: COMMONS_USER,
			upload_events: events.length,
			distinct_files: groups.length,
			latest_upload_log_id: latest?.logid || null,
			latest_upload_at: latest?.timestamp || null,
		},
	};
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

async function fetchPage(url) {
	try {
		const response = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT },
			signal: AbortSignal.timeout(20_000),
		});
		return { ok: response.ok, status: response.status, text: await response.text() };
	} catch (error) {
		return { ok: false, status: 0, text: '', error: error.message };
	}
}

async function mapWithConcurrency(values, concurrency, callback) {
	const results = new Array(values.length);
	let nextIndex = 0;
	async function worker() {
		while (nextIndex < values.length) {
			const index = nextIndex++;
			results[index] = await callback(values[index], index);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
	return results;
}

async function fetchProductionInventory() {
	const response = await fetchPage(`${PRODUCTION_ORIGIN}/photo-inventory.json`);
	if (response.status === 404) return null;
	if (!response.ok)
		throw new Error(
			`Production photo inventory returned HTTP ${response.status || 'network-error'}`,
		);
	const inventory = JSON.parse(response.text);
	if (inventory.manifest_version !== 1 || inventory.record_count !== inventory.records?.length) {
		throw new Error('Production photo inventory failed its source-contract gate');
	}
	return inventory;
}

function recordNeedles(record, surface) {
	return [
		...(surface.kind === 'homepage' && record.cloudinary_public_id
			? [record.cloudinary_public_id]
			: []),
		...(record.filenames || [record.filename]).map((filename) => filename.replace(/\.[^/.]+$/, '')),
	];
}

async function verifyProductionWithoutManifest(records) {
	const urls = [
		...new Set(
			records.flatMap((record) =>
				record.surfaces
					.filter((surface) => surface.kind !== 'gallery')
					.map((surface) => surface.url),
			),
		),
	];
	const responses = await mapWithConcurrency(urls, 6, fetchPage);
	const pages = new Map(urls.map((url, index) => [url, responses[index]]));
	return records.map((record) => {
		const verified = [];
		for (const surface of record.surfaces) {
			if (surface.kind === 'gallery') continue;
			const page = pages.get(surface.url);
			if (!page?.ok) continue;
			if (surface.kind === 'photo-detail') {
				verified.push(surface);
				continue;
			}
			const found = recordNeedles(record, surface).some(
				(needle) => page.text.includes(needle) || page.text.includes(encodeURIComponent(needle)),
			);
			if (found) {
				verified.push(surface);
			}
		}
		if (verified.some((surface) => surface.kind === 'photo-detail')) {
			const gallery = record.surfaces.find((surface) => surface.kind === 'gallery');
			if (gallery) verified.unshift(gallery);
		}
		return {
			asset_key: record.asset_key,
			status: verified.length ? 'live-verified' : 'not-found',
			live_surfaces: verified,
		};
	});
}

function renderSiteEntry(record, production, refreshedAt) {
	const absoluteSources = (
		record.source_paths || (record.source_path ? [record.source_path] : [])
	).map((source) => path.join(REPO_ROOT, source));
	const configured = record.surfaces
		.map((surface) => `[[${surface.url}][${surface.kind}]]`)
		.join('; ');
	const verified = (production.live_surfaces || [])
		.map((surface) => `[[${surface.url}][${surface.kind}]]`)
		.join('; ');
	return `** ${orgSafe(record.caption || record.filename)}
:PROPERTIES:
:ASSET_KEY: ${orgSafe(record.asset_key)}
:SOURCE_KIND: ${record.source_kind}
:LOCAL_STATUS: ${absoluteSources.length ? 'present' : 'cloudinary-only'}
:PRODUCTION_STATUS: ${production.status}
:SOURCE_SHA256: ${record.source_sha256 || ''}
:LAST_REFRESHED: ${refreshedAt}
:END:
- Filenames :: ${(record.filenames || [record.filename]).map(orgSafe).join(', ')}
- People :: ${record.people.map(orgSafe).join(', ') || 'Not recorded'}
- Local sources :: ${absoluteSources.length ? absoluteSources.map((source) => `[[file+emacs:${source}][📷 ${orgSafe(path.basename(source))}]]`).join('; ') : 'No local source file'}
- Configured site surfaces :: ${configured || 'None'}
- Verified live surfaces :: ${verified || 'None'}
- Cloudinary public ID :: ${orgSafe(record.cloudinary_public_id) || 'None'}
- Tags :: ${record.tags.map(orgSafe).join(', ') || 'None'}
`;
}

async function syncSiteInventory(content, dryRun) {
	const local = await buildLocalPortfolioInventory(REPO_ROOT);
	if (local.record_count !== local.records.length)
		throw new Error('Local portfolio inventory failed its source-contract gate');
	const deployed = await fetchProductionInventory();
	let productionRecords;
	let productionSource;
	let productionFingerprint;
	let productionRecordCount;
	if (deployed) {
		const deployedByKey = new Map(deployed.records.map((record) => [record.asset_key, record]));
		productionRecords = local.records.map((record) => {
			const remote = deployedByKey.get(record.asset_key);
			if (!remote) return { asset_key: record.asset_key, status: 'not-live', live_surfaces: [] };
			const sameSource = !record.source_sha256 || record.source_sha256 === remote.source_sha256;
			return {
				asset_key: record.asset_key,
				status: sameSource ? 'live-current' : 'live-different-version',
				live_surfaces: remote.surfaces,
			};
		});
		productionSource = 'deployed-manifest';
		productionFingerprint = deployed.fingerprint;
		productionRecordCount = deployed.record_count;
	} else {
		productionRecords = await verifyProductionWithoutManifest(local.records);
		productionSource = 'one-time-live-route-verification';
		productionFingerprint = sha256(JSON.stringify(productionRecords));
		productionRecordCount = productionRecords.filter(
			(record) => record.live_surfaces.length,
		).length;
	}
	const productionByKey = new Map(productionRecords.map((record) => [record.asset_key, record]));
	const refreshedAt = new Date().toISOString();
	const entries = local.records.map((record) =>
		renderSiteEntry(record, productionByKey.get(record.asset_key), refreshedAt),
	);
	if (entries.length !== local.record_count)
		throw new Error(
			`Source-contract failure: ${local.record_count} local portfolio records produced ${entries.length} Org entries`,
		);
	const verifiedLiveCount = productionRecords.filter(
		(record) => record.live_surfaces.length,
	).length;
	const generated = `* Portfolio site snapshot
:PROPERTIES:
:LAST_REFRESHED: ${refreshedAt}
:LOCAL_FINGERPRINT: ${local.fingerprint}
:LOCAL_RECORD_COUNT: ${local.record_count}
:PRODUCTION_SOURCE: ${productionSource}
:PRODUCTION_FINGERPRINT: ${productionFingerprint}
:PRODUCTION_RECORD_COUNT: ${productionRecordCount}
:VERIFIED_LIVE_RECORD_COUNT: ${verifiedLiveCount}
:END:

The local side records every canonical gallery source, highlight source, and configured Cloudinary-only homepage photograph. The production side is derived from the deployed JSON manifest when available; until that endpoint is deployed, it uses a one-time verification of the existing live routes.

* Portfolio site photographs

${entries.join('\n')}`;
	return {
		content: dryRun
			? content
			: replaceGeneratedSection(content, SITE_START_MARKER, SITE_END_MARKER, generated),
		summary: {
			local_records: local.record_count,
			local_fingerprint: local.fingerprint,
			production_source: productionSource,
			production_records: productionRecordCount,
			verified_live_records: verifiedLiveCount,
			production_fingerprint: productionFingerprint,
		},
	};
}

async function syncInventory(inventoryPath, dryRun, scope = 'all') {
	let content = await fs.readFile(inventoryPath, 'utf8');
	const summary = { inventory: inventoryPath, dry_run: dryRun };
	if (scope === 'all' || scope === 'commons') {
		const commons = await syncCommonsInventory(content, dryRun);
		content = commons.content;
		summary.commons = commons.summary;
	}
	if (scope === 'all' || scope === 'site') {
		const site = await syncSiteInventory(content, dryRun);
		content = site.content;
		summary.site = site.summary;
	}
	if (!dryRun) {
		const temporary = `${inventoryPath}.tmp-${process.pid}`;
		await fs.writeFile(temporary, content, 'utf8');
		await fs.rename(temporary, inventoryPath);
	}
	console.log(JSON.stringify(summary, null, 2));
}

async function freshness(inventoryPath) {
	const content = await fs.readFile(inventoryPath, 'utf8');
	const recordedCommons = content.match(/^:LATEST_UPLOAD_LOG_ID:\s*(\d+)$/m)?.[1] || null;
	const recordedLocal = content.match(/^:LOCAL_FINGERPRINT:\s*([a-f0-9]+)$/m)?.[1] || null;
	const recordedProduction =
		content.match(/^:PRODUCTION_FINGERPRINT:\s*([a-f0-9]+)$/m)?.[1] || null;
	const latest = (await fetchUploadLog('1'))[0] || null;
	const local = await buildLocalPortfolioInventory(REPO_ROOT);
	const deployed = await fetchProductionInventory();
	const commonsCurrent = recordedCommons && latest && recordedCommons === String(latest.logid);
	const localCurrent = recordedLocal === local.fingerprint;
	const productionCurrent = deployed ? recordedProduction === deployed.fingerprint : true;
	const current = commonsCurrent && localCurrent && productionCurrent;
	console.log(
		JSON.stringify(
			{
				inventory: inventoryPath,
				status: current ? 'current' : 'stale',
				commons_status: commonsCurrent ? 'current' : 'stale',
				site_source_status: localCurrent ? 'current' : 'stale',
				production_status: deployed
					? productionCurrent
						? 'current'
						: 'stale'
					: 'snapshot-awaiting-manifest-deploy',
				recorded_latest_upload_log_id: recordedCommons,
				live_latest_upload_log_id: latest?.logid || null,
				live_latest_upload_at: latest?.timestamp || null,
				recorded_local_fingerprint: recordedLocal,
				current_local_fingerprint: local.fingerprint,
				recorded_production_fingerprint: recordedProduction,
				deployed_production_fingerprint: deployed?.fingerprint || null,
			},
			null,
			2,
		),
	);
	if (!current) process.exitCode = 2;
}

async function searchInventory(inventoryPath, query) {
	const content = await fs.readFile(inventoryPath, 'utf8');
	const sections = content.split(/(?=^\*\* )/m).slice(1);
	const normalized = query.toLowerCase();
	const matches = sections.filter((section) => section.toLowerCase().includes(normalized));
	if (matches.length > 0) console.log(matches.join('\n').trim());
	else console.log(`No photo publication inventory entries match: ${query}`);
	if (matches.length === 0) process.exitCode = 1;
}

const [command = 'sync', ...rest] = process.argv.slice(2);
const inventoryArgument = rest.find((value) => value.startsWith('--inventory='));
const inventoryPath = path.resolve(
	inventoryArgument?.slice('--inventory='.length) || DEFAULT_INVENTORY,
);

if (command === 'sync') await syncInventory(inventoryPath, rest.includes('--dry-run'));
else if (command === 'sync-commons')
	await syncInventory(inventoryPath, rest.includes('--dry-run'), 'commons');
else if (command === 'sync-site')
	await syncInventory(inventoryPath, rest.includes('--dry-run'), 'site');
else if (command === 'freshness') await freshness(inventoryPath);
else if (command === 'search') {
	const query = rest
		.filter((value) => !value.startsWith('--inventory='))
		.join(' ')
		.trim();
	if (!query) throw new Error('search requires a name or phrase');
	await searchInventory(inventoryPath, query);
} else throw new Error(`Unknown command: ${command}`);
