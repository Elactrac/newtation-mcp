/* eslint-disable */
// Runtime type declarations for Cloudflare Worker bindings
// Regenerate with: npx wrangler types

declare namespace Cloudflare {
  interface Env {
    OAUTH_KV: KVNamespace;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    COOKIE_ENCRYPTION_KEY: string;
    MCP_OBJECT: DurableObjectNamespace<import("./src/index").NewtationMCP>;
  }
}
interface Env extends Cloudflare.Env {}
