import type { INodeProperties } from 'n8n-workflow';

const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'create',
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a contact',
				routing: { request: { method: 'POST', url: '/api/contacts' } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a contact',
				description: 'Read one contact with its channel identities',
				routing: { request: { method: 'GET', url: '=/api/contacts/{{$parameter["contactId"]}}' } },
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many contacts',
				routing: {
					request: { method: 'GET', url: '/api/contacts' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'contacts' } }] },
				},
			},
			{
				name: 'Rename',
				value: 'rename',
				action: 'Rename a contact',
				routing: { request: { method: 'PATCH', url: '=/api/contacts/{{$parameter["contactId"]}}' } },
			},
		],
	},
];

const fields: INodeProperties[] = [
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The uuid of an existing contact, from an AlphOne event or a contact lookup. Never guess it and never use a name, search for the contact first.',
		displayOptions: { show: { resource: ['contact'], operation: ['get', 'rename'] } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Names are not unique',
		displayOptions: { show: { resource: ['contact'], operation: ['create', 'rename'] } },
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description:
			"Matches the contact name, an identity's display name, and phone style identifiers. Digits are pulled out, so +1 844 672 finds 184467235.",
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
		routing: { send: { type: 'query', property: 'q' } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: 200 },
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
		routing: { request: { qs: { limit: '={{$value}}' } } },
	},
];

export const contactDescription: INodeProperties[] = [...operations, ...fields];
