import { describe, expect, it } from 'vitest';

import { AlphOneApi } from './AlphOneApi.credentials';

const credential = new AlphOneApi();

describe('the AlphOne credential', () => {
	it('proves itself with a graph query rather than a REST route', () => {
		expect(credential.test.request).toEqual({
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/graphql',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: { query: 'query NodeCredentialTest { version }' },
			json: true,
		});
	});

	it('sends the token as a bearer credential', () => {
		expect(credential.authenticate.properties.headers).toEqual({
			Authorization: '=Bearer {{$credentials.apiToken}}',
		});
	});
});
