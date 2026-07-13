import type { ImageMetadata } from 'astro:assets';

import conanBeforeImg from '../assets/images/wikiportraits/conan-obrien-before.jpg';
import conanAfterImg from '../assets/images/wikiportraits/conan-obrien_sundance_2024.jpg';
import jasonBeforeImg from '../assets/images/wikiportraits/jason-bateman-before.jpg';
import jasonAfterImg from '../gallery/photos/red-carpet/tiff/jason-bateman_tiff_2025.jpg';
import jeremyBeforeImg from '../assets/images/wikiportraits/jeremy-strong-before.jpg';
import jeremyAfterImg from '../assets/images/wikiportraits/jeremy-strong_the-apprentice-premiere_2024.jpg';
import johnBeforeImg from '../assets/images/wikiportraits/john-hopfield-before-2016.jpg';
import johnAfterImg from '../assets/images/wikiportraits/john-hopfield_nobel-physics_2024.jpg';
import sydneyBeforeImg from '../assets/images/wikiportraits/sydney-sweeney-before-2019.jpg';
import sydneyAfterImg from '../assets/images/wikiportraits/sydney-sweeney_tiff_2024.jpg';
import vanessaBeforeImg from '../assets/images/wikiportraits/vanessa-kirby-before-2018.jpg';
import vanessaAfterImg from '../assets/images/wikiportraits/vanessa-kirby_tiff_2024.jpg';

export interface BeforeAfterComparison {
	name: string;
	beforeImage: ImageMetadata;
	afterImage: ImageMetadata;
	article: string;
	event: string;
	beforeSource: string;
	afterSource: string;
	beforePos: string;
	afterPos: string;
	commonsUrl?: string;
	uploadStatus?: string;
	articleUsageStatus?: 'lead' | 'formerly-lead' | 'unknown';
	sourceCredit?: string;
	license?: string;
	licenseUrl?: string;
}

// Before/after pairs - Wikipedia portrait upgrades.
// beforePos / afterPos hand-tune each cover-crop so faces stay in frame.
export const comparisons: BeforeAfterComparison[] = [
	{
		name: 'Jeremy Strong',
		beforeImage: jeremyBeforeImg,
		afterImage: jeremyAfterImg,
		article: 'https://en.wikipedia.org/wiki/Jeremy_Strong',
		event: 'BFI London Film Festival 2025',
		beforeSource: 'Previous Wikipedia portrait',
		afterSource: 'Jay Dixit, BFI London 2025',
		beforePos: 'center 18%',
		afterPos: 'center 8%',
		commonsUrl:
			'https://commons.wikimedia.org/wiki/File:Jeremy_Strong_at_%22The_Apprentice%22_in_NYC_01.jpg',
		uploadStatus: 'uploaded',
		articleUsageStatus: 'formerly-lead',
		sourceCredit: 'Jay Dixit',
		license: 'CC BY-SA 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
	},
	{
		name: 'Jason Bateman',
		beforeImage: jasonBeforeImg,
		afterImage: jasonAfterImg,
		article: 'https://en.wikipedia.org/wiki/Jason_Bateman',
		event: 'Toronto International Film Festival 2025',
		beforeSource: 'Previous Wikipedia portrait',
		afterSource: 'Jay Dixit, TIFF 2025',
		beforePos: 'center 18%',
		afterPos: 'center 10%',
		sourceCredit: 'Jay Dixit',
	},
	{
		name: 'Vanessa Kirby',
		beforeImage: vanessaBeforeImg,
		afterImage: vanessaAfterImg,
		article: 'https://en.wikipedia.org/wiki/Vanessa_Kirby',
		event: 'Toronto International Film Festival 2024',
		beforeSource: 'Wikipedia portrait, 2018',
		afterSource: 'Jay Dixit, TIFF 2024',
		beforePos: 'center 20%',
		afterPos: 'center top',
		commonsUrl:
			'https://commons.wikimedia.org/wiki/File:Vanessa_Kirby_at_the_2024_Toronto_International_Film_Festival_08_(Cropped).jpg',
		uploadStatus: 'uploaded',
		articleUsageStatus: 'lead',
		sourceCredit: 'Jay Dixit',
		license: 'CC BY-SA 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
	},
	{
		name: 'John Hopfield',
		beforeImage: johnBeforeImg,
		afterImage: johnAfterImg,
		article: 'https://en.wikipedia.org/wiki/John_Hopfield',
		event: 'Nobel Prize Lectures, Stockholm 2024',
		beforeSource: 'Wikipedia portrait, 2016',
		afterSource: 'Jay Dixit, Nobel Lectures 2024',
		beforePos: 'center 18%',
		afterPos: 'center 15%',
		commonsUrl:
			'https://commons.wikimedia.org/wiki/File:John_J._Hopfield_delivering_his_lecture_at_the_2024_Nobel_Prize_Lectures_in_Stockholm.jpg',
		uploadStatus: 'uploaded',
		articleUsageStatus: 'lead',
		sourceCredit: 'Jay Dixit',
		license: 'CC BY-SA 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
	},
	{
		name: "Conan O'Brien",
		beforeImage: conanBeforeImg,
		afterImage: conanAfterImg,
		article: 'https://en.wikipedia.org/wiki/Conan_O%27Brien',
		event: 'Sundance Film Festival 2025',
		beforeSource: 'Previous Wikipedia portrait',
		afterSource: 'Jay Dixit, Sundance 2025',
		beforePos: 'center 18%',
		afterPos: 'center 12%',
		uploadStatus: 'uploaded',
		articleUsageStatus: 'formerly-lead',
		sourceCredit: 'Jay Dixit',
		license: 'CC BY-SA 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
	},
	{
		name: 'Sydney Sweeney',
		beforeImage: sydneyBeforeImg,
		afterImage: sydneyAfterImg,
		article: 'https://en.wikipedia.org/wiki/Sydney_Sweeney',
		event: 'Toronto International Film Festival 2024',
		beforeSource: 'Glenn Francis, 2019',
		afterSource: 'Jay Dixit, TIFF 2024',
		beforePos: 'center 18%',
		afterPos: 'center top',
		commonsUrl:
			'https://commons.wikimedia.org/wiki/File:Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_01_(3x4_cropped_and_rotated).jpg',
		uploadStatus: 'uploaded',
		articleUsageStatus: 'lead',
		sourceCredit: 'Jay Dixit',
		license: 'CC BY-SA 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
	},
];
