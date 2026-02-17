import type { AstroInstance } from 'astro';
import { Github, Instagram } from 'lucide-astro';

export interface SocialLink {
	name: string;
	url: string;
	icon: AstroInstance;
}

export default {
	title: 'Jay Dixit Photos',
	siteUrl: 'https://photos.jaydixit.com',
	favicon: 'favicon.ico',
	owner: 'Jay Dixit',
	twitterHandle: '@jaydixit',
	profileImage: 'profile.webp',
	socialLinks: [
		{
			name: 'GitHub',
			url: 'https://github.com/incandescentman/jaydixit-photos',
			icon: Github,
		} as SocialLink,
		{
			name: 'Instagram',
			url: 'https://www.instagram.com/jaydixit',
			icon: Instagram,
		} as SocialLink,
	],
};
