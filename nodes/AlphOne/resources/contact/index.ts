import type { INodeProperties } from 'n8n-workflow';
import { graphItems, graphPage } from '../../graph';

/** contactFields is the contact shape every contact operation answers with. */
const contactFields = 'id name createdAt';

const contactsDocument = `
	query NodeContacts($q: String, $first: Int) {
		contacts(q: $q, first: $first) {
			edges { node { ${contactFields} } }
		}
	}
`;

const contactDocument = `
	query NodeContact($id: UUID!) {
		contact(id: $id) {
			${contactFields}
			identities { id channel identifier displayName }
		}
	}
`;

const createContactDocument = `
	mutation NodeCreateContact($name: String!) {
		createContact(name: $name) { ${contactFields} }
	}
`;

const renameContactDocument = `
	mutation NodeRenameContact($id: UUID!, $name: String!) {
		renameContact(id: $id, name: $name) { ${contactFields} }
	}
`;

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
				routing: graphItems(createContactDocument, 'createContact'),
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a contact',
				description: 'Read one contact with its channel identities',
				routing: graphItems(contactDocument, 'contact'),
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many contacts',
				routing: graphPage(contactsDocument, 'contacts'),
			},
			{
				name: 'Rename',
				value: 'rename',
				action: 'Rename a contact',
				routing: graphItems(renameContactDocument, 'renameContact'),
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
		routing: { send: { type: 'body', property: 'variables.id' } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Names are not unique',
		displayOptions: { show: { resource: ['contact'], operation: ['create', 'rename'] } },
		routing: { send: { type: 'body', property: 'variables.name' } },
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description:
			"Matches the contact name, an identity's display name, and phone style identifiers. Digits are pulled out, so +1 844 672 finds 184467235.",
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
		routing: { send: { type: 'body', property: 'variables.q' } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: 200 },
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
		routing: { send: { type: 'body', property: 'variables.first' } },
	},
];

export const contactDescription: INodeProperties[] = [...operations, ...fields];
