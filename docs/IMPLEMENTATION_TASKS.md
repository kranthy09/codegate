# CodeGate — Implementation Task Breakdown

**Status:** 1 task pending for 100% completion  
**Priority:** Medium (non-blocking, can deploy without)  
**Estimated Effort:** 1-2 hours

---

## Task 1: API Key Hard Delete Implementation

**Epic:** Complete Phase 2 (Auth & RBAC)  
**Priority:** Medium  
**Status:** Pending  
**Effort:** 1-2 hours

### Background

The DELETE endpoint for API keys currently uses soft-delete (sets `active=false`). The specification requires hard-delete (row removal). While functionally equivalent (inactive keys cannot be used), hard-delete is more compliant with REST semantics and cleaner for the database.

**Current Behavior:**
```typescript
// DELETE /api/admin/api-keys/[id]
await patchApiKey(id, { active: false })  // Soft delete
return NextResponse.json(null, { status: 204 })
```

**Expected Behavior:**
```typescript
// DELETE /api/admin/api-keys/[id]
await hardDeleteApiKey(id)  // Hard delete (row removal)
return NextResponse.json(null, { status: 204 })
```

---

## Subtask 1.1: Implement `hardDeleteApiKey()` Function

**File:** `src/lib/sheets/mutations.ts`  
**Type:** New function implementation

### Requirements

Implement a new function that:
1. Fetches all rows from `api_keys` sheet
2. Finds the row matching the `key_id`
3. Removes the row (and shifts remaining rows up)
4. Returns gracefully if key not found

### Implementation Options

**Option A: Rebuild Rows (Recommended)**
- Clear entire range
- Re-append non-deleted rows
- Safe, simple, easy to test

```typescript
export async function hardDeleteApiKey(key_id: string): Promise<void> {
  // 1. Get all api_keys
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGES.api_keys,
  })
  
  const rows = (res.data.values ?? []).slice(1)  // Skip header
  const rowIndex = rows.findIndex((r) => r[0] === key_id)
  if (rowIndex === -1) return  // Key not found, no-op
  
  // 2. Clear entire range (including header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: RANGES.api_keys,
  })
  
  // 3. Re-append header + remaining rows
  const header = [['id', 'name', 'hashed_key', 'scope', 'created_by', 'created_at', 'last_used_at', 'active']]
  const remaining = rows.filter((_, i) => i !== rowIndex)
  
  if (remaining.length > 0) {
    await append(RANGES.api_keys, remaining)
  }
}
```

**Option B: Delete Range**
- Use `deleteDimension` API
- More efficient but requires dimension ID
- Complex, fewer edge cases

(Recommend Option A for simplicity)

### Pseudo-code

```
function hardDeleteApiKey(key_id: string):
  1. Fetch api_keys sheet
  2. Find row index by key_id
  3. If not found, return (no-op)
  4. Clear entire range
  5. Re-append all rows except deleted row
  6. If error, throw with context
```

### Test Cases

1. **Delete existing key**
   - Create API key
   - Call hardDeleteApiKey(key_id)
   - Verify: row removed, remaining rows intact, count decreased by 1

2. **Delete non-existent key**
   - Call hardDeleteApiKey("non-existent-id")
   - Verify: No error, sheet unchanged

3. **Delete key with special characters in name**
   - Create key with special characters
   - Delete it
   - Verify: Proper deletion, no encoding issues

### Error Handling

Handle these scenarios:
- Sheet access error → throw with context
- Network error → let Vercel handle (5xx)
- Concurrent deletes → Race condition possible (acceptable for now)

---

## Subtask 1.2: Update DELETE Route

**File:** `src/app/api/admin/api-keys/[id]/route.ts`  
**Type:** Route handler update

### Changes Required

1. Import new function
2. Replace soft-delete with hard-delete
3. Remove TODO comment
4. Update comments for clarity

### Current Code
```typescript
export async function DELETE(...) {
  // ... auth check ...
  
  // TODO: implement hardDeleteApiKey for true hard delete
  await patchApiKey(id, { active: false })  // Soft delete
  return NextResponse.json(null, { status: 204 })
}
```

### New Code
```typescript
import { hardDeleteApiKey } from '@/lib/sheets/mutations'

export async function DELETE(...) {
  const user = await getServerUser()
  requireRole(user, ['admin'])
  
  const { id } = await params
  
  // Hard delete the API key row entirely
  await hardDeleteApiKey(id)
  
  return NextResponse.json(null, { status: 204 })
}
```

### Verification

1. DELETE request returns 204
2. Response body is empty (null becomes empty response)
3. No error if key doesn't exist (idempotent)
4. Row is fully removed (check Sheets)

---

## Subtask 1.3: Add Unit Tests

**File:** `src/__tests__/lib/sheets/mutations.test.ts` (new)  
**Type:** Test implementation

### Test Structure

```typescript
describe('mutations.hardDeleteApiKey', () => {
  test('should hard delete an API key', async () => {
    // Create test key
    const { key } = await createApiKey({ name: 'test' })
    
    // Hard delete it
    await hardDeleteApiKey(key.id)
    
    // Verify it's gone
    const allKeys = await listApiKeys()
    expect(allKeys.find((k) => k.id === key.id)).toBeUndefined()
  })
  
  test('should handle non-existent key gracefully', async () => {
    // Should not throw
    await hardDeleteApiKey('non-existent-id')
  })
  
  test('should maintain row order after deletion', async () => {
    // Create 3 keys
    const k1 = await createApiKey({ name: 'key1' })
    const k2 = await createApiKey({ name: 'key2' })
    const k3 = await createApiKey({ name: 'key3' })
    
    // Delete middle key
    await hardDeleteApiKey(k2.key.id)
    
    // Verify k1 and k3 are still there and in order
    const remaining = await listApiKeys()
    expect(remaining.map((k) => k.id)).toEqual([k1.key.id, k3.key.id])
  })
})
```

### Test Requirements

- Test deleting existing key
- Test deleting non-existent key
- Test order preservation
- Test boundary cases (delete first, delete last, delete only)

---

## Subtask 1.4: Update Documentation

**Files:** Various  
**Type:** Documentation update

### Changes Required

1. **API Routes Reference** (`docs/reference/api-routes.md`)
   - Update DELETE `/api/admin/api-keys/[id]` description
   - Clarify that it's a hard delete
   - Update behavior notes

2. **Implementation Checklist** (this file)
   - Mark task as complete
   - Note deployment date

3. **CHANGELOG** (if exists)
   - Record hard-delete implementation
   - Version: next release

### Example Update

**Before:**
```
DELETE /api/admin/api-keys/[id]
Revoke an API key (mark inactive)
Response: 204 No Content
```

**After:**
```
DELETE /api/admin/api-keys/[id]
Hard delete an API key (remove row entirely)
Response: 204 No Content
Note: Deletes the key row and rebuilds the sheet. Idempotent.
```

---

## Subtask 1.5: Integration Testing

**File:** Manual testing or integration test suite  
**Type:** Testing

### Test Scenario

**Prerequisites:**
- Deployed to staging or local dev
- Admin user credentials
- Existing API keys in Sheets

**Steps:**

1. **Create an API key**
   ```bash
   curl -X POST https://your-app/api/admin/api-keys \
     -H "Cookie: cg_session=<admin_token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Key for Deletion",
       "scope": ["candidates"]
     }'
   
   # Response: { "id": "api_key_123", "key": "pk_live_..." }
   ```

2. **Verify key exists**
   ```bash
   curl https://your-app/api/admin/api-keys \
     -H "Cookie: cg_session=<admin_token>"
   
   # Response: should include api_key_123
   ```

3. **Delete the key**
   ```bash
   curl -X DELETE https://your-app/api/admin/api-keys/api_key_123 \
     -H "Cookie: cg_session=<admin_token>"
   
   # Response: 204 No Content
   ```

4. **Verify deletion**
   ```bash
   curl https://your-app/api/admin/api-keys \
     -H "Cookie: cg_session=<admin_token>"
   
   # Response: should NOT include api_key_123
   ```

5. **Verify external API rejects deleted key**
   ```bash
   curl https://your-app/api/external/candidates \
     -H "Authorization: Bearer pk_live_..." \
     -H "Cookie: cg_session=<token>"
   
   # Response: 401 Unauthorized (key not found or inactive)
   ```

6. **Verify other keys still work**
   - Confirm remaining keys are still active
   - Verify no data corruption

---

## Implementation Checklist

### Phase 1: Implementation
- [ ] Implement `hardDeleteApiKey()` in `mutations.ts`
- [ ] Update DELETE route in `api/admin/api-keys/[id]/route.ts`
- [ ] Remove TODO comment
- [ ] Update code comments for clarity

### Phase 2: Testing
- [ ] Unit tests pass locally
- [ ] Integration test (manual curl)
- [ ] Verify sheet state before/after
- [ ] Verify idempotency (delete twice)
- [ ] Verify no side effects (other keys unaffected)

### Phase 3: Documentation
- [ ] Update API routes reference
- [ ] Update AUDIT_REPORT.md status
- [ ] Update this task file (mark complete)

### Phase 4: Deployment
- [ ] Code review (1-2 hours)
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Smoke test on staging
- [ ] Deploy to production
- [ ] Monitor logs (first hour)

### Phase 5: Verification
- [ ] Smoke test in production
- [ ] Verify no errors in logs
- [ ] Monitor API performance
- [ ] Update monitoring dashboard

---

## Time Breakdown

| Task | Effort | Notes |
|------|--------|-------|
| Implement `hardDeleteApiKey()` | 30 min | Straightforward implementation |
| Update DELETE route | 15 min | Simple change + remove comment |
| Unit tests | 30 min | 4-5 test cases |
| Integration testing | 30 min | Manual curl testing |
| Documentation | 15 min | Update 2-3 docs |
| Code review & deployment | 30 min | PR review + deploy |
| **Total** | **2.5 hours** | Conservative estimate |

---

## Success Criteria

✅ Task is complete when:

1. `hardDeleteApiKey()` function implemented and works
2. DELETE route uses hard-delete instead of soft-delete
3. Unit tests pass (100% coverage)
4. Integration test passes (curl test scenario)
5. No rows left in `api_keys` sheet after hard delete
6. No side effects (other keys unaffected)
7. Idempotent (delete twice, no error)
8. Documentation updated
9. Code review approved
10. Deployed to production

---

## Deployment Strategy

### Option A: Before Launch (Recommended)
- Complete this task before going to production
- Ensures spec compliance from day 1
- No surprises or technical debt

### Option B: Post-Launch
- Deploy as-is with soft-delete
- Complete this task within 1 week
- Document workaround: soft-delete is functionally equivalent

---

## Appendix: Code Reference

### Current `patchApiKey()` Implementation

```typescript
export async function patchApiKey(key_id: string, data: { name?: string; active?: boolean }): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGES.api_keys,
  })
  const rows = (res.data.values ?? []).slice(1)
  const rowIndex = rows.findIndex((r) => r[0] === key_id)
  if (rowIndex === -1) throw new Error(`API key ${key_id} not found`)
  const sheetRow = rowIndex + 2

  const updates = []
  if (data.name !== undefined) {
    updates.push(updateCell(`api_keys!B${sheetRow}`, data.name))
  }
  if (data.active !== undefined) {
    updates.push(updateCell(`api_keys!H${sheetRow}`, data.active ? 'TRUE' : 'FALSE'))
  }

  await Promise.all(updates)
}
```

### Helper Functions Available

```typescript
// Clear a range
sheets.spreadsheets.values.clear({ spreadsheetId, range })

// Append rows
async function append(range: string, values: unknown[][]): Promise<void>

// Update single cell
async function updateCell(range: string, value: unknown): Promise<void>

// Get current rows
sheets.spreadsheets.values.get({ spreadsheetId, range })
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Rows not properly rebuilt | Low | High | Unit + integration tests |
| Race condition on delete | Low | Medium | Document limitation |
| Data loss (other keys) | Very Low | Critical | Test before deploy |
| API key still functional after delete | Very Low | High | Verify in integration test |

---

## Related Issues & Dependencies

- **Depends on:** Phase 2 (Auth & RBAC) — Complete
- **Blocked by:** None
- **Related to:** API key lifecycle management
- **May enable:** Future work on key rotation, key versioning

---

## Sign-Off

**Prepared by:** CodeGate Audit Team  
**Date:** 2026-04-02  
**Status:** Ready for implementation  
**Priority:** Medium (deploy with or without, but recommended before launch)

