import { createHash } from 'crypto'
import { getApiKeyByHash } from '@/lib/sheets/queries'
import { updateApiKeyLastUsed } from '@/lib/sheets/mutations'
import type { ExternalApiScope, ApiKey } from '@/types'

/**
 * Validate a Bearer token from an Authorization header.
 *
 * Steps:
 *  1. Parse "Bearer <plaintext>" from the header
 *  2. SHA-256 hash the plaintext
 *  3. Look up the hash in the api_keys sheet (must be active)
 *  4. Verify the required scope is granted
 *  5. Fire-and-forget: update last_used_at for audit trail
 *
 * Throws on any validation failure — callers should catch and return 401.
 */
export async function validateExternalApiKey(
  authHeader: string | null,
  requiredScope: ExternalApiScope,
): Promise<ApiKey> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header')
  }

  const plaintext = authHeader.slice('Bearer '.length).trim()
  if (!plaintext) throw new Error('Empty API key')

  const hashed = createHash('sha256').update(plaintext).digest('hex')

  const key = await getApiKeyByHash(hashed)
  if (!key) throw new Error('Invalid or revoked API key')

  if (!key.scope.includes(requiredScope)) {
    throw new Error(`API key does not have '${requiredScope}' scope`)
  }

  // Non-blocking audit update — do not await
  void updateApiKeyLastUsed(key.id)

  return key
}
