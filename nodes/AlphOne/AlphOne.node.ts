import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { taskDescription } from './resources/task';
import { contactDescription } from './resources/contact';

export class AlphOne implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AlphOne',
		name: 'alphOne',
		icon: { light: 'file:../../icons/alphone.svg', dark: 'file:../../icons/alphone.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write AlphOne CRM tasks and contacts',
		defaults: {
			name: 'AlphOne',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'alphOneApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'task',
				options: [
					{ name: 'Task', value: 'task' },
					{ name: 'Contact', value: 'contact' },
				],
			},
			...taskDescription,
			...contactDescription,
		],
	};
}
