import { describe, expect, it } from 'vitest';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INode,
	INodeExecutionData,
	INodePropertyRouting,
} from 'n8n-workflow';

import { graphItems, graphPage } from './graph';

type PostReceiveFunction = (
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) => Promise<INodeExecutionData[]>;

const node = {
	id: '1',
	name: 'AlphOne',
	type: 'n8n-nodes-alphone.alphOne',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
} as INode;

const context = { getNode: () => node } as unknown as IExecuteSingleFunctions;

/** Returns the items a routing makes of one answered body. */
async function received(routing: INodePropertyRouting, body: unknown): Promise<IDataObject[]> {
	const response = { body, headers: {}, statusCode: 200 } as IN8nHttpFullResponse;
	let items: INodeExecutionData[] = [{ json: body as IDataObject }];
	for (const action of routing.output?.postReceive ?? []) {
		items = await (action as PostReceiveFunction).call(context, items, response);
	}
	return items.map((item) => item.json);
}

/** Returns the body a routing sends for the given variables. */
async function sent(routing: INodePropertyRouting, variables: IDataObject): Promise<IDataObject> {
	const body = { ...(routing.request?.body as IDataObject), variables };
	const options = { url: '', body } as IHttpRequestOptions;
	for (const action of routing.send?.preSend ?? []) {
		await action.call(context, options);
	}
	return options.body as IDataObject;
}

describe('a graph operation', () => {
	it('posts its document to the graph endpoint', () => {
		const routing = graphItems('query NodeTask { task { id } }', 'task');

		expect(routing.request).toEqual({
			method: 'POST',
			url: '/api/graphql',
			body: { query: 'query NodeTask { task { id } }' },
		});
	});

	it('reads the answered record under the node output names', async () => {
		const routing = graphItems('query NodeTask { task { id } }', 'task');

		const items = await received(routing, {
			data: { task: { id: 'a', dueOn: '2026-08-09', originEventId: null } },
		});

		expect(items).toEqual([{ id: 'a', due_on: '2026-08-09', origin_event_id: null }]);
	});

	it('renames the keys nested under a record', async () => {
		const routing = graphItems('query NodeContact { contact { id } }', 'contact');

		const items = await received(routing, {
			data: { contact: { id: 'a', identities: [{ id: 'b', displayName: 'Maria Perez' }] } },
		});

		expect(items).toEqual([{ id: 'a', identities: [{ id: 'b', display_name: 'Maria Perez' }] }]);
	});

	it('reads an answered list as one item per record', async () => {
		const routing = graphItems('query NodeImports { imports { id } }', 'imports');

		const items = await received(routing, {
			data: { imports: [{ id: 'a', rowCount: 2 }, { id: 'b', rowCount: 3 }] },
		});

		expect(items).toEqual([
			{ id: 'a', row_count: 2 },
			{ id: 'b', row_count: 3 },
		]);
	});

	it('reads a nested list, so an import answers with its contacts', async () => {
		const routing = graphItems('query NodeImportContacts { importJob { contacts { name } } }', 'importJob.contacts');

		const items = await received(routing, {
			data: { importJob: { contacts: [{ contactId: 'a', name: 'Maria Perez', rowId: 'b' }] } },
		});

		expect(items).toEqual([{ contact_id: 'a', name: 'Maria Perez', row_id: 'b' }]);
	});

	it('fails with the message the graph reported', async () => {
		const routing = graphItems('query NodeTask { task { id } }', 'task');

		await expect(
			received(routing, { data: { task: null }, errors: [{ message: 'task not found' }] }),
		).rejects.toThrow('task not found');
	});

	it('fails when the answer carries no record, rather than emitting an empty item', async () => {
		const routing = graphItems('query NodeTask { task { id } }', 'task');

		await expect(received(routing, { data: { task: null } })).rejects.toThrow('no record');
	});

	it('drops a blank variable, so an unset optional field is left out', async () => {
		const routing = graphItems('mutation NodeCreateTask { createTask { task { id } } }', 'createTask.task');

		const body = await sent(routing, { title: 'Call back', contactId: '' });

		expect(body.variables).toEqual({ title: 'Call back' });
	});
});

describe('a graph connection operation', () => {
	it('flattens the edges to one item per node', async () => {
		const routing = graphPage('query NodeTasks { tasks { edges { node { id } } } }', 'tasks');

		const items = await received(routing, {
			data: {
				tasks: {
					edges: [
						{ node: { id: 'a', dueOn: '2026-08-09' }, cursor: 'x' },
						{ node: { id: 'b', dueOn: '2026-08-10' }, cursor: 'y' },
					],
				},
			},
		});

		expect(items).toEqual([
			{ id: 'a', due_on: '2026-08-09' },
			{ id: 'b', due_on: '2026-08-10' },
		]);
	});

	it('answers with no items for an empty page', async () => {
		const routing = graphPage('query NodeTasks { tasks { edges { node { id } } } }', 'tasks');

		const items = await received(routing, { data: { tasks: { edges: [] } } });

		expect(items).toEqual([]);
	});
});
