import type { INodeProperties } from 'n8n-workflow';
import { createDescription } from './create';
import { getAllDescription } from './getAll';
import { updateDescription } from './update';

const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'create',
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{
				name: 'Complete',
				value: 'complete',
				action: 'Complete a task',
				description: 'Move a task into done',
				routing: {
					request: { method: 'PATCH', url: '=/api/tasks/{{$parameter["taskId"]}}', body: { status: 'done' } },
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a task',
				routing: { request: { method: 'POST', url: '/api/tasks' } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a task',
				routing: { request: { method: 'GET', url: '=/api/tasks/{{$parameter["taskId"]}}' } },
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tasks',
				routing: {
					request: { method: 'GET', url: '/api/tasks' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'tasks' } }] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a task',
				routing: { request: { method: 'PATCH', url: '=/api/tasks/{{$parameter["taskId"]}}' } },
			},
		],
	},
];

export const taskDescription: INodeProperties[] = [
	...operations,
	...createDescription,
	...getAllDescription,
	...updateDescription,
];
