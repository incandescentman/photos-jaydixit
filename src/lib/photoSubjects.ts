import people from '../data/people.json';

/** Match catalog filenames, including explicitly recorded group portraits. */
export function photoSubjects(filename: string) {
	const slug = filename
		.split('/')
		.pop()!
		.replace(/\.[^/.]+$/, '')
		.toLowerCase();
	const subject = slug.split('_')[0];
	return people
		.filter(
			(person) =>
				person.photoSlugs?.some((value) => value.toLowerCase() === slug) ||
				person.match.some((value) => {
					const pattern = value.toLowerCase();
					return (
						subject === pattern ||
						(subject.startsWith(`${pattern}-`) && /^\d+$/.test(subject.slice(pattern.length + 1)))
					);
				}),
		)
		.map((person) => ({ href: `/red-carpet/${person.slug}`, label: person.name }));
}
