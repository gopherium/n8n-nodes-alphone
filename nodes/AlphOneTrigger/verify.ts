import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(
	secret: string | undefined,
	rawBody: Buffer | undefined,
	header: string | undefined,
): boolean {
	if (!secret || !rawBody || !header) {
		return false;
	}
	const want = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
	const got = Buffer.from(header);
	const expected = Buffer.from(want);
	return got.length === expected.length && timingSafeEqual(got, expected);
}
