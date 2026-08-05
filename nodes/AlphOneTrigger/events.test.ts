import { describe, expect, it } from 'vitest';
import type { INodePropertyOptions } from 'n8n-workflow';

import { AlphOneTrigger } from './AlphOneTrigger.node';

const events = (new AlphOneTrigger().description.properties.find(
	(property) => property.name === 'events',
)?.options ?? []) as INodePropertyOptions[];

describe('the events a workflow can start on', () => {
	it('offers the finished import', () => {
		const completed = events.find((event) => event.value === 'import.completed');

		expect(completed?.name).toBe('Import Completed');
		expect(completed?.description).toBeDefined();
	});

	it('lists them in the order the lint asks for', () => {
		const names = events.map((event) => event.name);

		expect(names).toEqual([...names].sort());
	});

	it('describes every event, since the list is what a model reads', () => {
		const silent = events.filter((event) => event.description === undefined);

		expect(silent).toEqual([]);
	});
});
