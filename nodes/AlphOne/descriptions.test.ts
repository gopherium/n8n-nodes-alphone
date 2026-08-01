import { describe, expect, it } from 'vitest';

import { AlphOne } from './AlphOne.node';

const properties = new AlphOne().description.properties;

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

	it('describes every field the model can fill', () => {
		const undocumented = allProperties()
			.filter((property) => property.displayName !== 'Operation' && property.displayName !== 'Resource')
			.filter((property) => property.description === undefined)
			.map((property) => property.displayName);

		expect(undocumented).toEqual([]);
	});
});
