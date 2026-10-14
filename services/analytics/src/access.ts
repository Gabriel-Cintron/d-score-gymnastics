let cached: { team: string; until: number; keys: (JsonWebKey & { kid?: string })[] } | undefined;
function decode(part: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}
export async function authorize(
  request: Request,
  team: string,
  audience: string,
): Promise<boolean> {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !audience) return false;
  try {
    const [headerPart, payloadPart, signaturePart, extra] = (
      request.headers.get('Cf-Access-Jwt-Assertion') ?? ''
    ).split('.');
    if (!headerPart || !payloadPart || !signaturePart || extra) return false;
    const header = JSON.parse(new TextDecoder().decode(decode(headerPart))) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(new TextDecoder().decode(decode(payloadPart))) as {
      iss?: string;
      aud?: string[];
      exp?: number;
      nbf?: number;
      email?: string;
    };
    const now = Date.now() / 1000;
    if (
      header.alg !== 'RS256' ||
      payload.iss !== `https://${team}` ||
      !Array.isArray(payload.aud) ||
      !payload.aud.includes(audience) ||
      !payload.exp ||
      payload.exp <= now ||
      (payload.nbf !== undefined && payload.nbf > now) ||
      !payload.email
    )
      return false;
    if (
      !cached ||
      cached.team !== team ||
      cached.until < Date.now() ||
      !cached.keys.some((k) => k.kid === header.kid)
    ) {
      const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
      if (!response.ok) return false;
      const body = (await response.json()) as { keys: (JsonWebKey & { kid?: string })[] };
      cached = { team, until: Date.now() + 3_600_000, keys: body.keys };
    }
    const jwk = cached.keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return false;
  }
}
