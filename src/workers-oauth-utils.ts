/**
 * OAuth utility functions with CSRF and state validation.
 * Handles secure state management, CSRF protection, and approval dialog rendering.
 *
 * Based on Cloudflare's workers-oauth-utils reference implementation.
 */

import type { AuthRequest, ClientInfo } from "@cloudflare/workers-oauth-provider";

/**
 * Represents an error that occurs during the OAuth authorization process.
 */
export class OAuthError extends Error {
  /**
   * Constructs a new OAuthError instance.
   *
   * @param code - The short error code (e.g., 'invalid_request').
   * @param description - A human-readable description of the error.
   * @param statusCode - The HTTP status code to return (defaults to 400).
   */
  constructor(
    public code: string,
    public description: string,
    public statusCode = 400,
  ) {
    super(description);
    this.name = "OAuthError";
  }

  /**
   * Converts the OAuthError into an HTTP Response object.
   *
   * @returns A Response object with a JSON body representing the error.
   */
  toResponse(): Response {
    return new Response(
      JSON.stringify({ error: this.code, error_description: this.description }),
      { status: this.statusCode, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ── Text / URL sanitization ─────────────────────────────────────────────────

/**
 * Sanitizes text by replacing HTML characters with their corresponding entities.
 *
 * @param text - The raw text to sanitize.
 * @returns The sanitized text safe for HTML injection.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitizes a URL to prevent XSS and ensure it uses an allowed scheme (http/https).
 *
 * @param url - The URL string to sanitize.
 * @returns The sanitized URL or an empty string if validation fails.
 */
export function sanitizeUrl(url: string): string {
  const normalized = url.trim();
  if (normalized.length === 0) return "";

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) return "";
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return "";
  }

  const allowedSchemes = ["https", "http"];
  const scheme = parsedUrl.protocol.slice(0, -1).toLowerCase();
  if (!allowedSchemes.includes(scheme)) return "";

  return normalized;
}

// ── CSRF protection ─────────────────────────────────────────────────────────

/**
 * Generates a CSRF token and a Set-Cookie string for binding the token to the client.
 *
 * @returns An object containing the generated token and the Set-Cookie string.
 */
export function generateCSRFProtection(): { token: string; setCookie: string } {
  const csrfCookieName = "__Host-CSRF_TOKEN";
  const token = crypto.randomUUID();
  const setCookie = `${csrfCookieName}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { token, setCookie };
}

/**
 * Validates the CSRF token from the provided form data against the token found in the request cookies.
 *
 * @param formData - The FormData containing the `csrf_token` field.
 * @param request - The incoming HTTP Request containing the CSRF cookie.
 * @returns An object containing a Set-Cookie string to clear the CSRF cookie.
 * @throws OAuthError if the CSRF token is missing or does not match.
 */
export function validateCSRFToken(formData: FormData, request: Request): { clearCookie: string } {
  const csrfCookieName = "__Host-CSRF_TOKEN";
  const tokenFromForm = formData.get("csrf_token");

  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new OAuthError("invalid_request", "Missing CSRF token in form data", 400);
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const csrfCookie = cookies.find((c) => c.startsWith(`${csrfCookieName}=`));
  const tokenFromCookie = csrfCookie ? csrfCookie.substring(csrfCookieName.length + 1) : null;

  if (!tokenFromCookie) {
    throw new OAuthError("invalid_request", "Missing CSRF token cookie", 400);
  }
  if (tokenFromForm !== tokenFromCookie) {
    throw new OAuthError("invalid_request", "CSRF token mismatch", 400);
  }

  return { clearCookie: `${csrfCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0` };
}

// ── OAuth state management ──────────────────────────────────────────────────

/**
 * Creates and stores the OAuth state in a KV namespace.
 *
 * @param oauthReqInfo - The parsed OAuth authorization request information.
 * @param kv - The KVNamespace instance used to store the state.
 * @param stateTTL - The time-to-live for the state in seconds (defaults to 600).
 * @returns An object containing the generated state token.
 */
export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  stateTTL = 600,
): Promise<{ stateToken: string }> {
  const stateToken = crypto.randomUUID();
  await kv.put(`oauth:state:${stateToken}`, JSON.stringify(oauthReqInfo), {
    expirationTtl: stateTTL,
  });
  return { stateToken };
}

/**
 * Creates a hashed session cookie binding for a given state token.
 *
 * @param stateToken - The state token to bind to the session.
 * @returns An object containing the Set-Cookie string for the session binding.
 */
export async function bindStateToSession(stateToken: string): Promise<{ setCookie: string }> {
  const consentedStateCookieName = "__Host-CONSENTED_STATE";
  const encoder = new TextEncoder();
  const data = encoder.encode(stateToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    setCookie: `${consentedStateCookieName}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
  };
}

/**
 * Validates the OAuth state from the request against the stored state in KV and the session cookie.
 *
 * @param request - The incoming HTTP Request containing the `state` query parameter and session cookie.
 * @param kv - The KVNamespace instance used to retrieve the stored state.
 * @returns An object containing the original OAuth authorization request info and a Set-Cookie string to clear the session.
 * @throws OAuthError if the state is missing, invalid, expired, or mismatches the session binding.
 */
export async function validateOAuthState(
  request: Request,
  kv: KVNamespace,
): Promise<{ oauthReqInfo: AuthRequest; clearCookie: string }> {
  const consentedStateCookieName = "__Host-CONSENTED_STATE";
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");

  if (!stateFromQuery) {
    throw new OAuthError("invalid_request", "Missing state parameter", 400);
  }

  const storedDataJson = await kv.get(`oauth:state:${stateFromQuery}`);
  if (!storedDataJson) {
    throw new OAuthError("invalid_request", "Invalid or expired state", 400);
  }

  // Validate session binding cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const consentedStateCookie = cookies.find((c) => c.startsWith(`${consentedStateCookieName}=`));
  const consentedStateHash = consentedStateCookie
    ? consentedStateCookie.substring(consentedStateCookieName.length + 1)
    : null;

  if (!consentedStateHash) {
    throw new OAuthError("invalid_request", "Missing session binding cookie", 400);
  }

  // Verify hash matches
  const encoder = new TextEncoder();
  const data = encoder.encode(stateFromQuery);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const stateHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (stateHash !== consentedStateHash) {
    throw new OAuthError("invalid_request", "State mismatch — possible CSRF attack", 400);
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(storedDataJson) as AuthRequest;
  } catch {
    throw new OAuthError("server_error", "Invalid state data", 500);
  }

  // Delete state (one-time use)
  await kv.delete(`oauth:state:${stateFromQuery}`);

  return {
    oauthReqInfo,
    clearCookie: `${consentedStateCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`,
  };
}

// ── Approved clients cookie management ──────────────────────────────────────

/**
 * Checks if a specific client has been previously approved by examining the signed cookie.
 *
 * @param request - The incoming HTTP Request containing the approved clients cookie.
 * @param clientId - The client identifier to check.
 * @param cookieSecret - The secret key used to verify the cookie's HMAC signature.
 * @returns True if the client is approved, otherwise false.
 */
export async function isClientApproved(
  request: Request,
  clientId: string,
  cookieSecret: string,
): Promise<boolean> {
  const approvedClients = await getApprovedClientsFromCookie(request, cookieSecret);
  return approvedClients?.includes(clientId) ?? false;
}

/**
 * Adds a client to the list of approved clients in a signed cookie.
 *
 * @param request - The incoming HTTP Request containing the current approved clients cookie (if any).
 * @param clientId - The client identifier to approve.
 * @param cookieSecret - The secret key used to sign the updated cookie.
 * @returns The Set-Cookie string for the updated approved clients cookie.
 */
export async function addApprovedClient(
  request: Request,
  clientId: string,
  cookieSecret: string,
): Promise<string> {
  const approvedClientsCookieName = "__Host-APPROVED_CLIENTS";
  const THIRTY_DAYS = 2592000;

  const existing = (await getApprovedClientsFromCookie(request, cookieSecret)) || [];
  const updated = Array.from(new Set([...existing, clientId]));

  const payload = JSON.stringify(updated);
  const signature = await signData(payload, cookieSecret);
  const cookieValue = `${signature}.${btoa(payload)}`;

  return `${approvedClientsCookieName}=${cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}

// ── Approval dialog ─────────────────────────────────────────────────────────

/**
 * Options required to render the OAuth approval dialog.
 */
export interface ApprovalDialogOptions {
  /** Information about the requesting client. */
  client: ClientInfo | null;
  /** Information about the current server. */
  server: {
    /** The display name of the server. */
    name: string;
    /** An optional URL to the server's logo. */
    logo?: string;
    /** An optional description of the server. */
    description?: string;
  };
  /** The state object to be encoded and submitted with the form. */
  state: Record<string, any>;
  /** The generated CSRF token to be included as a hidden field. */
  csrfToken: string;
  /** The Set-Cookie string(s) to be sent with the response. */
  setCookie: string;
}

/**
 * Renders an HTML approval dialog for the user to grant access to an MCP Client.
 *
 * @param request - The incoming HTTP Request.
 * @param options - The configuration options for the approval dialog.
 * @returns A Response object containing the rendered HTML dialog.
 */
export function renderApprovalDialog(request: Request, options: ApprovalDialogOptions): Response {
  const { client, server, state, csrfToken, setCookie } = options;
  const encodedState = btoa(JSON.stringify(state));

  const serverName = sanitizeText(server.name);
  const clientName = client?.clientName ? sanitizeText(client.clientName) : "Unknown MCP Client";
  const serverDescription = server.description ? sanitizeText(server.description) : "";
  const logoUrl = server.logo ? sanitizeText(sanitizeUrl(server.logo)) : "";

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${clientName} | Authorization Request</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 2rem auto; padding: 1rem; }
    .precard { padding: 2rem; text-align: center; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 8px 36px 8px rgba(0,0,0,.1); padding: 2rem; }
    .header { display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
    .logo { width: 48px; height: 48px; margin-right: 1rem; border-radius: 8px; object-fit: contain; }
    .title { margin: 0; font-size: 1.3rem; font-weight: 400; }
    .alert { font-size: 1.5rem; font-weight: 400; margin: 1rem 0; text-align: center; }
    .description { color: #555; }
    .actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
    .button { padding: .75rem 1.5rem; border-radius: 6px; font-weight: 500; cursor: pointer; border: none; font-size: 1rem; }
    .button-primary { background: #0070f3; color: #fff; }
    .button-secondary { background: transparent; border: 1px solid #e5e7eb; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="precard">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="${serverName} Logo" class="logo">` : ""}
        <h1 class="title"><strong>${serverName}</strong></h1>
      </div>
      ${serverDescription ? `<p class="description">${serverDescription}</p>` : ""}
    </div>
    <div class="card">
      <h2 class="alert"><strong>${clientName}</strong> is requesting access</h2>
      <p>This MCP Client wants to use ${serverName} tools on your behalf. You will be redirected to GitHub to sign in.</p>
      <form method="post" action="${new URL(request.url).pathname}">
        <input type="hidden" name="state" value="${encodedState}">
        <input type="hidden" name="csrf_token" value="${csrfToken}">
        <div class="actions">
          <button type="button" class="button button-secondary" onclick="window.history.back()">Cancel</button>
          <button type="submit" class="button button-primary">Approve</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;

  return new Response(htmlContent, {
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": setCookie,
      "X-Frame-Options": "DENY",
    },
  });
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Retrieves the list of approved clients from the signed cookie.
 *
 * @param request - The incoming HTTP Request.
 * @param cookieSecret - The secret key used to verify the cookie's signature.
 * @returns An array of approved client IDs, or null if the cookie is invalid or missing.
 */
async function getApprovedClientsFromCookie(
  request: Request,
  cookieSecret: string,
): Promise<string[] | null> {
  const approvedClientsCookieName = "__Host-APPROVED_CLIENTS";
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const targetCookie = cookies.find((c) => c.startsWith(`${approvedClientsCookieName}=`));
  if (!targetCookie) return null;

  const cookieValue = targetCookie.substring(approvedClientsCookieName.length + 1);
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;

  const [signatureHex, base64Payload] = parts;
  const payload = atob(base64Payload);
  const isValid = await verifySignature(signatureHex, payload, cookieSecret);
  if (!isValid) return null;

  try {
    const approvedClients = JSON.parse(payload);
    if (!Array.isArray(approvedClients) || !approvedClients.every((item) => typeof item === "string")) {
      return null;
    }
    return approvedClients;
  } catch {
    return null;
  }
}

/**
 * Signs data using HMAC SHA-256.
 *
 * @param data - The data string to sign.
 * @param secret - The secret key used for signing.
 * @returns The resulting signature as a lowercase hex string.
 */
async function signData(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies an HMAC SHA-256 signature for a given string of data.
 *
 * @param signatureHex - The expected signature as a hex string.
 * @param data - The original data string that was signed.
 * @param secret - The secret key used to verify the signature.
 * @returns True if the signature matches, false otherwise.
 */
async function verifySignature(signatureHex: string, data: string, secret: string): Promise<boolean> {
  const key = await importKey(secret);
  const enc = new TextEncoder();
  try {
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)),
    );
    return await crypto.subtle.verify("HMAC", key, signatureBytes.buffer, enc.encode(data));
  } catch {
    return false;
  }
}

/**
 * Imports a raw secret string as a CryptoKey for HMAC signing and verification.
 *
 * @param secret - The secret string to import.
 * @returns The imported CryptoKey.
 * @throws Error if the secret is empty.
 */
async function importKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("cookieSecret is required for signing cookies");
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), { hash: "SHA-256", name: "HMAC" }, false, [
    "sign",
    "verify",
  ]);
}
