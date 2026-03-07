/**
 * Value Help Entity Definition
 *
 * Configurable value help lists for dropdown, combobox, and search help widgets.
 * Supports 3 source types:
 *   - 'static'    : Inline JSON entries (staticEntries field)
 *   - 'reference' : Dynamic DB table lookup (referenceTable/keyColumn/textColumn)
 *   - 'external'  : Reserved for future S/4HANA OData integration
 */
namespace sap.cre;

using { managed, cuid } from '@sap/cds/common';

@assert.unique: { valueHelpPerObject: [valueHelpID, objectType] }
entity ValueHelpList : cuid, managed {
    valueHelpID    : String(100) @mandatory;
    objectType     : String(50)  @mandatory;
    description    : String(255);

    // Source configuration
    sourceType     : String(20) default 'static';    // 'static' | 'reference' | 'external'

    // Static entries: JSON array [{key, text, ...extra columns}]
    staticEntries  : LargeString;

    // Reference table mapping (sourceType = 'reference')
    referenceTable : String(100);   // CDS entity name, e.g. "ASNReferenceData"
    keyColumn      : String(100);   // Column used as value key
    textColumn     : String(100);   // Column used as display text
    filterColumn   : String(100);   // Column to scope results by objectType (optional)

    // Display formatting
    displayFormat  : String(20) default 'keyAndText';  // 'keyOnly' | 'textOnly' | 'keyAndText'
    sortBy         : String(20) default 'text';        // 'key' | 'text'

    // Cascading dependency (optional)
    dependsOn      : String(100);   // Field name of parent value help

    // Return mapping — universal, works for ALL widget types
    // JSON: [{ "sourceColumn": "col", "targetField": "field" }]
    returnMapping  : LargeString;

    // Search Help dialog config (searchHelp widget only)
    // JSON: { title, searchFields, resultColumns, returnField }
    searchConfig   : LargeString;

    isActive       : Boolean default true;
}
