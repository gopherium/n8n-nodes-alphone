import { describe, expect, it } from 'vitest';
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { AlphOne } from './AlphOne.node';

const properties = new AlphOne().description.properties;

/** Returns the property a resource declares under a name. */
function property(name: string, resource: string): INodeProperties {
	const found = properties.find(
		(candidate) =>
			candidate.name === name &&
			(candidate.displayOptions?.show?.resource ?? [resource]).includes(resource),
	);
	if (!found) {
		throw new Error(`the ${resource} resource declares no ${name} property`);
	}
	return found;
}

/** Returns the operation an import operation option describes. */
function operation(value: string): INodePropertyOptions {
	const options = (property('operation', 'import').options ?? []) as INodePropertyOptions[];
	const found = options.find((candidate) => candidate.value === value);
	if (!found) {
		throw new Error(`the import resource offers no ${value} operation`);
	}
	return found;
}

describe('the import resource', () => {
	it('is offered next to the tasks and contacts', () => {
		const resources = (property('resource', 'import').options ?? []) as INodePropertyOptions[];

		expect(resources.map((option) => option.value)).toContain('import');
	});

	it('lists every import', () => {
		expect(operation('getAll').routing?.request).toEqual({
			method: 'GET',
			url: '/api/plugins/importer/imports',
		});
	});

	it('reads one import by id', () => {
		expect(operation('get').routing?.request).toEqual({
			method: 'GET',
			url: '=/api/plugins/importer/imports/{{$parameter["importId"]}}',
		});
	});

	it('unwraps the contacts an import created', () => {
		const routing = operation('getContacts').routing;

		expect(routing?.request).toEqual({
			method: 'GET',
			url: '=/api/plugins/importer/imports/{{$parameter["importId"]}}/contacts',
		});
		expect(routing?.output?.postReceive).toEqual([
			{ type: 'rootProperty', properties: { property: 'contacts' } },
		]);
	});

	it('asks for an import id only where one is read', () => {
		const importId = property('importId', 'import');

		expect(importId.required).toBe(true);
		expect(importId.displayOptions?.show?.operation).toEqual(['get', 'getContacts']);
	});
});

/** Returns the field an Additional Fields collection offers under a name. */
function additionalField(name: string): INodeProperties {
	const collection = properties.find((candidate) => candidate.name === 'additionalFields');
	const options = (collection?.options ?? []) as INodeProperties[];
	const found = options.find((candidate) => candidate.name === name);
	if (!found) {
		throw new Error(`the additional fields offer no ${name}`);
	}
	return found;
}

describe('the task origin', () => {
	it('accepts the event a created task answers', () => {
		const originEventId = additionalField('origin_event_id');

		expect(originEventId.displayName).toBe('Origin Event ID');
		expect(originEventId.routing?.request?.body).toEqual({ origin_event_id: '={{$value}}' });
	});
});
