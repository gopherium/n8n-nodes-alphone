import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from './verify';

const secret = 'whsec_example';
const body = Buffer.from('{"event":"task.created","data":{"id":"abc"}}');

function sign(withSecret: string, of: Buffer): string {
	return 'sha256=' + createHmac('sha256', withSecret).update(of).digest('hex');
}

describe('verifySignature', () => {
	it('accepts the signature AlphOne computes', () => {
		expect(verifySignature(secret, body, sign(secret, body))).toBe(true);
	});

	it('rejects a signature under another secret', () => {
		expect(verifySignature(secret, body, sign('whsec_other', body))).toBe(false);
	});

	it('rejects a signature over another body', () => {
		const other = Buffer.from('{"event":"task.created","data":{"id":"zzz"}}');
		expect(verifySignature(secret, body, sign(secret, other))).toBe(false);
	});

	it('rejects a missing or malformed header', () => {
		expect(verifySignature(secret, body, undefined)).toBe(false);
		expect(verifySignature(secret, body, '')).toBe(false);
		expect(verifySignature(secret, body, 'sha256=zz')).toBe(false);
		expect(verifySignature(secret, body, 'md5=' + 'a'.repeat(64))).toBe(false);
	});

	it('rejects a truncated signature rather than comparing a prefix', () => {
		const full = sign(secret, body);
		expect(verifySignature(secret, body, full.slice(0, 30))).toBe(false);
	});

	it('rejects when no secret is held', () => {
		expect(verifySignature(undefined, body, sign(secret, body))).toBe(false);
	});

	it('rejects when the raw body is unavailable', () => {
		expect(verifySignature(secret, undefined, sign(secret, body))).toBe(false);
	});
});
