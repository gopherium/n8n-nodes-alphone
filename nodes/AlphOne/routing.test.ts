import { describe, expect, it } from 'vitest';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INode,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	INodePropertyRouting,
} from 'n8n-workflow';

import { AlphOne } from './AlphOne.node';

type PostReceiveFunction = (
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) => Promise<INodeExecutionData[]>;

const properties = new AlphOne().description.properties;

const node = {
	id: '1',
	name: 'AlphOne',
	type: 'n8n-nodes-alphone.alphOne',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
} as INode;

const context = { getNode: () => node } as unknown as IExecuteSingleFunctions;

/** Returns the operation options one resource offers. */
function operationsOf(resource: string): INodePropertyOptions[] {
	const operations = properties.find(
		(property) =>
			property.name === 'operation' &&
			(property.displayOptions?.show?.resource ?? []).includes(resource),
	);
	return (operations?.options ?? []) as INodePropertyOptions[];
}

/** Returns the routing one operation of a resource declares. */
function routingOf(resource: string, operation: string): INodePropertyRouting {
	const found = operationsOf(resource).find((option) => option.value === operation);
	if (!found?.routing) {
		throw new Error(`the ${resource} resource declares no ${operation} routing`);
	}
	return found.routing;
}

/** Returns the document one operation posts. */
function documentOf(resource: string, operation: string): string {
	return String((routingOf(resource, operation).request?.body as IDataObject).query);
}

/** Returns the items one operation makes of an answered body. */
async function received(resource: string, operation: string, body: IDataObject): Promise<IDataObject[]> {
	const response = { body, headers: {}, statusCode: 200 } as IN8nHttpFullResponse;
	let items: INodeExecutionData[] = [{ json: body }];
	for (const action of routingOf(resource, operation).output?.postReceive ?? []) {
		items = await (action as PostReceiveFunction).call(context, items, response);
	}
	return items.map((item) => item.json);
}

/** Returns every resource and operation the node offers. */
function everyOperation(): { resource: string; operation: string }[] {
	const resources = (properties.find((property) => property.name === 'resource')?.options ??
		[]) as INodePropertyOptions[];
	return resources.flatMap((resource) =>
		operationsOf(String(resource.value)).map((operation) => ({
			resource: String(resource.value),
			operation: String(operation.value),
		})),
	);
}

/** Returns every field the node declares, including those nested in collections. */
function everyField(): INodeProperties[] {
	return properties.flatMap((property) => [
		property,
		...((property.options ?? []) as INodeProperties[]).filter((option) => 'type' in option),
	]);
}

describe('every operation', () => {
	it('posts a named document to the graph endpoint', () => {
		const wrong = everyOperation().filter(({ resource, operation }) => {
			const request = routingOf(resource, operation).request;
			return request?.method !== 'POST' || request?.url !== '/api/graphql';
		});

		expect(wrong).toEqual([]);
	});

	it('names its document, so a slow query is traceable in the server log', () => {
		const unnamed = everyOperation().filter(
			({ resource, operation }) => !/\b(query|mutation) Node\w+\(?/.test(documentOf(resource, operation)),
		);

		expect(unnamed).toEqual([]);
	});
});

/** complexityCap is what AlphOne prices one operation against. */
const complexityCap = 2500;

/** Returns the fields one connection document selects for each node. */
function fieldsPerNode(document: string): string[] {
	const selection = /node \{([^}]*)\}/.exec(document);
	return (selection?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
}

/** Returns the largest page one resource offers. */
function maxLimitOf(resource: string): number {
	const limit = properties.find(
		(property) =>
			property.name === 'limit' &&
			(property.displayOptions?.show?.resource ?? []).includes(resource),
	);
	return Number(limit?.typeOptions?.maxValue);
}

describe('every page a workflow reads', () => {
	it.each(['task', 'contact'])('stays under the complexity cap for %s', (resource) => {
		const fields = fieldsPerNode(documentOf(resource, 'getAll'));

		expect(fields.length).toBeGreaterThan(0);
		expect(maxLimitOf(resource) * (fields.length + 2)).toBeLessThanOrEqual(complexityCap);
	});

	it.each(['task', 'contact'])('selects no nested record per node for %s', (resource) => {
		expect(fieldsPerNode(documentOf(resource, 'getAll'))).not.toContain('{');
	});
});

describe('every field a workflow fills', () => {
	it('is sent as a graph variable, never as a query string or a REST body key', () => {
		const routed = everyField().filter((field) => field.routing !== undefined);
		const wrong = routed
			.filter((field) => !field.routing?.send?.property?.startsWith('variables.'))
			.map((field) => field.name);

		expect(routed.length).toBeGreaterThan(0);
		expect(wrong).toEqual([]);
	});
});

describe('the contact resource', () => {
	it('lists contacts under the names the REST answer used', async () => {
		const items = await received('contact', 'getAll', {
			data: {
				contacts: {
					edges: [{ node: { id: 'c1', name: 'Maria Perez', createdAt: '2026-08-09T10:00:00Z' } }],
				},
			},
		});

		expect(items).toEqual([{ id: 'c1', name: 'Maria Perez', created_at: '2026-08-09T10:00:00Z' }]);
	});

	it('reads one contact with its identities', async () => {
		const items = await received('contact', 'get', {
			data: {
				contact: {
					id: 'c1',
					name: 'Maria Perez',
					createdAt: '2026-08-09T10:00:00Z',
					identities: [
						{ id: 'i1', channel: 'whatsapp', identifier: '184467235', displayName: 'Maria' },
					],
				},
			},
		});

		expect(items).toEqual([
			{
				id: 'c1',
				name: 'Maria Perez',
				created_at: '2026-08-09T10:00:00Z',
				identities: [
					{ id: 'i1', channel: 'whatsapp', identifier: '184467235', display_name: 'Maria' },
				],
			},
		]);
	});

	it('answers a create and a rename with the stored contact', async () => {
		const created = await received('contact', 'create', {
			data: { createContact: { id: 'c1', name: 'Maria Perez', createdAt: '2026-08-09T10:00:00Z' } },
		});
		const renamed = await received('contact', 'rename', {
			data: { renameContact: { id: 'c1', name: 'Maria Lopez', createdAt: '2026-08-09T10:00:00Z' } },
		});

		expect(created).toEqual([{ id: 'c1', name: 'Maria Perez', created_at: '2026-08-09T10:00:00Z' }]);
		expect(renamed).toEqual([{ id: 'c1', name: 'Maria Lopez', created_at: '2026-08-09T10:00:00Z' }]);
	});
});

const answeredTask = {
	id: 't1',
	assigneeId: 'u1',
	contactId: 'c1',
	title: 'Call back',
	status: 'open',
	priority: 0,
	dueOn: '2026-08-09',
	originSource: 'n8n',
	originEventId: 'r1',
	createdAt: '2026-08-09T10:00:00Z',
};

const restTask = {
	id: 't1',
	assignee_id: 'u1',
	contact_id: 'c1',
	title: 'Call back',
	status: 'open',
	priority: 0,
	due_on: '2026-08-09',
	origin_source: 'n8n',
	origin_event_id: 'r1',
	created_at: '2026-08-09T10:00:00Z',
};

describe('the task resource', () => {
	it('lists tasks under the names the REST answer used', async () => {
		const items = await received('task', 'getAll', {
			data: { tasks: { edges: [{ node: answeredTask }] } },
		});

		expect(items).toEqual([restTask]);
	});

	it('reads one task', async () => {
		const items = await received('task', 'get', { data: { task: answeredTask } });

		expect(items).toEqual([restTask]);
	});

	it('answers a create with the task rather than the replay flag', async () => {
		const items = await received('task', 'create', {
			data: { createTask: { task: answeredTask, replay: true } },
		});

		expect(items).toEqual([restTask]);
	});

	it('answers an update and a complete with the stored task', async () => {
		const updated = await received('task', 'update', { data: { updateTask: answeredTask } });
		const completed = await received('task', 'complete', { data: { updateTask: answeredTask } });

		expect(updated).toEqual([restTask]);
		expect(completed).toEqual([restTask]);
	});

	it('closes a task in the document, so no status field is needed', () => {
		expect(documentOf('task', 'complete')).toContain('status: "done"');
	});
});

const answeredImport = {
	id: 'i1',
	userId: 'u1',
	filename: 'contacts.csv',
	state: 'imported',
	rowCount: 2,
	importedCount: 2,
	skippedCount: 0,
	failedCount: 0,
	createdAt: '2026-08-09T10:00:00Z',
};

const restImport = {
	id: 'i1',
	user_id: 'u1',
	filename: 'contacts.csv',
	state: 'imported',
	row_count: 2,
	imported_count: 2,
	skipped_count: 0,
	failed_count: 0,
	created_at: '2026-08-09T10:00:00Z',
};

describe('the import resource', () => {
	it('lists imports under the names the REST answer used', async () => {
		const items = await received('import', 'getAll', { data: { imports: [answeredImport] } });

		expect(items).toEqual([restImport]);
	});

	it('reads one import with its columns and its mapping', async () => {
		const items = await received('import', 'get', {
			data: {
				importJob: {
					...answeredImport,
					columns: ['Name', 'Email'],
					mapping: [{ column: 0, field: 'name' }],
				},
			},
		});

		expect(items).toEqual([
			{ ...restImport, columns: ['Name', 'Email'], mapping: [{ column: 0, field: 'name' }] },
		]);
	});

	it('unwraps the contacts an import created', async () => {
		const items = await received('import', 'getContacts', {
			data: {
				importJob: {
					contacts: [{ contactId: 'c1', name: 'Maria Perez', rowId: 'r1' }],
				},
			},
		});

		expect(items).toEqual([{ contact_id: 'c1', name: 'Maria Perez', row_id: 'r1' }]);
	});
});
