# Value Help Guide

F4-style value help for form fields — lets users pick from a curated list instead of free-typing.

---

## Quick Start

1. **Studio → Request Type → "Value Help" tab** → Create a definition
2. **Studio → "Data Schema" tab** → Click a field → Enable Value Help in properties
3. **Open the form** → The field now shows a browse button / dropdown with your list

---

## 1. Create a Value Help Definition

Go to **Studio → select a Request Type → "Value Help" tab → New Definition**.

### Required Fields

| Field | What To Enter | Example |
|---|---|---|
| **Value Help ID** | A unique name for this list | `departmentCodes` |
| **Source Type** | Where the data comes from | `static` |

### Static Entries

The main data for your value help. Paste a JSON array:

```json
[
  { "key": "HR", "text": "Human Resources" },
  { "key": "FIN", "text": "Finance" },
  { "key": "IT", "text": "Information Technology" },
  { "key": "OPS", "text": "Operations" }
]
```

**Important Fields:**
- `key` — The value that gets **stored/saved** when the user picks this entry
- `text` — The **display label** the user sees in the list
- You can add any extra columns (e.g. `"manager": "John"`) for return mapping

> **Why is only "2000" saved?** Because `key` is what gets stored. The user sees
> "2000 - Acme US" in the list, but the form stores `2000`. This is intentional —
> it works like a database foreign key. If you want to store the text instead,
> set `"returnField": "text"` in Search Config.

---

## 2. Search Config (Controls the F4 Dialog)

**Without this, the F4 dialog shows results count but an empty table.**

Paste into the **Search Config** field:

### Example A: Simple 2-Column List

```json
{
  "title": "Select Department",
  "searchFields": [
    { "column": "key", "label": "Code" },
    { "column": "text", "label": "Name" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "120px" },
    { "column": "text", "label": "Department Name" }
  ],
  "returnField": "key"
}
```

**Result:** Dialog shows a 2-column table (Code | Department Name) with search filters.  
**Stored value:** The `key` column (e.g. `HR`).

### Example B: Multi-Column with Extra Data

For richer entries like:
```json
[
  { "key": "1000", "text": "Acme DE", "country": "DE", "city": "Munich" },
  { "key": "2000", "text": "Acme US", "country": "US", "city": "New York" },
  { "key": "3000", "text": "Acme JP", "country": "JP", "city": "Tokyo" }
]
```

```json
{
  "title": "Select Company",
  "searchFields": [
    { "column": "key", "label": "Code" },
    { "column": "text", "label": "Name" },
    { "column": "country", "label": "Country" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "80px" },
    { "column": "text", "label": "Company Name" },
    { "column": "country", "label": "Country", "width": "80px" },
    { "column": "city", "label": "City", "width": "120px" }
  ],
  "returnField": "key"
}
```

**Result:** Dialog shows 4-column table with 3 search filters. User can search by code, name, or country.

### Example C: Store Text Instead of Key

If you want the form to save `"Acme US"` instead of `"2000"`:

```json
{
  "title": "Select Company",
  "searchFields": [
    { "column": "text", "label": "Name" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "80px" },
    { "column": "text", "label": "Company Name" }
  ],
  "returnField": "text"
}
```

**Stored value:** The `text` column (e.g. `Acme US`).

### Search Config Reference

| Property | Type | Purpose |
|---|---|---|
| `title` | string | Dialog header text |
| `searchFields` | array | Filter inputs shown at the top of the dialog |
| `searchFields[].column` | string | Which data column this filter searches |
| `searchFields[].label` | string | Label shown above the filter input |
| `resultColumns` | array | Table columns in the results area |
| `resultColumns[].column` | string | Which data column to display |
| `resultColumns[].label` | string | Column header text |
| `resultColumns[].width` | string | Fixed column width (e.g. `"100px"`) |
| `returnField` | string | Which column's value is saved when user clicks "Select" |

---

## 3. Return Mapping (Auto-Fill Other Fields)

When a user selects a value, you often want to **fill other fields automatically**. For example, selecting a company code should also fill in the company name and country.

### Setup

**Step 1:** Add extra columns to your static entries:

```json
[
  { "key": "1000", "text": "Acme DE", "country": "DE", "manager": "Hans Mueller" },
  { "key": "2000", "text": "Acme US", "country": "US", "manager": "Jane Smith" },
  { "key": "3000", "text": "Acme JP", "country": "JP", "manager": "Tanaka Yuki" }
]
```

**Step 2:** Add Return Mapping JSON to define which extra columns map to which form fields:

```json
[
  { "sourceColumn": "text", "targetField": "companyName" },
  { "sourceColumn": "country", "targetField": "countryCode" },
  { "sourceColumn": "manager", "targetField": "contactPerson" }
]
```

### What Happens

1. User selects `1000 - Acme DE` from the dropdown
2. The widget reads return mapping
3. It automatically fills:
   - `companyName` → `"Acme DE"` (from `text` column)
   - `countryCode` → `"DE"` (from `country` column)
   - `contactPerson` → `"Hans Mueller"` (from `manager` column)

### Return Mapping Reference

| Property | Purpose |
|---|---|
| `sourceColumn` | Column name in the value help entry (must exist in your static entries JSON) |
| `targetField` | Field name in the form to auto-fill (must match the field's `id` in the schema) |

> **Tip:** The `targetField` must exactly match the field ID in your Data Schema. Open the field properties to see its ID.

---

## 4. Cascading Dependencies (Filtered Child Lists)

Make a child value help filter based on a parent field's selection.

### Example: Company Code → Plant

**Parent:** `companyCodes` (no dependencies)
```json
[
  { "key": "1000", "text": "Acme DE" },
  { "key": "2000", "text": "Acme US" }
]
```

**Child:** `plantCodes` — set `dependsOn` field to `companyCode` (the parent field name)
```json
[
  { "key": "P100", "text": "Plant Munich", "companyCode": "1000" },
  { "key": "P200", "text": "Plant Berlin", "companyCode": "1000" },
  { "key": "P300", "text": "Plant New York", "companyCode": "2000" },
  { "key": "P400", "text": "Plant Chicago", "companyCode": "2000" }
]
```

### What Happens

1. User selects Company `1000` (Acme DE)
2. User opens the Plant dropdown
3. Only `P100 - Plant Munich` and `P200 - Plant Berlin` appear (filtered by `companyCode = "1000"`)
4. If user switches to Company `2000`, plants update to show only US plants

### Setup Checklist

- [ ] Parent value help created (no special config needed)
- [ ] Child value help: set **Depends On** = parent field name (e.g. `companyCode`)
- [ ] Child entries include a column matching the parent's key values
- [ ] Both fields in the form are bound to their respective value helps

### Multi-Level Cascading

You can chain multiple levels:

```
Country → Company Code → Plant → Cost Center
```

| Value Help | Depends On | Entries need column |
|---|---|---|
| `countryCodes` | *(none)* | — |
| `companyCodes` | `country` | `"country": "DE"` |
| `plantCodes` | `companyCode` | `"companyCode": "1000"` |
| `costCenters` | `plant` | `"plant": "P100"` |

---

## 5. Display Format

Controls how entries appear in the dropdown/combobox:

| Value | Display | When To Use |
|---|---|---|
| `keyAndText` (default) | `1000 - Acme DE` | Most cases — shows both code and description |
| `keyOnly` | `1000` | When codes are self-explanatory |
| `textOnly` | `Acme DE` | When users don't care about the code |

Set this in the **Display Format** field of the value help definition.

---

## 6. Bind Fields to Value Help

### For Select / Dropdown Fields

1. **Data Schema** tab → click the select field
2. **Field Properties** → Data Source → switch to **"Value Help"**
3. Pick your definition

**Runtime widget:** `ValueHelpComboBox` — typeahead dropdown with auto-suggestions.

### For Text / Email / Currency Fields

1. Click the field
2. **Field Properties** → **Value Help** → toggle **"Enable F4 Browse"**
3. Pick your definition

**Runtime widget:** `ValueHelpSearchInput` — input with a browse icon (📋) that opens the F4 dialog.

### Supported Field Types

| Field Type | Value Help Available | Widget |
|---|---|---|
| `text` | ✅ | F4 Browse Dialog |
| `email` | ✅ | F4 Browse Dialog |
| `currency` | ✅ | F4 Browse Dialog |
| `select` / `dropdown` | ✅ | ComboBox Dropdown |
| `number` | ❌ | — |
| `date` | ❌ | — |
| `checkbox` | ❌ | — |
| `radio` | ❌ | — |
| `textarea` | ❌ | — |
| `image` / `attachment` | ❌ | — |
| `slider` / `tag` | ❌ | — |

---

## 7. Full Working Examples

### Example 1: Simple Department Dropdown

**Value Help Definition:**

| Setting | Value |
|---|---|
| Value Help ID | `departmentCodes` |
| Source Type | `static` |
| Display Format | `keyAndText` |

**Static Entries:**
```json
[
  { "key": "HR", "text": "Human Resources" },
  { "key": "FIN", "text": "Finance" },
  { "key": "IT", "text": "Information Technology" },
  { "key": "LEGAL", "text": "Legal" },
  { "key": "MKT", "text": "Marketing" }
]
```

**Search Config:**
```json
{
  "title": "Select Department",
  "searchFields": [
    { "column": "key", "label": "Code" },
    { "column": "text", "label": "Department" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "100px" },
    { "column": "text", "label": "Department Name" }
  ],
  "returnField": "key"
}
```

**Return Mapping:** *(none needed for simple lists)*

**Stored value when user selects "Finance":** `FIN`

---

### Example 2: Supplier List with Auto-Fill

**Value Help Definition:**

| Setting | Value |
|---|---|
| Value Help ID | `suppliers` |
| Source Type | `static` |
| Display Format | `keyAndText` |

**Static Entries:**
```json
[
  { "key": "SUP001", "text": "Acme Corp", "taxId": "DE123456789", "country": "DE", "email": "acme@example.com" },
  { "key": "SUP002", "text": "Global Tech", "taxId": "US987654321", "country": "US", "email": "info@globaltech.com" },
  { "key": "SUP003", "text": "Tokyo Parts", "taxId": "JP111222333", "country": "JP", "email": "sales@tokyoparts.jp" }
]
```

**Search Config:**
```json
{
  "title": "Select Supplier",
  "searchFields": [
    { "column": "key", "label": "Supplier Code" },
    { "column": "text", "label": "Name" },
    { "column": "country", "label": "Country" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "100px" },
    { "column": "text", "label": "Supplier Name" },
    { "column": "country", "label": "Country", "width": "80px" },
    { "column": "email", "label": "Email" }
  ],
  "returnField": "key"
}
```

**Return Mapping:**
```json
[
  { "sourceColumn": "text", "targetField": "supplierName" },
  { "sourceColumn": "taxId", "targetField": "taxNumber" },
  { "sourceColumn": "country", "targetField": "supplierCountry" },
  { "sourceColumn": "email", "targetField": "contactEmail" }
]
```

**What happens when user selects SUP001:**
- `supplier` field → `SUP001` (the key)
- `supplierName` field → `Acme Corp` (auto-filled)
- `taxNumber` field → `DE123456789` (auto-filled)
- `supplierCountry` field → `DE` (auto-filled)
- `contactEmail` field → `acme@example.com` (auto-filled)

---

### Example 3: Cascading Country → City

**Parent — `countryCodes`:**

Static Entries:
```json
[
  { "key": "DE", "text": "Germany" },
  { "key": "US", "text": "United States" },
  { "key": "JP", "text": "Japan" }
]
```

Search Config:
```json
{
  "title": "Select Country",
  "searchFields": [{ "column": "text", "label": "Country" }],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "80px" },
    { "column": "text", "label": "Country" }
  ],
  "returnField": "key"
}
```

**Child — `cityCodes`** (set **Depends On** = `country`):

Static Entries:
```json
[
  { "key": "MUC", "text": "Munich", "country": "DE" },
  { "key": "BER", "text": "Berlin", "country": "DE" },
  { "key": "NYC", "text": "New York", "country": "US" },
  { "key": "LA", "text": "Los Angeles", "country": "US" },
  { "key": "TKY", "text": "Tokyo", "country": "JP" },
  { "key": "OSK", "text": "Osaka", "country": "JP" }
]
```

Search Config:
```json
{
  "title": "Select City",
  "searchFields": [{ "column": "text", "label": "City" }],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "80px" },
    { "column": "text", "label": "City" }
  ],
  "returnField": "key"
}
```

**Result:** When user selects `DE` (Germany), the city list shows only Munich and Berlin.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| F4 dialog shows "X results" but **empty table** | Missing `searchConfig` | Add `searchConfig` JSON with `resultColumns` |
| Only the key is saved (e.g. `2000`) | `returnField` is set to `"key"` | This is intentional. Change to `"text"` if you want text stored |
| "Failed to load value help definitions" | Wrong service URL | Service URLs should be `/admin` (Studio) and `/browse` (runtime) |
| No "Value Help" option in field properties | Unsupported field type | Only: text, email, currency, select, dropdown |
| Dropdown shows no options | No definitions created | Create definitions in the Value Help tab first |
| Auto-fill doesn't work | Wrong `targetField` | `targetField` must exactly match the field ID in Data Schema |
| Cascading filter doesn't work | Missing column in child entries | Child entries must have a column matching the parent's key values |
