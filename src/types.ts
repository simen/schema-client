/**
 * Type definitions for Sanity server-side deployed schemas.
 *
 * Based on the ManifestSchemaType format documented at:
 * https://github.com/sanity-io/sanity/blob/main/packages/sanity/src/_internal/manifest/manifestTypes.ts
 */

/**
 * Primitive serializable values that can appear in schema definitions.
 */
export type ManifestSerializable =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ManifestSerializable }
  | ManifestSerializable[]

/**
 * A titled value used for decorators, styles, and list items.
 */
export interface ManifestTitledValue {
  value: string
  title?: string
}

/**
 * A validation rule within a validation group.
 */
export interface ManifestValidationRule {
  /** The validation flag: 'presence', 'min', 'max', 'regex', 'uri', 'email', 'unique', 'custom', etc. */
  flag: string
  /** The constraint value, e.g., 'required', 5, { min: 1, max: 100 } */
  constraint?: ManifestSerializable
}

/**
 * A group of validation rules with an optional message and severity level.
 */
export interface ManifestValidationGroup {
  rules: ManifestValidationRule[]
  message?: string
  level?: 'error' | 'warning' | 'info'
}

/**
 * A fieldset definition for grouping fields in the editor.
 */
export interface ManifestFieldset {
  name: string
  title?: string
  description?: string
  readOnly?: boolean | 'conditional'
  hidden?: boolean | 'conditional'
  options?: Record<string, ManifestSerializable>
}

/**
 * Base schema type definition.
 */
export interface ManifestSchemaType {
  /** The type kind: 'document', 'object', 'string', 'number', 'array', 'reference', 'block', etc. */
  type: string
  /** Unique type/field name */
  name: string
  /** Display title (omitted if same as startCase(name)) */
  title?: string
  /** Field description */
  description?: string
  /** Deprecation info */
  deprecated?: { reason: string }
  /** Read-only state; 'conditional' means determined by a function */
  readOnly?: boolean | 'conditional'
  /** Hidden state; 'conditional' means determined by a function */
  hidden?: boolean | 'conditional'

  // Document/object types
  /** Fields for document and object types */
  fields?: ManifestField[]
  /** Fieldset definitions */
  fieldsets?: ManifestFieldset[]
  /** Preview configuration */
  preview?: { select: Record<string, string>; prepare?: 'conditional' }

  // Array types
  /** Array member types */
  of?: ManifestArrayMember[]

  // Reference types
  /** Reference target types */
  to?: ManifestReferenceMember[]
  /** Allow weak references */
  weak?: boolean

  // Portable text (block type)
  /** Marks configuration for portable text */
  marks?: {
    annotations?: ManifestArrayMember[]
    decorators?: ManifestTitledValue[]
  }
  /** List styles for portable text */
  lists?: ManifestTitledValue[]
  /** Block styles for portable text */
  styles?: ManifestTitledValue[]

  // Validation
  /** Validation rules */
  validation?: ManifestValidationGroup[]

  // Options
  /** Type-specific options */
  options?: Record<string, ManifestSerializable>

  // Common additional properties
  /** Initial value for the field */
  initialValue?: ManifestSerializable
  /** Number of rows for text fields */
  rows?: number
  /** Placeholder text */
  placeholder?: string
  /** Live edit mode */
  liveEdit?: boolean

  // Allow additional serializable properties
  [key: string]: ManifestSerializable | ManifestField[] | ManifestFieldset[] | ManifestArrayMember[] | ManifestReferenceMember[] | ManifestValidationGroup[] | { select: Record<string, string>; prepare?: 'conditional' } | { annotations?: ManifestArrayMember[]; decorators?: ManifestTitledValue[] } | ManifestTitledValue[] | undefined
}

/**
 * A field within a document or object type.
 */
export interface ManifestField extends ManifestSchemaType {
  /** The fieldset this field belongs to */
  fieldset?: string
}

/**
 * An array member type definition.
 */
export interface ManifestArrayMember extends Omit<ManifestSchemaType, 'name'> {
  /** Name is optional for array members */
  name?: string
}

/**
 * A reference target type definition.
 */
export interface ManifestReferenceMember extends Omit<ManifestSchemaType, 'name'> {
  /** Name is optional for reference targets */
  name?: string
}

/**
 * A stored workspace schema as returned by the Sanity API.
 */
export interface StoredWorkspaceSchema {
  _type: 'system.schema'
  _id: string
  _createdAt: string
  _updatedAt: string
  _rev: string
  /** Schema format version */
  version: string
  /** Optional deployment tag */
  tag?: string
  /** Workspace information */
  workspace: {
    name: string
    title?: string
  }
  /** Stringified JSON array of ManifestSchemaType - must be parsed */
  schema: string
}

/**
 * A parsed workspace schema with types already parsed from JSON.
 */
export interface ParsedWorkspaceSchema extends Omit<StoredWorkspaceSchema, 'schema'> {
  /** Parsed schema types */
  schema: ManifestSchemaType[]
}

/**
 * Input for deploying schemas.
 */
export interface DeploySchemaInput {
  /** Schema format version */
  version?: string
  /** Optional deployment tag */
  tag?: string
  /** Workspace configuration */
  workspace: {
    name: string
    title?: string
  }
  /** Schema types to deploy */
  schema: ManifestSchemaType[]
}

/**
 * Configuration options for SchemaClient.
 */
export interface SchemaClientConfig {
  /** Sanity project ID */
  projectId: string
  /** Dataset name */
  dataset: string
  /** API token (required for schema API) */
  token?: string
  /** API version (default: '2025-03-01') */
  apiVersion?: string
  /** API host (default: 'api.sanity.io') */
  apiHost?: string
  /** Use CDN (default: false for schema operations) */
  useCdn?: boolean
}

/**
 * Options for fetching a specific schema.
 */
export interface GetSchemaOptions {
  /** Workspace name (default: 'default') */
  workspace?: string
  /** Deployment tag */
  tag?: string
}
