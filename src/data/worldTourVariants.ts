import { torontoPortraits, worldTourDestinations, type WorldTourPortrait } from './worldTour';

export type RouteStop = {
	id: string;
	number: string;
	city: string;
	country: string;
	flag: string;
	event: string;
	years: string;
	miles: number;
	coordinates: string;
	subject: string;
	portrait?: WorldTourPortrait;
	isPlaceholder: boolean;
};

const metadata: Record<string, Pick<RouteStop, 'flag' | 'years' | 'miles'>> = {
	busan: { flag: '🇰🇷', years: '2025', miles: 6995 },
	locarno: { flag: '🇨🇭', years: '2024', miles: 3976 },
	stockholm: { flag: '🇸🇪', years: '2024', miles: 3927 },
	'park-city': { flag: '🇺🇸', years: '2024–2025', miles: 1953 },
	austin: { flag: '🇺🇸', years: '2024–2025', miles: 1513 },
};

const byId = new Map(worldTourDestinations.map((destination) => [destination.id, destination]));
const placeholderPortraits: Record<string, WorldTourPortrait> = {
	busan: torontoPortraits[1],
	locarno: torontoPortraits[3],
};

export const routeStops: RouteStop[] = ['busan', 'locarno', 'stockholm', 'park-city', 'austin'].map(
	(id, index) => {
		const destination = byId.get(id);
		if (!destination) throw new Error(`Missing world-tour destination: ${id}`);
		return {
			id,
			number: String(index + 1).padStart(2, '0'),
			city: destination.city,
			country: destination.country,
			flag: metadata[id].flag,
			event: destination.event,
			years: metadata[id].years,
			miles: metadata[id].miles,
			coordinates: destination.coordinates,
			subject: destination.portrait?.subject ?? '',
			portrait: destination.portrait ?? placeholderPortraits[id],
			isPlaceholder: !destination.portrait,
		};
	},
);

routeStops.push({
	id: 'toronto',
	number: '06',
	city: 'Toronto',
	country: 'Canada',
	flag: '🇨🇦',
	event: 'Toronto International Film Festival',
	years: '2024–2025',
	miles: 346,
	coordinates: '43.6532° N · 79.3832° W',
	subject: torontoPortraits[0].subject,
	portrait: torontoPortraits[0],
	isPlaceholder: false,
});

export const routeVariants = [
	{
		id: 'full-bleed',
		number: '01',
		name: 'Full Bleed',
		shortName: 'Bleed',
		line: 'Six cinematic scroll chapters with a persistent route spine and a Toronto finale.',
		path: '/around-the-world/full-bleed',
		tone: 'Cinematic',
	},
	{
		id: 'passport',
		number: '02',
		name: 'Passport',
		shortName: 'Passport',
		line: 'Warm paper, imperfect entry stamps, and one carefully placed print per city.',
		path: '/around-the-world/passport',
		tone: 'Handmade',
	},
	{
		id: 'departures',
		number: '03',
		name: 'Departures',
		shortName: 'Board',
		line: 'A split-flap arrivals board that opens each destination into a portrait gate.',
		path: '/around-the-world/departures',
		tone: 'Interactive',
	},
	{
		id: 'contact-sheet',
		number: '04',
		name: 'Contact Sheet',
		shortName: 'Filmstrip',
		line: 'A continuous editorial film strip that travels horizontally on desktop and stacks on mobile.',
		path: '/around-the-world/contact-sheet',
		tone: 'Photographic',
	},
	{
		id: 'the-route',
		number: '05',
		name: 'The Route',
		shortName: 'Route',
		line: 'A typographic journey home with uncropped portraits, a credential rail, Toronto assembly, and a mapped route back to Brooklyn.',
		path: '/around-the-world/the-route',
		tone: 'Typographic',
	},
] as const;

export { torontoPortraits };
