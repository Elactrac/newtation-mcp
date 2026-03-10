/**
 * GitHub OAuth handler for Newtation MCP Server.
 *
 * Handles the OAuth authorize/callback flow with GitHub as the identity provider.
 * Uses Cloudflare's workers-oauth-provider under the hood.
 */

import { env } from "cloudflare:workers";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, type Props } from "./utils";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthError,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

// ── GET /authorize — show approval dialog or redirect to GitHub ─────────────

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) {
    return c.text("Invalid request", 400);
  }

  // Skip dialog if client was previously approved
  if (await isClientApproved(c.req.raw, clientId, env.COOKIE_ENCRYPTION_KEY)) {
    const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);
    return redirectToGithub(c.req.raw, stateToken, { "Set-Cookie": sessionBindingCookie });
  }

  // Show approval dialog with CSRF protection
  const { token: csrfToken, setCookie } = generateCSRFProtection();

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    server: {
      name: "Newtation AI Presence",
      description: "AI brand presence auditing tools — audit how AI systems perceive, describe, and cite your brand.",
      logo: "https://newtationco.app/favicon.ico",
    },
    setCookie,
    state: { oauthReqInfo },
  });
});

// ── POST /authorize — handle approval form submission ───────────────────────

app.post("/authorize", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") {
      return c.text("Missing state in form data", 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch (_e) {
      return c.text("Invalid state data", 400);
    }

    if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
      return c.text("Invalid request", 400);
    }

    // Add client to approved list + create state + bind to session
    const approvedClientCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY,
    );
    const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append("Set-Cookie", approvedClientCookie);
    headers.append("Set-Cookie", sessionBindingCookie);

    return redirectToGithub(c.req.raw, stateToken, Object.fromEntries(headers));
  } catch (error: any) {
    console.error("POST /authorize error:", error);
    if (error instanceof OAuthError) {
      return error.toResponse();
    }
    return c.text(`Internal server error: ${error.message}`, 500);
  }
});

// ── Helper: redirect to GitHub OAuth ────────────────────────────────────────

/**
 * Creates a redirect response pointing to the GitHub OAuth authorization page.
 *
 * @param request - The incoming HTTP Request.
 * @param stateToken - The generated state token to include in the request.
 * @param headers - Optional additional headers to include in the response (e.g., Set-Cookie).
 * @returns A Response object that redirects the client to GitHub.
 */
async function redirectToGithub(
  request: Request,
  stateToken: string,
  headers: Record<string, string> = {},
) {
  return new Response(null, {
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: new URL("/callback", request.url).href,
        scope: "read:user user:email",
        state: stateToken,
        upstream_url: "https://github.com/login/oauth/authorize",
      }),
    },
    status: 302,
  });
}

// ── GET /callback — exchange code for token, complete auth ──────────────────

app.get("/callback", async (c) => {
  let oauthReqInfo: AuthRequest;
  let clearSessionCookie: string;

  try {
    const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
    oauthReqInfo = result.oauthReqInfo;
    clearSessionCookie = result.clearCookie;
  } catch (error: any) {
    if (error instanceof OAuthError) {
      return error.toResponse();
    }
    return c.text("Internal server error", 500);
  }

  if (!oauthReqInfo.clientId) {
    return c.text("Invalid OAuth request data", 400);
  }

  // Exchange code for access token
  const [accessToken, errResponse] = await fetchUpstreamAuthToken({
    client_id: c.env.GITHUB_CLIENT_ID,
    client_secret: c.env.GITHUB_CLIENT_SECRET,
    code: c.req.query("code"),
    redirect_uri: new URL("/callback", c.req.url).href,
    upstream_url: "https://github.com/login/oauth/access_token",
  });
  if (errResponse) return errResponse;

  // Fetch user info from GitHub
  const userResp = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "newtation-mcp",
      Accept: "application/vnd.github+json",
    },
  });
  if (!userResp.ok) {
    return c.text("Failed to fetch user info from GitHub", 500);
  }
  const user = (await userResp.json()) as { login: string; name: string; email: string };

  // Complete authorization and redirect back to the MCP client
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    metadata: { label: user.name || user.login },
    props: {
      accessToken,
      email: user.email ?? "",
      login: user.login,
      name: user.name ?? user.login,
    } as Props,
    request: oauthReqInfo,
    scope: oauthReqInfo.scope,
    userId: user.login,
  });

  const headers = new Headers({ Location: redirectTo });
  if (clearSessionCookie) {
    headers.set("Set-Cookie", clearSessionCookie);
  }

  return new Response(null, { status: 302, headers });
});

export { app as GitHubHandler };
