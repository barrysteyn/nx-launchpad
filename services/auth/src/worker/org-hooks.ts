import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Hook fired by better-auth's organization plugin when a user is added to an
// organization. We set `activeOrganizationId` on all that user's sessions so
// subsequent JWTs carry the org context without requiring a client-side
// `setActive()` call.
//
// The cast to Record<string, unknown> avoids a TS error when the schema
// doesn't include `activeOrganizationId` (single-tenant mode) — this code
// path only runs when isMultiTenant is true, so the column exists at runtime.
export function createAfterAddMember(
  db: PostgresJsDatabase<typeof schema>,
): (args: {
  user: { id: string };
  organization: { id: string };
}) => Promise<void> {
  return async ({ user, organization }) => {
    await db
      .update(schema.session)
      .set({ activeOrganizationId: organization.id } as Record<string, unknown>)
      .where(eq(schema.session.userId, user.id));
  };
}
