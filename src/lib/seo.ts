type JsonLdRecord = Record<string, unknown>;
type JsonLd = JsonLdRecord | JsonLdRecord[];

export function resolveCanonicalUrl(
	source: string | undefined,
	siteUrl: string,
	pathname: string,
) {
	return source ? new URL(source, siteUrl).toString() : new URL(pathname, siteUrl).toString();
}

export function resolveOgImage(rawImage: string | undefined, siteUrl: string, fallbackPath: string) {
	return rawImage ? new URL(rawImage, siteUrl).toString() : new URL(fallbackPath, siteUrl).toString();
}

export function serializeJsonLd(data: JsonLd | undefined | null) {
	if (!data) return null;
	return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function normalizeDateValue(value: string | Date | undefined) {
	if (!value) return undefined;
	if (value instanceof Date) return value.toISOString();
	const date = new Date(value);
	return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function normalizeKeywords(value: string[] | string | undefined) {
	if (!value) return undefined;
	if (Array.isArray(value)) {
		return value.filter(Boolean).join(', ');
	}
	return value;
}
