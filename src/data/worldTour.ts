export type WorldTourPortrait = {
	publicId: string;
	subject: string;
	alt: string;
	position?: string;
};

export type WorldTourDestination = {
	id: string;
	number: string;
	city: string;
	country: string;
	event: string;
	coordinates: string;
	line: string;
	accent: string;
	portrait?: WorldTourPortrait;
};

export const worldTourDestinations: WorldTourDestination[] = [
	{
		id: 'stockholm',
		number: '1',
		city: 'Stockholm',
		country: 'Sweden',
		event: 'Nobel Prize Ceremony',
		coordinates: '59.3293° N · 18.0686° E',
		line: 'A laureate, a borrowed moment, and a portrait made for the public record.',
		accent: '#d0ad64',
		portrait: {
			publicId: 'highlights/john-hopfield_nobel-physics_2024',
			subject: 'John Hopfield',
			alt: 'Nobel Prize-winning physicist John Hopfield photographed in Stockholm',
			position: '50% 28%',
		},
	},
	{
		id: 'busan',
		number: '2',
		city: 'Busan',
		country: 'South Korea',
		event: 'Busan International Film Festival',
		coordinates: '35.1796° N · 129.0756° E',
		line: 'Cinema at the edge of the sea, framed in the electric light of the festival.',
		accent: '#cf574d',
	},
	{
		id: 'locarno',
		number: '3',
		city: 'Locarno',
		country: 'Switzerland',
		event: 'Locarno Film Festival',
		coordinates: '46.1690° N · 8.7955° E',
		line: 'A historic piazza, a summer premiere, and the unmistakable leopard of Locarno.',
		accent: '#e0ba3e',
	},
	{
		id: 'park-city',
		number: '4',
		city: 'Park City',
		country: 'United States',
		event: 'Sundance Film Festival',
		coordinates: '40.6461° N · 111.4980° W',
		line: 'Independent cinema, mountain air, and a red carpet built in the snow.',
		accent: '#86abc5',
		portrait: {
			publicId: 'highlights/steven-yeun_sundance_2025',
			subject: 'Steven Yeun',
			alt: 'Steven Yeun photographed at the Sundance Film Festival in Park City',
			position: '50% 26%',
		},
	},
	{
		id: 'austin',
		number: '5',
		city: 'Austin',
		country: 'United States',
		event: 'SXSW',
		coordinates: '30.2672° N · 97.7431° W',
		line: 'The press line moves fast. The comedy moves faster. The portrait has one chance.',
		accent: '#d65a33',
		portrait: {
			publicId: 'highlights/lisa-gilroy_sxsw_2025',
			subject: 'Lisa Gilroy',
			alt: 'Lisa Gilroy photographed at SXSW in Austin',
			position: '50% 24%',
		},
	},
];

export const torontoPortraits: WorldTourPortrait[] = [
	{
		publicId: 'highlights/vanessa-kirby_tiff_2024',
		subject: 'Vanessa Kirby',
		alt: 'Vanessa Kirby at the Toronto International Film Festival',
		position: '50% 24%',
	},
	{
		publicId:
			'highlights/Ana_de_Armas_at_the_2024_Toronto_International_Film_Festival_02_(cropped2)',
		subject: 'Ana de Armas',
		alt: 'Ana de Armas at the Toronto International Film Festival',
		position: '50% 18%',
	},
	{
		publicId:
			'highlights/Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_(cropped_2)',
		subject: 'Sydney Sweeney',
		alt: 'Sydney Sweeney at the Toronto International Film Festival',
		position: '50% 20%',
	},
	{
		publicId: 'highlights/Willem_Dafoe_at_the_2024_Toronto_International_Film_Festival_02',
		subject: 'Willem Dafoe',
		alt: 'Willem Dafoe at the Toronto International Film Festival',
		position: '50% 20%',
	},
	{
		publicId: 'highlights/Kaia_Gerber_at_the_2024_Toronto_International_Film_Festival_03_(cropped)',
		subject: 'Kaia Gerber',
		alt: 'Kaia Gerber at the Toronto International Film Festival',
		position: '50% 18%',
	},
	{
		publicId:
			'highlights/Gabriel_LaBelle_at_the_2024_Toronto_International_Film_Festival_03_cropped',
		subject: 'Gabriel LaBelle',
		alt: 'Gabriel LaBelle at the Toronto International Film Festival',
		position: '50% 22%',
	},
	{
		publicId: 'highlights/ella-hunt_toronto-film-festival',
		subject: 'Ella Hunt',
		alt: 'Ella Hunt at the Toronto International Film Festival',
		position: '50% 18%',
	},
	{
		publicId: 'highlights/nicholas-braun_toronto-film-festival',
		subject: 'Nicholas Braun',
		alt: 'Nicholas Braun at the Toronto International Film Festival',
		position: '50% 20%',
	},
	{
		publicId: 'highlights/jay-dixit_red-carpet_01130',
		subject: 'Jude Law',
		alt: 'Jude Law at the Toronto International Film Festival',
		position: '50% 18%',
	},
	{
		publicId: 'highlights/jason-bateman_tiff_2025',
		subject: 'Jason Bateman',
		alt: 'Jason Bateman at the Toronto International Film Festival',
		position: '50% 18%',
	},
	{
		publicId: 'highlights/jason-bateman-jude-law_tiff_2025',
		subject: 'Jason Bateman & Jude Law',
		alt: 'Jason Bateman and Jude Law at the Toronto International Film Festival',
		position: '50% 34%',
	},
	{
		publicId: 'highlights/jason-bateman-jude-law-09836_tiff_2025',
		subject: 'Jason Bateman & Jude Law',
		alt: 'Jason Bateman and Jude Law on the Toronto International Film Festival red carpet',
		position: '50% 38%',
	},
	{
		publicId:
			'highlights/Ana_de_Armas_and_Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_04',
		subject: 'Ana de Armas & Sydney Sweeney',
		alt: 'Ana de Armas and Sydney Sweeney at the Toronto International Film Festival',
		position: '50% 22%',
	},
];
