type AnalyticsWindow = Window & {
	gtag?: (command: 'event', name: string, parameters: Record<string, string>) => void;
};

const destinations: Record<string, string> = {
	'jaydixit.com': 'jay_dixit',
	'socraticai.co': 'socratic_ai',
	'storytelling.nyc': 'storytelling_nyc',
};

function trackSiteClick(event: MouseEvent) {
	if (event.type === 'auxclick' && event.button !== 1) return;
	if (!(event.target instanceof Element)) return;
	const anchor = event.target.closest('a[href]');
	if (!(anchor instanceof HTMLAnchorElement)) return;
	const destination = new URL(anchor.href);
	if (!['http:', 'https:'].includes(destination.protocol)) return;

	// Match these destinations exactly: the portfolio subdomain is an internal link.
	const ctaName = destinations[destination.hostname.replace(/^www\./, '')];
	if (!ctaName) return;

	(window as AnalyticsWindow).gtag?.('event', 'outbound_cta_click', {
		cta_name: ctaName,
		site_section: 'photography',
		source_path: window.location.pathname,
		link_domain: destination.hostname,
		link_url: `${destination.origin}${destination.pathname}`,
		link_text: (anchor.textContent || anchor.getAttribute('aria-label') || '')
			.trim()
			.replace(/\s+/g, ' ')
			.slice(0, 100),
	});
}

document.addEventListener('click', trackSiteClick);
document.addEventListener('auxclick', trackSiteClick);
