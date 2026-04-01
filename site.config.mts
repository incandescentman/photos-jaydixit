import type { AstroInstance } from 'astro';
import { Camera, PawPrint } from '@lucide/astro';

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
				name: 'Website',
				url: 'https://jaydixit.com',
				icon: PawPrint,
			} as SocialLink,
			{
				name: 'Instagram',
				url: 'https://www.instagram.com/jaydixit',
				icon: Camera,
			} as SocialLink,
		],
};
