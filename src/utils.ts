/**
 * Constructs an authorization URL for an upstream OAuth service.
 *
 * @param params - The parameters required to build the authorization URL.
 * @param params.upstream_url - The base URL of the upstream OAuth provider's authorize endpoint.
 * @param params.client_id - The client identifier issued by the upstream OAuth provider.
 * @param params.scope - The space-separated list of scopes to request.
 * @param params.redirect_uri - The URI to which the upstream provider should redirect after authorization.
 * @param params.state - An optional opaque value used to maintain state between the request and the callback.
 * @returns The fully constructed authorization URL.
 */
export function getUpstreamAuthorizeUrl({
  upstream_url,
  client_id,
  scope,
  redirect_uri,
  state,
}: {
  upstream_url: string;
  client_id: string;
  scope: string;
  redirect_uri: string;
  state?: string;
}): string {
  const upstream = new URL(upstream_url);
  upstream.searchParams.set("client_id", client_id);
  upstream.searchParams.set("redirect_uri", redirect_uri);
  upstream.searchParams.set("scope", scope);
  if (state) upstream.searchParams.set("state", state);
  upstream.searchParams.set("response_type", "code");
  return upstream.href;
}

/**
 * Exchanges an authorization code for an access token from the upstream service.
 *
 * @param params - The parameters required to exchange the code for an access token.
 * @param params.client_id - The client identifier issued by the upstream OAuth provider.
 * @param params.client_secret - The client secret issued by the upstream OAuth provider.
 * @param params.code - The authorization code received from the upstream authorize endpoint.
 * @param params.redirect_uri - The redirect URI used in the initial authorization request.
 * @param params.upstream_url - The URL of the upstream OAuth provider's token endpoint.
 * @returns A tuple containing the access token and null on success, or null and a Response object on error.
 */
export async function fetchUpstreamAuthToken({
  client_id,
  client_secret,
  code,
  redirect_uri,
  upstream_url,
}: {
  code: string | undefined;
  upstream_url: string;
  client_secret: string;
  redirect_uri: string;
  client_id: string;
}): Promise<[string, null] | [null, Response]> {
  if (!code) {
    return [null, new Response("Missing code", { status: 400 })];
  }

  const resp = await fetch(upstream_url, {
    body: new URLSearchParams({ client_id, client_secret, code, redirect_uri }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!resp.ok) {
    console.log(await resp.text());
    return [null, new Response("Failed to fetch access token", { status: 500 })];
  }

  const body = await resp.formData();
  const accessToken = body.get("access_token") as string;
  if (!accessToken) {
    return [null, new Response("Missing access token", { status: 400 })];
  }
  return [accessToken, null];
}

/**
 * Context from the auth process, stored in the token and passed to McpAgent as this.props.
 */
export type Props = {
  /** The login username of the authenticated user. */
  login: string;
  /** The full name of the authenticated user. */
  name: string;
  /** The email address of the authenticated user. */
  email: string;
  /** The access token obtained from the OAuth provider. */
  accessToken: string;
};
