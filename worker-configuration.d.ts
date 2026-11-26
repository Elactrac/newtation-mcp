/* eslint-disable */
// Runtime type declarations for Cloudflare Worker bindings
// Regenerate with: npx wrangler types

declare namespace Cloudflare {
  interface Env {
    MCP_OBJECT: DurableObjectNamespace<import("./src/index").NewtationMCP>;
    TARGET_RATE_LIMITER: RateLimit;
  }
}
interface Env extends Cloudflare.Env {}
