import type { INodeProperties } from 'n8n-workflow';

const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: ['import'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get an import',
				description: 'Read one import with its columns, its mapping, and its counts',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/plugins/importer/imports/{{$parameter["importId"]}}',
					},
				},
			},
			{
				name: 'Get Contacts',
				value: 'getContacts',
				action: 'Get the contacts of an import',
				description:
					'Read the contacts an import created, each with the ID of the row that created it. Use that row ID as the origin event ID of any task you create, so a replay creates no second task.',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/plugins/importer/imports/{{$parameter["importId"]}}/contacts',
					},
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'contacts' } }] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many imports',
				description: 'List every import, newest first, whoever uploaded it',
				routing: { request: { method: 'GET', url: '/api/plugins/importer/imports' } },
			},
		],
	},
];

const fields: INodeProperties[] = [
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The uuid of an existing import, from an AlphOne import.completed event or an import lookup. Never guess it, list the imports first.',
		displayOptions: { show: { resource: ['import'], operation: ['get', 'getContacts'] } },
	},
];

export const importDescription: INodeProperties[] = [...operations, ...fields];
