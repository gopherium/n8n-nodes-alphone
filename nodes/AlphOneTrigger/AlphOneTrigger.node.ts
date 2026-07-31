import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { verifySignature } from './verify';

type StaticData = { webhookId?: string; secret?: string };

type Subscription = { id: string; url: string; events: string[]; secret?: string };

async function callAlphOne(
	context: IHookFunctions,
	method: 'GET' | 'POST' | 'DELETE',
	path: string,
	body?: IDataObject,
) {
	const credentials = await context.getCredentials('alphOneApi');
	const baseUrl = String(credentials.baseUrl).replace(/\/$/, '');
	return await context.helpers.httpRequestWithAuthentication.call(context, 'alphOneApi', {
		method,
		url: `${baseUrl}${path}`,
		body,
		json: true,
	});
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
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				const response = (await callAlphOne(this, 'GET', '/api/webhooks')) as {
					webhooks: Subscription[];
				};
				const found = response.webhooks.find((sub) => sub.id === data.webhookId);
				if (!found || found.url !== webhookUrl) {
					return false;
				}
				const same =
					found.events.length === events.length &&
					events.every((event) => found.events.includes(event));
				return same;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node') as StaticData;
				if (data.webhookId) {
					try {
						await callAlphOne(this, 'DELETE', `/api/webhooks/${data.webhookId}`);
					} catch (error) {
						this.logger.warn('AlphOne Trigger could not revoke its previous subscription', {
							webhookId: data.webhookId,
							error,
						});
					}
					delete data.webhookId;
					delete data.secret;
				}
				const created = (await callAlphOne(this, 'POST', '/api/webhooks', {
					url: this.getNodeWebhookUrl('default'),
					events: this.getNodeParameter('events') as string[],
				})) as Subscription;
				data.webhookId = created.id;
				data.secret = created.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node') as StaticData;
				if (data.webhookId) {
					try {
						await callAlphOne(this, 'DELETE', `/api/webhooks/${data.webhookId}`);
					} catch (error) {
						this.logger.warn('AlphOne Trigger could not revoke its subscription', {
							webhookId: data.webhookId,
							error,
						});
					}
					delete data.webhookId;
					delete data.secret;
				}
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
