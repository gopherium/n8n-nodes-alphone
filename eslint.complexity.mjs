import { config } from '@n8n/node-cli/eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
	...config,
	{
		files: ['**/*.ts'],
		ignores: ['**/*.test.ts'],
		plugins: { sonarjs },
		rules: {
			complexity: ['error', 10],
			'sonarjs/cognitive-complexity': ['error', 15],
		},
	},
];
