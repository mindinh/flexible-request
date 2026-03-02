namespace sap.cre;

using {
    cuid
} from '@sap/cds/common';

using { sap.cre.managedWithUser } from './common';
using { sap.cre.RequestTypes } from '../schema';

// ----------------------------------------------------------------------------
// System Settings Entities
// ----------------------------------------------------------------------------

/**
 * Number Range Configuration per Request Type.
 * Defines the prefix, start number, current counter, and digit padding
 * for generating human-readable request IDs (e.g. LVE-001023).
 */
entity NumberRanges : cuid, managedWithUser {
    requestType   : Association to RequestTypes;
    startNumber   : Integer default 1000;    // The first number to start from
    currentNumber : Integer default 1000;    // The NEXT number to assign (auto-incremented)
    digits        : Integer default 6;       // Total digits including padding (e.g., 6 → 001023)
    isActive      : Boolean default true;    // Enable/disable this range without deleting
}
