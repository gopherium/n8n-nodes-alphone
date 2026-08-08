import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/** versionQuery is the smallest graph operation an authenticated caller can run. */
const versionQuery = 'query NodeCredentialTest { version }';

export class AlphOneApi implements ICredentialType {
	name = 'alphOneApi';

	displayName = 'AlphOne API';

	icon: Icon = { light: 'file:../icons/alphone.svg', dark: 'file:../icons/alphone.dark.svg' };

	documentationUrl = 'https://docs.alph.one/reference/rest-api/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:8080',
			placeholder: 'https://crm.example.com',
			required: true,
			description:
				'Where AlphOne answers, with no trailing slash. When n8n runs in Docker, localhost means the n8n container itself, so use http://host.docker.internal:8080 to reach AlphOne on your machine.',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create one with: alphone token create -email you@example.com -name n8n. The secret is shown once.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/graphql',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: { query: versionQuery },
			json: true,
		},
	};
}
