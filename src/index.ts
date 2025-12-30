/**
 * @sanity/schema-client
 *
 * TypeScript client library for working with Sanity server-side deployed schemas.
 *
 * @example
 * ```ts
 * import { createClient } from '@sanity/client'
 * import { SchemaClient } from '@sanity/schema-client'
 *
 * const sanityClient = createClient({
 *   projectId: 'your-project-id',
 *   dataset: 'production',
 *   token: 'your-token',
 *   apiVersion: '2025-03-01',
 *   useCdn: false,
 * })
 *
 * const schemaClient = new SchemaClient(sanityClient)
 *
 * // List all deployed schemas
 * const schemas = await schemaClient.list()
 *
 * // Get all types from default workspace
 * const types = await schemaClient.getTypes()
 *
 * // Get only document types
 * const documentTypes = await schemaClient.getDocumentTypes()
 *
 * // Get a specific type
 * const articleType = await schemaClient.getType('article')
 * ```
 *
 * @packageDocumentation
 */

// Client
export { SchemaClient, SchemaClientError, createSchemaClient } from './client.js'

// Types
export type {
  ManifestSerializable,
  ManifestTitledValue,
  ManifestValidationRule,
  ManifestValidationGroup,
  ManifestFieldset,
  ManifestSchemaType,
  ManifestField,
  ManifestArrayMember,
  ManifestReferenceMember,
  StoredWorkspaceSchema,
  ParsedWorkspaceSchema,
  DeploySchemaInput,
  SchemaClientConfig,
  GetSchemaOptions,
} from './types.js'

// Helpers
export {
  // Type guards
  isDocumentType,
  isObjectType,
  isArrayType,
  isReferenceType,
  isBlockType,
  isImageType,
  isFileType,
  isPrimitiveType,
  // Field helpers
  getFieldByName,
  getRequiredFields,
  getFieldsByFieldset,
  getFieldsWithoutFieldset,
  getVisibleFields,
  getEditableFields,
  // Validation helpers
  isFieldRequired,
  hasValidationRule,
  getValidationRules,
  getValidationRulesByFlag,
  getMinConstraint,
  getMaxConstraint,
  // Reference helpers
  getReferenceTargetTypes,
  canReferenceType,
  // Array helpers
  getArrayMemberTypes,
  canContainType,
  // Options helpers
  getListOptions,
  hasListOptions,
  getSlugSource,
  hasHotspot,
  // Schema traversal
  walkSchemaTypes,
  findTypes,
  findTypeByName,
  getReferencedTypeNames,
  // Skeleton generation
  generateDocumentSkeleton,
  generateSkeletonByTypeName,
} from './helpers.js'

export type { GenerateSkeletonOptions } from './helpers.js'

// Validation
export {
  validateDocument,
  formatValidationIssues,
  formatValidationForAgent,
} from './validation.js'

export type {
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  ValidateOptions,
} from './validation.js'
