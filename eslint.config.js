import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import astroPlugin from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		ignores: [
			'dist/**',
			'.astro/**',
			'**/.astro/**',
			'node_modules/**',
			'.cache/**',
			'playwright-report/**',
			'test-results/**',
			'docs/**',
			'venv/**',
			'astro-jay-dixit-photos-starter/**',
		],
	},
	{
		files: ['scripts/**/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'no-unused-vars': 'off',
		},
	},
	{
		files: ['salient-portfolio.js'],
		languageOptions: {
			globals: {
				...globals.browser,
				jQuery: 'readonly',
			},
		},
		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'no-redeclare': 'off',
		},
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json',
				sourceType: 'module',
			},
			globals: {
				...globals.node,
				...globals.browser,
			},
		},
		plugins: {
			'@typescript-eslint': ts,
		},
		rules: {
			...ts.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
	{
		files: ['**/*.astro'],
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tsParser,
			},
			globals: {
				...globals.browser,
				...globals.node,
				URL: 'readonly',
			},
		},
		plugins: {
			astro: astroPlugin,
		},
		rules: {
			...astroPlugin.configs.recommended.rules,
		},
	},
];
