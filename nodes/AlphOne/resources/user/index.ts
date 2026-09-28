import type { INodeProperties } from 'n8n-workflow';
import { graphItems } from '../../graph';

/** identityFields is the account shape the me query answers with. */
const identityFields = 'id email name';

const meDocument = `
	query NodeMe {
		me { ${identityFields} }
	}
`;

const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getCurrent',
		displayOptions: { show: { resource: ['user'] } },
		options: [
			{
				name: 'Get Current',
				value: 'getCurrent',
				action: 'Get the current user',
				description:
					'Read the account the credential acts as: its ID, email and name. Every token may call this, whatever its scopes.',
				routing: graphItems(meDocument, 'me'),
			},
		],
	},
];

export const userDescription: INodeProperties[] = [...operations];
