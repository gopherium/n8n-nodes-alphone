import { describe, expect, it } from 'vitest';
import type { INodePropertyOptions } from 'n8n-workflow';

import { AlphOne } from './AlphOne.node';
import { description as packaged } from '../../package.json';

const properties = new AlphOne().description.properties;

/** Returns the resource names a description would have to list. */
function resourceNames(): string[] {
	const resource = properties.find((property) => property.name === 'resource');
	return ((resource?.options ?? []) as INodePropertyOptions[]).map((option) =>
		String(option.name).toLowerCase(),
	);
}

/** Returns the resource names one sentence spells out. */
function enumerated(sentence: string): string[] {
	const said = sentence.toLowerCase();
	return resourceNames().filter((name) => said.includes(name));
}

/** Returns every property in the node, including those nested in collections. */
function allProperties(): { displayName: string; description?: string }[] {
	const found: { displayName: string; description?: string }[] = [];
	for (const property of properties) {
		found.push(property);
		for (const option of property.options ?? []) {
			if (typeof option === 'object' && 'displayName' in option) {
				found.push(option as { displayName: string; description?: string });
			}
		}
	}
	return found;
}

describe('field descriptions read as instructions to a model', () => {
	it('tells the model not to invent an identifier', () => {
		const identifiers = allProperties().filter((property) => /\bID$/.test(property.displayName));

		expect(identifiers.length).toBeGreaterThan(0);
		for (const identifier of identifiers) {
			expect(
				identifier.description,
				`${identifier.displayName} has no description, so a model filling it is told nothing`,
			).toBeDefined();
			expect(
				identifier.description,
				`${identifier.displayName} does not warn against guessing an id`,
			).toMatch(/never guess|do not guess|omit/i);
		}
	});

	it('says what the node is without listing its resources', () => {
		expect(enumerated(new AlphOne().description.description)).toEqual([]);
	});

	it('says what the package is without listing its resources', () => {
		expect(enumerated(packaged)).toEqual([]);
	});

	it('describes every field the model can fill', () => {
		const undocumented = allProperties()
			.filter((property) => property.displayName !== 'Operation' && property.displayName !== 'Resource')
			.filter((property) => property.description === undefined)
			.map((property) => property.displayName);

		expect(undocumented).toEqual([]);
	});
});
