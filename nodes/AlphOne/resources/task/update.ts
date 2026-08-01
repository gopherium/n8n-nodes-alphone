import type { INodeProperties } from 'n8n-workflow';

export const updateDescription: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The uuid of an existing task, from an AlphOne event or a task lookup. Never guess it, look the task up first.',
		displayOptions: { show: { resource: ['task'], operation: ['update', 'get', 'complete'] } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'A field you leave out keeps its current value',
		displayOptions: { show: { resource: ['task'], operation: ['update'] } },
		options: [
			{
				displayName: 'Due On',
				name: 'due_on',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD',
				description: 'The calendar day to move the task to, as YYYY-MM-DD',
				routing: { request: { body: { due_on: '={{$value}}' } } },
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
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'open',
				description: 'Whether the task is still open or done',
				options: [
					{ name: 'Open', value: 'open' },
					{ name: 'Done', value: 'done' },
				],
				routing: { request: { body: { status: '={{$value}}' } } },
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'What the task is',
				routing: { request: { body: { title: '={{$value}}' } } },
			},
		],
	},
];
