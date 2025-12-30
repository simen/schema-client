import type {
  ManifestSchemaType,
  ManifestField,
  ManifestValidationRule,
  ManifestArrayMember,
  ManifestReferenceMember,
} from './types.js'

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a type is a document type.
 */
export function isDocumentType(type: ManifestSchemaType): boolean {
  return type.type === 'document'
}

/**
 * Check if a type is an object type.
 */
export function isObjectType(type: ManifestSchemaType): boolean {
  return type.type === 'object'
}

/**
 * Check if a type is an array type.
 */
export function isArrayType(type: ManifestSchemaType): boolean {
  return type.type === 'array'
}

/**
 * Check if a type is a reference type.
 */
export function isReferenceType(type: ManifestSchemaType): boolean {
  return type.type === 'reference'
}

/**
 * Check if a type is a portable text block type.
 */
export function isBlockType(type: ManifestSchemaType): boolean {
  return type.type === 'block'
}

/**
 * Check if a type is an image type.
 */
export function isImageType(type: ManifestSchemaType): boolean {
  return type.type === 'image'
}

/**
 * Check if a type is a file type.
 */
export function isFileType(type: ManifestSchemaType): boolean {
  return type.type === 'file'
}

/**
 * Check if a type is a primitive type (string, number, boolean, date, etc.).
 */
export function isPrimitiveType(type: ManifestSchemaType): boolean {
  const primitives = ['string', 'number', 'boolean', 'date', 'datetime', 'text', 'url', 'slug', 'email']
  return primitives.includes(type.type)
}

// =============================================================================
// Field Helpers
// =============================================================================

/**
 * Get a field by name from a type.
 *
 * @example
 * ```ts
 * const titleField = getFieldByName(articleType, 'title')
 * ```
 */
export function getFieldByName(
  type: ManifestSchemaType,
  fieldName: string
): ManifestField | undefined {
  return type.fields?.find((f) => f.name === fieldName)
}

/**
 * Get all fields that are marked as required.
 *
 * @example
 * ```ts
 * const requiredFields = getRequiredFields(articleType)
 * ```
 */
export function getRequiredFields(type: ManifestSchemaType): ManifestField[] {
  return type.fields?.filter((f) => isFieldRequired(f)) ?? []
}

/**
 * Get all fields belonging to a specific fieldset.
 *
 * @example
 * ```ts
 * const seoFields = getFieldsByFieldset(articleType, 'seo')
 * ```
 */
export function getFieldsByFieldset(
  type: ManifestSchemaType,
  fieldsetName: string
): ManifestField[] {
  return type.fields?.filter((f) => f.fieldset === fieldsetName) ?? []
}

/**
 * Get fields that are not in any fieldset.
 */
export function getFieldsWithoutFieldset(type: ManifestSchemaType): ManifestField[] {
  return type.fields?.filter((f) => !f.fieldset) ?? []
}

/**
 * Get all visible fields (not hidden).
 */
export function getVisibleFields(type: ManifestSchemaType): ManifestField[] {
  return type.fields?.filter((f) => f.hidden !== true) ?? []
}

/**
 * Get all editable fields (not read-only).
 */
export function getEditableFields(type: ManifestSchemaType): ManifestField[] {
  return type.fields?.filter((f) => f.readOnly !== true) ?? []
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a field has a 'presence: required' validation rule.
 *
 * @example
 * ```ts
 * const required = isFieldRequired(titleField)
 * ```
 */
export function isFieldRequired(field: ManifestSchemaType): boolean {
  return hasValidationRule(field, 'presence', 'required')
}

/**
 * Check if a field has a specific validation rule.
 *
 * @param field - The field to check
 * @param flag - The validation flag to look for
 * @param constraint - Optional constraint value to match
 */
export function hasValidationRule(
  field: ManifestSchemaType,
  flag: string,
  constraint?: unknown
): boolean {
  const rules = getValidationRules(field)
  return rules.some((rule) => {
    if (rule.flag !== flag) return false
    if (constraint !== undefined && rule.constraint !== constraint) return false
    return true
  })
}

/**
 * Get all validation rules for a field.
 */
export function getValidationRules(field: ManifestSchemaType): ManifestValidationRule[] {
  const rules: ManifestValidationRule[] = []
  for (const group of field.validation ?? []) {
    rules.push(...group.rules)
  }
  return rules
}

/**
 * Get validation rules with a specific flag.
 */
export function getValidationRulesByFlag(
  field: ManifestSchemaType,
  flag: string
): ManifestValidationRule[] {
  return getValidationRules(field).filter((r) => r.flag === flag)
}

/**
 * Get the minimum value/length constraint for a field.
 */
export function getMinConstraint(field: ManifestSchemaType): number | undefined {
  const rule = getValidationRules(field).find((r) => r.flag === 'min')
  if (rule?.constraint !== undefined && typeof rule.constraint === 'number') {
    return rule.constraint
  }
  return undefined
}

/**
 * Get the maximum value/length constraint for a field.
 */
export function getMaxConstraint(field: ManifestSchemaType): number | undefined {
  const rule = getValidationRules(field).find((r) => r.flag === 'max')
  if (rule?.constraint !== undefined && typeof rule.constraint === 'number') {
    return rule.constraint
  }
  return undefined
}

// =============================================================================
// Reference Helpers
// =============================================================================

/**
 * Get the target type names for a reference field.
 *
 * @example
 * ```ts
 * const targets = getReferenceTargetTypes(authorField)
 * // ['author', 'person']
 * ```
 */
export function getReferenceTargetTypes(field: ManifestSchemaType): string[] {
  if (!field.to) return []
  return field.to
    .map((ref: ManifestReferenceMember) => ref['type'])
    .filter((t): t is string => typeof t === 'string')
}

/**
 * Check if a reference field can reference a specific type.
 */
export function canReferenceType(field: ManifestSchemaType, typeName: string): boolean {
  return getReferenceTargetTypes(field).includes(typeName)
}

// =============================================================================
// Array Helpers
// =============================================================================

/**
 * Get the member types for an array field.
 *
 * @example
 * ```ts
 * const memberTypes = getArrayMemberTypes(tagsField)
 * // ['string']
 * ```
 */
export function getArrayMemberTypes(field: ManifestSchemaType): string[] {
  if (!field.of) return []
  return field.of
    .map((member: ManifestArrayMember) => member['type'])
    .filter((t): t is string => typeof t === 'string')
}

/**
 * Check if an array field can contain a specific type.
 */
export function canContainType(field: ManifestSchemaType, typeName: string): boolean {
  return getArrayMemberTypes(field).includes(typeName)
}

// =============================================================================
// Options Helpers
// =============================================================================

/**
 * Get list options for a string or number field with a dropdown.
 *
 * @example
 * ```ts
 * const options = getListOptions(statusField)
 * // [{ title: 'Draft', value: 'draft' }, { title: 'Published', value: 'published' }]
 * ```
 */
export function getListOptions(
  field: ManifestSchemaType
): Array<{ title?: string; value: string | number }> | undefined {
  const list = field.options?.['list']
  if (!Array.isArray(list)) return undefined
  return list as Array<{ title?: string; value: string | number }>
}

/**
 * Check if a field has list options (dropdown).
 */
export function hasListOptions(field: ManifestSchemaType): boolean {
  return Array.isArray(field.options?.['list'])
}

/**
 * Get the source field for a slug field.
 */
export function getSlugSource(field: ManifestSchemaType): string | undefined {
  const source = field.options?.['source']
  return typeof source === 'string' ? source : undefined
}

/**
 * Check if an image field has hotspot enabled.
 */
export function hasHotspot(field: ManifestSchemaType): boolean {
  return field.options?.['hotspot'] === true
}

// =============================================================================
// Schema Traversal
// =============================================================================

/**
 * Walk through all types in a schema, calling the visitor for each.
 *
 * @param types - Array of schema types
 * @param visitor - Function called for each type with the type and its path
 *
 * @example
 * ```ts
 * walkSchemaTypes(types, (type, path) => {
 *   console.log(`${path.join('.')} -> ${type.name}`)
 * })
 * ```
 */
export function walkSchemaTypes(
  types: ManifestSchemaType[],
  visitor: (type: ManifestSchemaType, path: string[]) => void
): void {
  function walk(type: ManifestSchemaType, path: string[]): void {
    visitor(type, path)

    // Walk fields
    if (type.fields) {
      for (const field of type.fields) {
        walk(field, [...path, field.name])
      }
    }

    // Walk array members
    if (type.of) {
      for (let i = 0; i < type.of.length; i++) {
        const member = type.of[i]
        if (member) {
          walk(member as ManifestSchemaType, [...path, `of[${i}]`])
        }
      }
    }

    // Walk reference targets
    if (type.to) {
      for (let i = 0; i < type.to.length; i++) {
        const target = type.to[i]
        if (target) {
          walk(target as ManifestSchemaType, [...path, `to[${i}]`])
        }
      }
    }
  }

  for (const type of types) {
    walk(type, [type.name])
  }
}

/**
 * Find all types that match a predicate.
 *
 * @example
 * ```ts
 * const deprecatedTypes = findTypes(types, t => !!t.deprecated)
 * ```
 */
export function findTypes(
  types: ManifestSchemaType[],
  predicate: (type: ManifestSchemaType) => boolean
): ManifestSchemaType[] {
  return types.filter(predicate)
}

/**
 * Find a type by name.
 */
export function findTypeByName(
  types: ManifestSchemaType[],
  name: string
): ManifestSchemaType | undefined {
  return types.find((t) => t.name === name)
}

/**
 * Get all type names referenced by a type (via references and arrays).
 */
export function getReferencedTypeNames(type: ManifestSchemaType): string[] {
  const names = new Set<string>()

  function collect(t: ManifestSchemaType): void {
    // Reference targets
    if (t.to) {
      for (const target of t.to) {
        const targetType = target['type']
        if (targetType && typeof targetType === 'string') {
          names.add(targetType)
        }
      }
    }

    // Array members
    if (t.of) {
      for (const member of t.of) {
        const memberType = member['type']
        if (memberType && typeof memberType === 'string' && !isPrimitiveTypeName(memberType)) {
          names.add(memberType)
        }
        collect(member as ManifestSchemaType)
      }
    }

    // Nested fields
    if (t.fields) {
      for (const field of t.fields) {
        if (field.type && !isPrimitiveTypeName(field.type)) {
          names.add(field.type)
        }
        collect(field)
      }
    }
  }

  collect(type)
  return Array.from(names)
}

function isPrimitiveTypeName(typeName: string): boolean {
  const primitives = [
    'string', 'number', 'boolean', 'date', 'datetime', 'text', 'url',
    'slug', 'email', 'array', 'object', 'reference', 'image', 'file', 'block'
  ]
  return primitives.includes(typeName)
}

// =============================================================================
// Skeleton Generation
// =============================================================================

/**
 * Options for generating a document skeleton.
 */
export interface GenerateSkeletonOptions {
  /** Include optional fields with default values (default: false) */
  includeOptional?: boolean
  /** Custom ID to use for the document (default: undefined, caller should set) */
  documentId?: string
  /** Type map for resolving custom object types */
  typeMap?: Map<string, ManifestSchemaType>
}

/**
 * Generate an empty document skeleton from a schema type.
 *
 * Creates a document with the correct `_type` and default values for required fields.
 * Useful for creating new documents that will pass initial validation.
 *
 * @param schemaType - The document type definition
 * @param options - Generation options
 * @returns A document skeleton with default values
 *
 * @example
 * ```ts
 * const articleType = await schemaClient.getType('article')
 * const skeleton = generateDocumentSkeleton(articleType)
 * // { _type: 'article', title: '', slug: { current: '' } }
 *
 * // Include optional fields
 * const fullSkeleton = generateDocumentSkeleton(articleType, { includeOptional: true })
 * ```
 */
export function generateDocumentSkeleton(
  schemaType: ManifestSchemaType,
  options: GenerateSkeletonOptions = {}
): Record<string, unknown> {
  const { includeOptional = false, documentId, typeMap } = options

  const skeleton: Record<string, unknown> = {
    _type: schemaType.name,
  }

  if (documentId) {
    skeleton['_id'] = documentId
  }

  if (!schemaType.fields) {
    return skeleton
  }

  for (const field of schemaType.fields) {
    const required = isFieldRequired(field)

    // Skip optional fields unless includeOptional is true
    if (!required && !includeOptional) {
      continue
    }

    const defaultValue = getDefaultValueForField(field, typeMap, includeOptional)
    if (defaultValue !== undefined) {
      skeleton[field.name] = defaultValue
    }
  }

  return skeleton
}

/**
 * Generate a skeleton from a type name, looking it up in the provided types array.
 *
 * @param typeName - The name of the document type
 * @param schemaTypes - All schema types from the schema
 * @param options - Generation options
 * @returns A document skeleton, or null if type not found
 *
 * @example
 * ```ts
 * const types = await schemaClient.getTypes()
 * const skeleton = generateSkeletonByTypeName('article', types)
 * ```
 */
export function generateSkeletonByTypeName(
  typeName: string,
  schemaTypes: ManifestSchemaType[],
  options: GenerateSkeletonOptions = {}
): Record<string, unknown> | null {
  const schemaType = schemaTypes.find((t) => t.name === typeName)
  if (!schemaType) {
    return null
  }

  // Build type map for resolving custom types
  const typeMap = new Map(schemaTypes.map((t) => [t.name, t]))

  return generateDocumentSkeleton(schemaType, { ...options, typeMap })
}

/**
 * Get the default value for a field based on its type.
 */
function getDefaultValueForField(
  field: ManifestField,
  typeMap?: Map<string, ManifestSchemaType>,
  includeOptional: boolean = false
): unknown {
  // Check for explicit initialValue in schema
  if (field.initialValue !== undefined) {
    return field.initialValue
  }

  // Check for list options - use first value as default
  const listOptions = getListOptions(field)
  if (listOptions && listOptions.length > 0 && listOptions[0]) {
    return listOptions[0].value
  }

  switch (field.type) {
    case 'string':
    case 'text':
    case 'url':
    case 'email':
      return ''

    case 'number':
      return 0

    case 'boolean':
      return false

    case 'date':
    case 'datetime':
      // Leave dates undefined - they're usually set explicitly
      return undefined

    case 'slug':
      return { _type: 'slug', current: '' }

    case 'array':
      return []

    case 'reference':
      // References should be set explicitly, return null to indicate "no reference"
      return null

    case 'image':
      // Return minimal image structure (agent will need to upload asset)
      return { _type: 'image' }

    case 'file':
      // Return minimal file structure
      return { _type: 'file' }

    case 'object':
      // Recursively generate skeleton for nested object
      return generateObjectSkeleton(field, typeMap, includeOptional)

    case 'block':
      // Portable text - return empty array (content field is usually array of blocks)
      return undefined

    default:
      // Check if it's a custom type defined in the schema
      if (typeMap) {
        const customType = typeMap.get(field.type)
        if (customType && customType.type === 'object') {
          return generateObjectSkeleton(customType, typeMap, includeOptional)
        }
      }
      return undefined
  }
}

/**
 * Generate a skeleton for a nested object type.
 */
function generateObjectSkeleton(
  objectType: ManifestSchemaType,
  typeMap?: Map<string, ManifestSchemaType>,
  includeOptional: boolean = false
): Record<string, unknown> {
  const skeleton: Record<string, unknown> = {}

  // Add _type if the object type has a name (custom object types)
  if (objectType.name && objectType.type !== 'object') {
    skeleton['_type'] = objectType.name
  }

  if (!objectType.fields) {
    return skeleton
  }

  for (const field of objectType.fields) {
    const required = isFieldRequired(field)

    if (!required && !includeOptional) {
      continue
    }

    const defaultValue = getDefaultValueForField(field, typeMap, includeOptional)
    if (defaultValue !== undefined) {
      skeleton[field.name] = defaultValue
    }
  }

  return skeleton
}
