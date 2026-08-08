import { describe, expect, it, vi } from 'vitest';
import type { IDataObject, IHookFunctions, INode } from 'n8n-workflow';

import { AlphOneTrigger } from './AlphOneTrigger.node';

type StaticData = { webhookId?: string; secret?: string };

type GraphAnswer = { data?: IDataObject; errors?: { message: string }[] };

const methods = new AlphOneTrigger().webhookMethods!.default;

const node = {
	id: '1',
	name: 'AlphOne Trigger',
	type: 'n8n-nodes-alphone.alphOneTrigger',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
} as INode;

const webhookUrl = 'https://n8n.example.com/webhook/abc';

/** Returns a hook context answering with the given graph answers in order. */
function fakeHooks(answers: GraphAnswer[], staticData: StaticData = {}) {
	const requests: IDataObject[] = [];
	const request = vi.fn(async (_credential: string, options: IDataObject) => {
		requests.push(options);
		return answers.shift() ?? { data: {} };
	});
	const context = {
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => webhookUrl,
		getNodeParameter: () => ['task.created'],
		getCredentials: async () => ({ baseUrl: 'https://crm.example.com/' }),
		getNode: () => node,
		helpers: { httpRequestWithAuthentication: request },
		logger: { warn: vi.fn() },
	} as unknown as IHookFunctions;
	return { context, requests, staticData };
}

/** Returns the body one recorded request carried. */
function bodyOf(request: IDataObject): { query: string; variables: IDataObject } {
	return request.body as { query: string; variables: IDataObject };
}

describe('subscribing the trigger', () => {
	it('posts a mutation to the graph endpoint and remembers the secret', async () => {
		const { context, requests, staticData } = fakeHooks([
			{ data: { createWebhook: { webhook: { id: 'w1' }, secret: 's1' } } },
		]);

		await methods.create.call(context);

		expect(requests[0].url).toBe('https://crm.example.com/api/graphql');
		expect(bodyOf(requests[0]).query).toContain('createWebhook');
		expect(bodyOf(requests[0]).variables).toEqual({
			url: webhookUrl,
			events: ['task.created'],
		});
		expect(staticData).toEqual({ webhookId: 'w1', secret: 's1' });
	});

	it('revokes the subscription it already holds before making another', async () => {
		const { context, requests, staticData } = fakeHooks(
			[
				{ data: { deleteWebhook: true } },
				{ data: { createWebhook: { webhook: { id: 'w2' }, secret: 's2' } } },
			],
			{ webhookId: 'w1', secret: 's1' },
		);

		await methods.create.call(context);

		expect(bodyOf(requests[0]).query).toContain('deleteWebhook');
		expect(bodyOf(requests[0]).variables).toEqual({ id: 'w1' });
		expect(staticData).toEqual({ webhookId: 'w2', secret: 's2' });
	});

	it('fails rather than storing an empty subscription when the graph reports an error', async () => {
		const { context, staticData } = fakeHooks([{ errors: [{ message: 'webhook: invalid url' }] }]);

		await expect(methods.create.call(context)).rejects.toThrow('webhook: invalid url');

		expect(staticData).toEqual({});
	});
});

describe('checking the subscription', () => {
	it('asks AlphOne nothing when it holds no subscription', async () => {
		const { context, requests } = fakeHooks([]);

		const exists = await methods.checkExists.call(context);

		expect(exists).toBe(false);
		expect(requests).toEqual([]);
	});

	it('keeps a subscription that still names the same url and events', async () => {
		const { context } = fakeHooks(
			[{ data: { webhooks: [{ id: 'w1', url: webhookUrl, events: ['task.created'] }] } }],
			{ webhookId: 'w1', secret: 's1' },
		);

		expect(await methods.checkExists.call(context)).toBe(true);
	});

	it('replaces a subscription AlphOne no longer lists', async () => {
		const { context } = fakeHooks([{ data: { webhooks: [] } }], {
			webhookId: 'w1',
			secret: 's1',
		});

		expect(await methods.checkExists.call(context)).toBe(false);
	});

	it('replaces a subscription whose events no longer match', async () => {
		const { context } = fakeHooks(
			[{ data: { webhooks: [{ id: 'w1', url: webhookUrl, events: ['contact.created'] }] } }],
			{ webhookId: 'w1', secret: 's1' },
		);

		expect(await methods.checkExists.call(context)).toBe(false);
	});
});

describe('deactivating the trigger', () => {
	it('revokes the subscription and forgets it', async () => {
		const { context, requests, staticData } = fakeHooks([{ data: { deleteWebhook: true } }], {
			webhookId: 'w1',
			secret: 's1',
		});

		await methods.delete.call(context);

		expect(bodyOf(requests[0]).variables).toEqual({ id: 'w1' });
		expect(staticData).toEqual({});
	});

	it('forgets a subscription AlphOne refused to revoke, so the next activation is clean', async () => {
		const { context, staticData } = fakeHooks([{ errors: [{ message: 'webhook not found' }] }], {
			webhookId: 'w1',
			secret: 's1',
		});

		await methods.delete.call(context);

		expect(staticData).toEqual({});
	});
});
