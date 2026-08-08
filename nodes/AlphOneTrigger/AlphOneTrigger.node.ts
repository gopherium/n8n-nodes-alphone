import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type JsonObject,
} from 'n8n-workflow';
import { verifySignature } from './verify';

type StaticData = { webhookId?: string; secret?: string };

type Subscription = { id: string; url: string; events: string[] };

type GraphAnswer = { data?: IDataObject; errors?: { message: string }[] };

const webhooksDocument = `
	query NodeWebhooks {
		webhooks { id url events }
	}
`;

const createWebhookDocument = `
	mutation NodeCreateWebhook($url: String!, $events: [String!]!) {
		createWebhook(url: $url, events: $events) {
			webhook { id }
			secret
		}
	}
`;

const deleteWebhookDocument = `
	mutation NodeDeleteWebhook($id: UUID!) {
		deleteWebhook(id: $id)
	}
`;

/** Returns the data AlphOne answers one graph document with. */
async function callGraph(
	context: IHookFunctions,
	document: string,
	variables: IDataObject,
): Promise<IDataObject> {
	const credentials = await context.getCredentials('alphOneApi');
	const baseUrl = String(credentials.baseUrl).replace(/\/$/, '');
	const answer = (await context.helpers.httpRequestWithAuthentication.call(context, 'alphOneApi', {
		method: 'POST',
		url: `${baseUrl}/api/graphql`,
		body: { query: document, variables },
		json: true,
	})) as GraphAnswer;
	const [first] = answer.errors ?? [];
	if (first) {
		throw new NodeApiError(context.getNode(), answer as JsonObject, { message: first.message });
	}
	return answer.data ?? {};
}

/** Revokes the stored subscription, forgetting it whether or not AlphOne accepted. */
async function revokeSubscription(context: IHookFunctions, data: StaticData): Promise<void> {
	if (!data.webhookId) {
		return;
	}
	try {
		await callGraph(context, deleteWebhookDocument, { id: data.webhookId });
	} catch (error) {
		context.logger.warn('AlphOne Trigger could not revoke its subscription', {
			webhookId: data.webhookId,
			error,
		});
	}
	delete data.webhookId;
	delete data.secret;
}

/** Reports whether a stored subscription still names the same url and events. */
function matchesSubscription(
	found: Subscription | undefined,
	url: string | undefined,
	events: string[],
): boolean {
	if (!found || found.url !== url) {
		return false;
	}
	return found.events.length === events.length && events.every((event) => found.events.includes(event));
}

export class AlphOneTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AlphOne Trigger',
		name: 'alphOneTrigger',
		icon: { light: 'file:../../icons/alphone.svg', dark: 'file:../../icons/alphone.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when something happens in AlphOne',
		defaults: {
			name: 'AlphOne Trigger',
		},
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'alphOneApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				options: [
					{
						name: 'Contact Created',
						value: 'contact.created',
						description:
							'A contact was created, including one created by an inbound message from an unknown number',
					},
					{
						name: 'Import Completed',
						value: 'import.completed',
						description:
							'A contact import finished, carrying the import ID and how many rows it imported and skipped',
					},
					{
						name: 'Task Completed',
						value: 'task.completed',
						description: 'A task moved into done',
					},
					{
						name: 'Task Created',
						value: 'task.created',
						description: 'A task was created, by a person or by an integration',
					},
					{
						name: 'WhatsApp Message Received',
						value: 'whatsapp.message.received',
						description: 'An inbound WhatsApp message was stored',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node') as StaticData;
				if (!data.webhookId || !data.secret) {
					return false;
				}
				const answer = await callGraph(this, webhooksDocument, {});
				const stored = (answer.webhooks ?? []) as Subscription[];
				const found = stored.find((sub) => sub.id === data.webhookId);
				return matchesSubscription(found, this.getNodeWebhookUrl('default'), this.getNodeParameter(
					'events',
				) as string[]);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node') as StaticData;
				await revokeSubscription(this, data);
				const answer = await callGraph(this, createWebhookDocument, {
					url: this.getNodeWebhookUrl('default'),
					events: this.getNodeParameter('events') as string[],
				});
				const created = answer.createWebhook as { webhook: Subscription; secret: string };
				data.webhookId = created.webhook.id;
				data.secret = created.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				await revokeSubscription(this, this.getWorkflowStaticData('node') as StaticData);
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const data = this.getWorkflowStaticData('node') as StaticData;
		const request = this.getRequestObject() as unknown as {
			rawBody?: Buffer;
			headers: Record<string, string | undefined>;
		};
		const signature = request.headers['x-alphone-signature-256'];
		if (!verifySignature(data.secret, request.rawBody, signature)) {
			const response = this.getResponseObject();
			response.status(401).json({ error: 'invalid signature' });
			return { noWebhookResponse: true };
		}
		return {
			workflowData: [this.helpers.returnJsonArray(this.getBodyData())],
		};
	}
}
