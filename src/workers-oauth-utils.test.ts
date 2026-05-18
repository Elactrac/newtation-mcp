
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateOAuthState, OAuthError } from './workers-oauth-utils.ts';

describe('validateOAuthState', () => {
  it('should throw OAuthError when state parameter is missing', async () => {
    const request = new Request('https://example.com/callback');
    const kv = {} as any;

    try {
      await validateOAuthState(request, kv);
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert(error instanceof OAuthError, `Expected error to be OAuthError, but got ${error?.constructor?.name}`);
      assert.strictEqual(error.code, 'invalid_request');
      assert.strictEqual(error.description, 'Missing state parameter');
      assert.strictEqual(error.statusCode, 400);
    }
  });

  it('should throw OAuthError when state is not found in KV', async () => {
    const request = new Request('https://example.com/callback?state=nonexistent');
    const kv = {
      get: async () => null
    } as any;

    try {
      await validateOAuthState(request, kv);
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert(error instanceof OAuthError);
      assert.strictEqual(error.code, 'invalid_request');
      assert.strictEqual(error.description, 'Invalid or expired state');
    }
  });

  it('should throw OAuthError when session binding cookie is missing', async () => {
    const state = 'some-state';
    const request = new Request(`https://example.com/callback?state=${state}`);
    const kv = {
      get: async () => JSON.stringify({ clientId: 'test' })
    } as any;

    try {
      await validateOAuthState(request, kv);
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert(error instanceof OAuthError);
      assert.strictEqual(error.code, 'invalid_request');
      assert.strictEqual(error.description, 'Missing session binding cookie');
    }
  });
});
