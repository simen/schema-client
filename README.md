# @sanity/schema-client

TypeScript client library for working with Sanity server-side deployed schemas.

## Installation

```bash
npm install @sanity/schema-client @sanity/client
```

## Usage

```typescript
import { createClient } from '@sanity/client'
import { SchemaClient } from '@sanity/schema-client'

// Create a Sanity client with your credentials
const sanityClient = createClient({
  projectId: 'your-project-id',
  dataset: 'production',
  token: 'your-token', // Required for schema API
  apiVersion: '2025-03-01',
  useCdn: false,
})

// Create the schema client
const schemaClient = new SchemaClient(sanityClient)

// List all deployed schemas
const schemas = await schemaClient.list()

// Get all types from default workspace
const types = await schemaClient.getTypes()

// Get only document types
const documentTypes = await schemaClient.getDocumentTypes()

// Get a specific type by name
const articleType = await schemaClient.getType('article')
```

## API Reference

### SchemaClient

#### `new SchemaClient(sanityClient)`

Create a new schema client from an existing `@sanity/client` instance.

#### `list(): Promise<StoredWorkspaceSchema[]>`

List all deployed schemas for the project/dataset.

#### `get(options?): Promise<StoredWorkspaceSchema | null>`

Get a specific schema by workspace name and optional tag.

```typescript
// Default workspace
const schema = await schemaClient.get()

// Specific workspace
const stagingSchema = await schemaClient.get({ workspace: 'staging' })

// Tagged version
const v1Schema = await schemaClient.get({ workspace: 'default', tag: 'v1' })
```

#### `getTypes(options?): Promise<ManifestSchemaType[]>`

Get all parsed schema types from a workspace.

#### `getDocumentTypes(options?): Promise<ManifestSchemaType[]>`

Get only document types.

#### `getObjectTypes(options?): Promise<ManifestSchemaType[]>`

Get only object types.

#### `getType(typeName, options?): Promise<ManifestSchemaType | null>`

Get a specific type by name.

#### `deploy(schemas): Promise<StoredWorkspaceSchema[]>`

Deploy schemas to the server. Requires `deployStudio` permission.

#### `delete(schemaIds): Promise<void>`

Delete schemas by ID.

### Helper Functions

The library includes many helper functions for working with schema types:

```typescript
import {
  // Type guards
  isDocumentType,
  isObjectType,
  isArrayType,
  isReferenceType,

  // Field helpers
  getFieldByName,
  getRequiredFields,
  getFieldsByFieldset,
  getVisibleFields,

  // Validation helpers
  isFieldRequired,
  hasValidationRule,
  getValidationRules,

  // Reference/array helpers
  getReferenceTargetTypes,
  getArrayMemberTypes,

  // Options helpers
  getListOptions,
  hasHotspot,
  getSlugSource,

  // Traversal
  walkSchemaTypes,
  findTypeByName,
} from '@sanity/schema-client'
```

## Authentication

The Schema API requires authentication. You'll need a token with appropriate permissions:

- **Read schemas**: Most authenticated tokens work
- **Deploy schemas**: Requires `deployStudio` permission (Administrator or Deploy Studio role)

Note: Some endpoints may only work with session tokens, not robot tokens.

## Requirements

- `@sanity/client` >= 6.0.0
- Node.js 18+ or modern browser

## License

MIT
