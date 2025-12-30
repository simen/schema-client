# @sanity/schema-client

TypeScript client library for working with Sanity server-side deployed schemas.

Since Sanity Studio v3.88.0, schemas can be deployed server-side, enabling deep integration between your content model and external applications. This library provides a clean API for fetching, parsing, and working with these deployed schemas.

## Why This Library?

**Building alternative editing interfaces?** You need the schema to know what fields exist, their types, validation rules, and options.

**Building content tooling?** You need programmatic access to understand your content model.

**The problem:** Sanity's documentation for server-side schemas is sparse, the API returns stringified JSON that needs parsing, and the type definitions are complex.

**This library solves it** with a simple API, full TypeScript types, and helper utilities.

## Installation

```bash
npm install @sanity/schema-client @sanity/client
```

## Quick Start

```typescript
import { createClient } from '@sanity/client'
import { SchemaClient, isDocumentType, getFieldByName, isFieldRequired } from '@sanity/schema-client'

const sanityClient = createClient({
  projectId: 'your-project-id',
  dataset: 'production',
  token: 'your-token',
  apiVersion: '2025-03-01',
  useCdn: false,
})

const schemaClient = new SchemaClient(sanityClient)

// Get all document types
const documentTypes = await schemaClient.getDocumentTypes()
console.log('Document types:', documentTypes.map(t => t.name))

// Inspect a specific type
const articleType = await schemaClient.getType('article')
if (articleType?.fields) {
  for (const field of articleType.fields) {
    const required = isFieldRequired(field) ? ' (required)' : ''
    console.log(`  ${field.name}: ${field.type}${required}`)
  }
}
```

---

## Understanding Sanity Server-Side Schemas

### What Are Deployed Schemas?

When you run `sanity schema deploy` in a Sanity Studio project, your schema definitions are uploaded to Sanity's servers. This makes them available via API, enabling:

- Alternative editing interfaces (not using Sanity Studio)
- Content validation tools
- Documentation generators
- Migration scripts
- AI/LLM integrations that need to understand your content model

### Schema Storage Model

Schemas are stored per project/dataset pair, identified by workspace name and optional tag:

- `_.schemas.default` - Default workspace schema
- `_.schemas.staging` - A workspace named "staging"
- `_.schemas.default.v1` - Tagged version for releases

### The Schema API

**Base URL:** `https://api.sanity.io/v2025-03-01`

```
GET  /projects/{projectId}/datasets/{dataset}/schemas           # List all
GET  /projects/{projectId}/datasets/{dataset}/schemas/{id}      # Get one
PUT  /projects/{projectId}/datasets/{dataset}/schemas           # Deploy
DELETE /projects/{projectId}/datasets/{dataset}/schemas         # Delete
```

**Important:** The `schema` field in responses is a **stringified JSON array**. You must `JSON.parse()` it to get the actual types. This library handles that for you.

---

## API Reference

### SchemaClient

#### Constructor

```typescript
import { createClient } from '@sanity/client'
import { SchemaClient } from '@sanity/schema-client'

const sanityClient = createClient({
  projectId: 'your-project-id',
  dataset: 'production',
  token: 'your-token',
  apiVersion: '2025-03-01',
  useCdn: false,
})

const schemaClient = new SchemaClient(sanityClient)
```

#### `list(): Promise<StoredWorkspaceSchema[]>`

List all deployed schemas for the project/dataset.

```typescript
const schemas = await schemaClient.list()
// [{ _id: '_.schemas.default', workspace: { name: 'default' }, ... }]
```

#### `get(options?): Promise<StoredWorkspaceSchema | null>`

Get a specific schema by workspace and optional tag. Returns `null` if not found.

```typescript
// Default workspace
const schema = await schemaClient.get()

// Specific workspace
const stagingSchema = await schemaClient.get({ workspace: 'staging' })

// Tagged version
const v1Schema = await schemaClient.get({ workspace: 'default', tag: 'v1' })
```

#### `getTypes(options?): Promise<ManifestSchemaType[]>`

Get all parsed schema types. This is the most common method you'll use.

```typescript
const types = await schemaClient.getTypes()
// Returns parsed array of type definitions
```

#### `getDocumentTypes(options?): Promise<ManifestSchemaType[]>`

Get only document types (top-level content types).

```typescript
const docTypes = await schemaClient.getDocumentTypes()
// ['article', 'author', 'category', ...]
```

#### `getObjectTypes(options?): Promise<ManifestSchemaType[]>`

Get only object types (reusable nested structures).

```typescript
const objectTypes = await schemaClient.getObjectTypes()
// ['seo', 'socialLinks', 'address', ...]
```

#### `getType(typeName, options?): Promise<ManifestSchemaType | null>`

Get a specific type by name.

```typescript
const articleType = await schemaClient.getType('article')
if (articleType) {
  console.log(articleType.fields)
}
```

#### `deploy(schemas): Promise<StoredWorkspaceSchema[]>`

Deploy schemas to the server. Requires `deployStudio` permission.

```typescript
await schemaClient.deploy([{
  workspace: { name: 'default', title: 'My Studio' },
  schema: mySchemaTypes,
}])
```

#### `delete(schemaIds): Promise<void>`

Delete schemas by ID.

```typescript
await schemaClient.delete(['_.schemas.old-workspace'])
```

---

## Schema Type Structure

Every type in the schema follows this structure:

```typescript
interface ManifestSchemaType {
  // Core properties
  type: string              // 'document', 'object', 'string', 'array', etc.
  name: string              // Unique identifier
  title?: string            // Display name
  description?: string      // Help text

  // Document/object types have fields
  fields?: ManifestField[]
  fieldsets?: ManifestFieldset[]

  // Array types have members
  of?: ManifestArrayMember[]

  // Reference types have targets
  to?: ManifestReferenceMember[]

  // Validation rules
  validation?: ManifestValidationGroup[]

  // Type-specific options
  options?: Record<string, any>

  // State
  hidden?: boolean | 'conditional'
  readOnly?: boolean | 'conditional'
  deprecated?: { reason: string }
}
```

### Common Field Types

| Type | Description | Key Properties |
|------|-------------|----------------|
| `document` | Top-level content type | `fields`, `preview` |
| `object` | Nested object | `fields` |
| `string` | Text input | `options.list` for dropdowns |
| `text` | Multi-line text | `rows` |
| `number` | Numeric input | `options.list` for dropdowns |
| `boolean` | Checkbox | `options.layout` |
| `date` / `datetime` | Date pickers | - |
| `array` | List of items | `of` (member types) |
| `reference` | Link to document | `to` (target types) |
| `image` | Image asset | `options.hotspot`, nested `fields` |
| `file` | File asset | nested `fields` |
| `slug` | URL slug | `options.source` |
| `block` | Portable text | `marks`, `styles`, `lists` |

### Validation Rules

Validation is stored as groups of rules:

```typescript
{
  validation: [
    {
      rules: [
        { flag: 'presence', constraint: 'required' },
        { flag: 'max', constraint: 100 }
      ],
      level: 'error',
      message: 'Title is required and must be under 100 characters'
    }
  ]
}
```

Common flags: `presence`, `min`, `max`, `length`, `regex`, `uri`, `email`, `unique`, `custom`

---

## Helper Functions

### Type Guards

```typescript
import {
  isDocumentType,
  isObjectType,
  isArrayType,
  isReferenceType,
  isBlockType,
  isImageType,
  isFileType,
  isPrimitiveType,
} from '@sanity/schema-client'

if (isDocumentType(type)) {
  // type.type === 'document'
}

if (isReferenceType(field)) {
  // field.to contains target types
}
```

### Field Helpers

```typescript
import {
  getFieldByName,
  getRequiredFields,
  getFieldsByFieldset,
  getFieldsWithoutFieldset,
  getVisibleFields,
  getEditableFields,
} from '@sanity/schema-client'

// Find a specific field
const titleField = getFieldByName(articleType, 'title')

// Get required fields for form validation
const required = getRequiredFields(articleType)

// Group fields by fieldset
const seoFields = getFieldsByFieldset(articleType, 'seo')

// Get fields that should be shown in UI
const visible = getVisibleFields(articleType)
```

### Validation Helpers

```typescript
import {
  isFieldRequired,
  hasValidationRule,
  getValidationRules,
  getValidationRulesByFlag,
  getMinConstraint,
  getMaxConstraint,
} from '@sanity/schema-client'

// Check if field is required
if (isFieldRequired(titleField)) {
  // Show required indicator
}

// Get constraints for form validation
const min = getMinConstraint(descriptionField) // e.g., 10
const max = getMaxConstraint(descriptionField) // e.g., 500

// Check for specific validation
if (hasValidationRule(emailField, 'email')) {
  // Use email input type
}
```

### Reference & Array Helpers

```typescript
import {
  getReferenceTargetTypes,
  canReferenceType,
  getArrayMemberTypes,
  canContainType,
} from '@sanity/schema-client'

// What can this reference field link to?
const targets = getReferenceTargetTypes(authorField)
// ['author', 'person']

// Can this field reference a 'person'?
if (canReferenceType(authorField, 'person')) {
  // Show person picker
}

// What types can this array contain?
const memberTypes = getArrayMemberTypes(contentField)
// ['block', 'image', 'code']
```

### Options Helpers

```typescript
import {
  getListOptions,
  hasListOptions,
  getSlugSource,
  hasHotspot,
} from '@sanity/schema-client'

// Get dropdown options
if (hasListOptions(statusField)) {
  const options = getListOptions(statusField)
  // [{ title: 'Draft', value: 'draft' }, { title: 'Published', value: 'published' }]
}

// Get slug source field
const source = getSlugSource(slugField) // 'title'

// Check if image has hotspot
if (hasHotspot(imageField)) {
  // Show hotspot editor
}
```

### Schema Traversal

```typescript
import {
  walkSchemaTypes,
  findTypeByName,
  findTypes,
  getReferencedTypeNames,
} from '@sanity/schema-client'

// Walk all types and fields
walkSchemaTypes(types, (type, path) => {
  console.log(path.join('.'), type.type)
})
// article string
// article.title string
// article.author reference
// ...

// Find deprecated types
const deprecated = findTypes(types, t => !!t.deprecated)

// Get all types referenced by a document type
const referenced = getReferencedTypeNames(articleType)
// ['author', 'category', 'image']
```

---

## Real-World Examples

### Build a Form from Schema

```typescript
async function buildForm(typeName: string) {
  const type = await schemaClient.getType(typeName)
  if (!type?.fields) return null

  return {
    title: type.title || type.name,
    fields: getVisibleFields(type).map(field => ({
      name: field.name,
      label: field.title || field.name,
      type: mapSanityTypeToInput(field.type),
      required: isFieldRequired(field),
      options: getListOptions(field),
      min: getMinConstraint(field),
      max: getMaxConstraint(field),
      helpText: field.description,
    })),
  }
}

function mapSanityTypeToInput(sanityType: string): string {
  const map: Record<string, string> = {
    string: 'text',
    text: 'textarea',
    number: 'number',
    boolean: 'checkbox',
    date: 'date',
    datetime: 'datetime-local',
    // ... etc
  }
  return map[sanityType] || 'text'
}
```

### Generate TypeScript Types from Schema

```typescript
async function generateTypes() {
  const types = await schemaClient.getDocumentTypes()

  for (const type of types) {
    console.log(`interface ${pascalCase(type.name)} {`)
    console.log(`  _type: '${type.name}'`)
    console.log(`  _id: string`)

    for (const field of type.fields || []) {
      const tsType = mapToTsType(field)
      const optional = isFieldRequired(field) ? '' : '?'
      console.log(`  ${field.name}${optional}: ${tsType}`)
    }

    console.log(`}`)
  }
}
```

### Validate Content Against Schema

```typescript
async function validateDocument(doc: any) {
  const type = await schemaClient.getType(doc._type)
  if (!type) return [{ error: `Unknown type: ${doc._type}` }]

  const errors: string[] = []

  for (const field of getRequiredFields(type)) {
    if (doc[field.name] === undefined || doc[field.name] === null) {
      errors.push(`Missing required field: ${field.name}`)
    }
  }

  for (const field of type.fields || []) {
    const value = doc[field.name]
    if (value === undefined) continue

    const max = getMaxConstraint(field)
    if (max && typeof value === 'string' && value.length > max) {
      errors.push(`${field.name} exceeds max length of ${max}`)
    }
  }

  return errors
}
```

---

## Authentication

The Schema API requires authentication. Here's what you need to know:

### Token Types

| Token Type | Read Schemas | Deploy Schemas |
|------------|--------------|----------------|
| Session token (from `sanity debug --secrets`) | ✅ | ✅ (if admin) |
| Robot token - Developer role | ✅ | ❌ |
| Robot token - Administrator role | ✅ | ✅ |
| Robot token - Deploy Studio role | ⚠️ | ✅ |

**Note:** The Schema API may only accept session tokens for some operations. If you get "Invalid authorization header" with a robot token, try using a session token.

### Getting a Token

```bash
# Get your session token (temporary, for development)
npx sanity debug --secrets

# Create a robot token (permanent, for production)
# Go to sanity.io/manage → Project → API → Tokens
```

### Using Environment Variables

```typescript
const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2025-03-01',
  useCdn: false,
})
```

---

## CLI Commands Reference

If you have a Sanity Studio project, these CLI commands work with schemas:

```bash
# Deploy schema to server
sanity schema deploy

# List deployed schemas
sanity schema list

# List with full details
sanity schema list --json

# Delete schemas
sanity schema delete --ids _.schemas.default

# Extract schema manifest locally
sanity manifest extract
```

---

## TypeScript Types

All types are exported for your use:

```typescript
import type {
  // Schema structures
  ManifestSchemaType,
  ManifestField,
  ManifestFieldset,
  ManifestArrayMember,
  ManifestReferenceMember,

  // Validation
  ManifestValidationGroup,
  ManifestValidationRule,

  // API responses
  StoredWorkspaceSchema,
  ParsedWorkspaceSchema,

  // Client config
  SchemaClientConfig,
  GetSchemaOptions,
  DeploySchemaInput,
} from '@sanity/schema-client'
```

---

## Requirements

- `@sanity/client` >= 6.0.0
- Node.js 18+ or modern browser
- A Sanity project with deployed schemas (run `sanity schema deploy` in your Studio)

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT

---

## Resources

- [Sanity Schema Deployment Docs](https://www.sanity.io/docs/apis-and-sdks/schema-deployment)
- [Sanity Client Documentation](https://www.sanity.io/docs/js-client)
- [Manifest Types Source (Sanity repo)](https://github.com/sanity-io/sanity/blob/main/packages/sanity/src/_internal/manifest/manifestTypes.ts)
