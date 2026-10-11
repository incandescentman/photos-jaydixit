// Jay’s existing text from src/pages/nobel-2024.astro, shared verbatim with the
// corresponding portrait pages. Keep the full account at /nobel-2024/.
export const nobelStory = {
	lectures:
		'The Nobel Prizes consist of a few different events: the ceremony, the Nobel Lectures, and the press conference. In Stockholm, I covered the Nobel Lectures, where each laureate gets an hour on stage to present their life’s work.',
	chemistry:
		'The Chemistry prize went to David Baker, Demis Hassabis, and John Jumper, for using computation and AI to predict and design proteins, the molecular machinery of life. Baker pioneered computational protein design; Hassabis and Jumper developed AlphaFold2, which predicts a protein’s three-dimensional structure from its amino-acid sequence.',
	physics:
		'The Physics prize went to Geoffrey Hinton and John Hopfield, whose foundational discoveries in artificial neural networks made modern machine learning possible.',
};

export const nobelPortraitStories: Record<string, { paragraphs: string[]; section: string }> = {
	'demis-hassabis': {
		paragraphs: [nobelStory.chemistry, nobelStory.lectures],
		section: 'chemistry-title',
	},
	'geoffrey-hinton': {
		paragraphs: [nobelStory.physics, nobelStory.lectures],
		section: 'physics-title',
	},
};
