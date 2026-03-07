# Value Help Guide

F4-style value help for form fields — lets users pick from a curated list instead of free-typing.

---

## 1. Create a Value Help Definition

Open **Studio → select a Request Type → "Value Help" tab → New Definition**.

### Required Fields

| Field | Example | Description |
|---|---|---|
| **Value Help ID** | `departmentCodes` | Unique identifier for this list |
| **Source Type** | `static` | `static` / `reference` / `external` |

### Static Entries (JSON)

Paste a JSON array into the **Static Entries** field:

```json
[
  { "key": "HR", "text": "Human Resources" },
  { "key": "FIN", "text": "Finance" },
  { "key": "IT", "text": "Information Technology" },
  { "key": "OPS", "text": "Operations" }
]
```

> Each entry **must** have `key` (the stored value) and `text` (displayed label).
> You can add extra columns (e.g. `"country": "DE"`) for return mapping.

### ⚠️ Search Config (Required for F4 Dialog)

Without this, the F4 dialog will show "X results" but **no visible table**. Paste this into the **Search Config** field:

```json
{
  "title": "Select Department",
  "searchFields": [
    { "column": "key", "label": "Code" },
    { "column": "text", "label": "Name" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "120px" },
    { "column": "text", "label": "Name" }
  ],
  "returnField": "key"
}
```

| Property | Purpose |
|---|---|
| `title` | Dialog header text |
| `searchFields` | Filter inputs at the top of the dialog |
| `resultColumns` | Table columns shown in results |
| `returnField` | Which column's value is returned when user clicks "Select" |

### Return Mapping (Optional — Auto-fill Other Fields)

Paste into **Return Mapping** to auto-fill related fields on selection:

```json
[
  { "sourceColumn": "text", "targetField": "departmentName" },
  { "sourceColumn": "country", "targetField": "countryCode" }
]
```

When the user selects `HR`, the form also fills `departmentName = "Human Resources"`.

### Display Format

| Format | Shows |
|---|---|
| `keyAndText` | `HR - Human Resources` |
| `keyOnly` | `HR` |
| `textOnly` | `Human Resources` |

---

## 2. Bind a Field to Value Help

### For Select / Dropdown Fields

1. **Data Schema** tab → click the select field
2. **Field Properties** → Data Source toggle → switch to **"Value Help"**
3. Pick your definition (e.g. `departmentCodes`)

### For Text / Email / Currency Fields

1. Click the field
2. **Field Properties** → **Value Help** section → toggle **"Enable F4 Browse"**
3. Pick your definition

---

## 3. How It Renders at Runtime

| Field Type | Widget | User Experience |
|---|---|---|
| `select` / `dropdown` | ValueHelpComboBox | Typeahead dropdown with auto-suggestions |
| `text` / `email` / `currency` | ValueHelpSearchInput | Input with browse icon (📋) → opens F4 dialog |

---

## 4. Cascading Dependencies (Optional)

Make a child dropdown filter based on a parent field's value.

**Example**: Plants filtered by Company Code.

On the **child** value help definition set:
- `dependsOn`: `companyCode` (the parent field name)

Static entries for the child should include a matching column:

```json
[
  { "key": "P100", "text": "Plant Munich", "companyCode": "1000" },
  { "key": "P200", "text": "Plant Berlin", "companyCode": "1000" },
  { "key": "P300", "text": "Plant New York", "companyCode": "2000" }
]
```

When user selects company `1000`, the plant dropdown only shows Munich and Berlin.

---

## 5. Complete Example

### Value Help Definition

| Field | Value |
|---|---|
| Value Help ID | `companyCodes` |
| Source Type | `static` |
| Display Format | `keyAndText` |
| Sort By | `text` |

**Static Entries:**
```json
[
  { "key": "1000", "text": "Acme DE", "country": "DE" },
  { "key": "2000", "text": "Acme US", "country": "US" },
  { "key": "3000", "text": "Acme JP", "country": "JP" }
]
```

**Search Config:**
```json
{
  "title": "Select Company Code",
  "searchFields": [
    { "column": "key", "label": "Code" },
    { "column": "text", "label": "Company" }
  ],
  "resultColumns": [
    { "column": "key", "label": "Code", "width": "100px" },
    { "column": "text", "label": "Company Name" },
    { "column": "country", "label": "Country", "width": "80px" }
  ],
  "returnField": "key"
}
```

**Return Mapping:**
```json
[
  { "sourceColumn": "text", "targetField": "companyName" },
  { "sourceColumn": "country", "targetField": "countryCode" }
]
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| F4 dialog shows "X results" but **empty table** | Missing `searchConfig` | Add `searchConfig` JSON with `resultColumns` |
| "Failed to load value help definitions" | Wrong service URL | Ensure Studio uses `/admin`, runtime uses `/browse` |
| No value help option in field properties | Wrong field type | Only available for: text, email, currency, select, dropdown |
| Dropdown shows no options | No definitions created | Go to Value Help tab first and create a definition |
