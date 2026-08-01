import type { INodeProperties } from 'n8n-workflow';

export const createDescription: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		description: 'What the task is',
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
		routing: { request: { body: { title: '={{$value}}' } } },
	},
	{
		displayName: 'Due On',
		name: 'dueOn',
		type: 'string',
		default: '={{ $now.toFormat(\'yyyy-MM-dd\') }}',
		required: true,
		placeholder: 'YYYY-MM-DD',
		description: 'The calendar day the task is due, not a timestamp',
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
		routing: { request: { body: { due_on: '={{$value}}' } } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'Optional, a field you leave out is not set on the task',
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
		options: [
			{
				displayName: 'Contact ID',
				name: 'contact_id',
				type: 'string',
				default: '',
				description:
					'The uuid of an existing contact, from an AlphOne event or a contact lookup. Omit it unless you already hold one, never guess and never use a name.',
				routing: { request: { body: { contact_id: '={{$value}}' } } },
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0, maxValue: 9 },
				description: 'From 0 to 9, where 0 is normal',
				routing: { request: { body: { priority: '={{$value}}' } } },
			},
		],
	},
];
