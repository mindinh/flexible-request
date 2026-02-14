/**
 * Database Query Utilities
 * 
 * Centralized re-export of CAP CQL query builders.
 * Import from this module instead of using globals.
 * 
 * @example
 * import { SELECT, INSERT, UPDATE, DELETE } from '../lib/db';
 * const rows = await SELECT.from(Users).where({ isActive: true });
 * await UPDATE(Users, id).with({ name: 'New Name' });
 */

import cds from '@sap/cds';

// Re-export cds for ApplicationService types, logging, etc.
export { cds };

// Re-export CQL functions with proper typing
export const { SELECT, INSERT, UPSERT } = cds.ql;

/**
 * UPDATE with shorthand support: UPDATE(Entity, ID).with({})
 * 
 * The native cds.ql.UPDATE types don't include the (Entity, ID) shorthand,
 * so we cast to `any` to allow this CAP runtime feature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const UPDATE = cds.ql.UPDATE as any;

/**
 * DELETE with shorthand support: DELETE(Entity, ID) or DELETE.from(Entity)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE = cds.ql.DELETE as any;

