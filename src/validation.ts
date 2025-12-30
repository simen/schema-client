import type {
  ManifestSchemaType,
  ManifestField,
  ManifestValidationRule,
  ManifestArrayMember,
  ManifestReferenceMember,
} from './types.js'
import { getValidationRules } from './helpers.js'

/**
 * Severity level for validation issues.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/**
 * A single validation issue with full context for UI display and agent feedback.
 */
export interface ValidationIssue {
  /** JSON path to the problematic value (e.g., "content[0].children[2].text") */
  path: string
  /** Human-readable error message */
  message: string
  /** Severity level */
  severity: ValidationSeverity
  /** The validation rule that was violated */
  rule?: {
    flag: string
    constraint?: unknown
  }
  /** The actual value that failed validation */
  value?: unknown
  /** The expected type or format */
  expected?: string
  /** Field information for context */
  field?: {
    name: string
    type: string
    title?: string
  }
  /** Suggestions for fixing the issue (useful for agents) */
  suggestions?: string[]
}

/**
 * Result of validating a document.
 */
export interface ValidationResult {
  /** Whether the document is valid (no errors, warnings/info allowed) */
  valid: boolean
  /** All validation issues found */
  issues: ValidationIssue[]
  /** Just the errors */
  errors: ValidationIssue[]
  /** Just the warnings */
  warnings: ValidationIssue[]
  /** Just the info messages */
  info: ValidationIssue[]
  /** Document type that was validated */
  documentType: string
  /** Summary for quick display */
  summary: string
}

/**
 * Options for document validation.
 */
export interface ValidateOptions {
  /** Include warnings (default: true) */
  includeWarnings?: boolean
  /** Include info messages (default: false) */
  includeInfo?: boolean
  /** Stop after first error (default: false) */
  stopOnFirstError?: boolean
  /** Custom type lookup for references (returns type definition for a document ID) */
  resolveReference?: (id: string) => Promise<string | null>
}

/**
 * Validates a document against its schema type.
 *
 * @param document - The document to validate
 * @param schemaType - The schema type definition
 * @param allTypes - All schema types (for resolving nested types)
 * @param options - Validation options
 * @returns Detailed validation result
 *
 * @example
 * ```ts
 * const articleType = await schemaClient.getType('article')
 * const allTypes = await schemaClient.getTypes()
 *
 * const result = validateDocument(myDocument, articleType, allTypes)
 *
 * if (!result.valid) {
 *   console.log(result.summary)
 *   for (const error of result.errors) {
 *     console.log(`${error.path}: ${error.message}`)
 *     if (error.suggestions) {
 *       console.log(`  Suggestions: ${error.suggestions.join(', ')}`)
 *     }
 *   }
 * }
 * ```
 */
export function validateDocument(
  document: Record<string, unknown>,
  schemaType: ManifestSchemaType,
  allTypes: ManifestSchemaType[],
  options: ValidateOptions = {}
): ValidationResult {
  const {
    includeWarnings = true,
    includeInfo = false,
    stopOnFirstError = false,
  } = options

  const issues: ValidationIssue[] = []
  const typeMap = new Map(allTypes.map((t) => [t.name, t]))

  // Check document has _type
  const docType = document['_type']
  if (!docType) {
    issues.push({
      path: '_type',
      message: 'Document is missing required _type field',
      severity: 'error',
      expected: schemaType.name,
      suggestions: [`Add "_type": "${schemaType.name}" to the document`],
    })
  } else if (docType !== schemaType.name) {
    issues.push({
      path: '_type',
      message: `Document type "${docType}" does not match expected type "${schemaType.name}"`,
      severity: 'error',
      value: docType,
      expected: schemaType.name,
      suggestions: [`Change _type to "${schemaType.name}" or use the correct schema type for validation`],
    })
  }

  // Validate fields
  if (schemaType.fields) {
    for (const field of schemaType.fields) {
      if (stopOnFirstError && issues.some((i) => i.severity === 'error')) break

      const value = document[field.name]
      const fieldIssues = validateField(
        value,
        field,
        field.name,
        typeMap,
        options
      )
      issues.push(...fieldIssues)
    }
  }

  // Filter by severity
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = includeWarnings ? issues.filter((i) => i.severity === 'warning') : []
  const info = includeInfo ? issues.filter((i) => i.severity === 'info') : []

  const filteredIssues = [
    ...errors,
    ...(includeWarnings ? warnings : []),
    ...(includeInfo ? info : []),
  ]

  // Build summary
  const parts: string[] = []
  if (errors.length > 0) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`)
  if (warnings.length > 0) parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`)
  if (info.length > 0) parts.push(`${info.length} info`)

  const summary = errors.length === 0
    ? 'Document is valid' + (warnings.length > 0 ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : '')
    : `Validation failed: ${parts.join(', ')}`

  return {
    valid: errors.length === 0,
    issues: filteredIssues,
    errors,
    warnings,
    info,
    documentType: schemaType.name,
    summary,
  }
}

/**
 * Validates a single field value.
 */
function validateField(
  value: unknown,
  field: ManifestField,
  path: string,
  typeMap: Map<string, ManifestSchemaType>,
  options: ValidateOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const fieldContext = {
    name: field.name,
    type: field.type,
    title: field.title,
  }

  // Check required fields
  const rules = getValidationRules(field)
  const isRequired = rules.some(
    (r) => r.flag === 'presence' && r.constraint === 'required'
  )

  if (isRequired && (value === undefined || value === null)) {
    issues.push({
      path,
      message: `${field.title || field.name} is required`,
      severity: 'error',
      rule: { flag: 'presence', constraint: 'required' },
      value,
      expected: field.type,
      field: fieldContext,
      suggestions: [`Provide a value for ${field.name}`],
    })
    return issues // Don't validate further if required field is missing
  }

  // Skip validation if value is not present and not required
  if (value === undefined || value === null) {
    return issues
  }

  // Type-specific validation
  switch (field.type) {
    case 'string':
    case 'text':
      issues.push(...validateString(value, field, path, rules, fieldContext))
      break
    case 'number':
      issues.push(...validateNumber(value, field, path, rules, fieldContext))
      break
    case 'boolean':
      issues.push(...validateBoolean(value, path, fieldContext))
      break
    case 'date':
    case 'datetime':
      issues.push(...validateDate(value, field, path, fieldContext))
      break
    case 'array':
      issues.push(...validateArray(value, field, path, typeMap, options, fieldContext))
      break
    case 'object':
      issues.push(...validateObject(value, field, path, typeMap, options, fieldContext))
      break
    case 'reference':
      issues.push(...validateReference(value, field, path, fieldContext))
      break
    case 'image':
    case 'file':
      issues.push(...validateAsset(value, field, path, typeMap, options, fieldContext))
      break
    case 'slug':
      issues.push(...validateSlug(value, field, path, rules, fieldContext))
      break
    case 'url':
      issues.push(...validateUrl(value, path, rules, fieldContext))
      break
    case 'block':
      issues.push(...validateBlock(value, field, path, typeMap, options, fieldContext))
      break
    default:
      // For custom types, look up in type map
      const customType = typeMap.get(field.type)
      if (customType && customType.type === 'object' && customType.fields) {
        issues.push(...validateObject(value, customType, path, typeMap, options, fieldContext))
      }
  }

  // Apply validation rules
  issues.push(...applyValidationRules(value, rules, path, field, fieldContext))

  return issues
}

function validateString(
  value: unknown,
  field: ManifestField,
  path: string,
  rules: ManifestValidationRule[],
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'string') {
    issues.push({
      path,
      message: `Expected string, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'string',
      field: fieldContext,
      suggestions: [`Convert the value to a string`],
    })
    return issues
  }

  // Check list options
  const list = field.options?.['list'] as Array<{ value: string }> | undefined
  if (list && Array.isArray(list)) {
    const validValues = list.map((item) =>
      typeof item === 'object' ? item.value : item
    )
    if (!validValues.includes(value)) {
      issues.push({
        path,
        message: `"${value}" is not a valid option`,
        severity: 'error',
        value,
        expected: `one of: ${validValues.join(', ')}`,
        field: fieldContext,
        suggestions: validValues.map((v) => `Use "${v}"`),
      })
    }
  }

  return issues
}

function validateNumber(
  value: unknown,
  field: ManifestField,
  path: string,
  rules: ManifestValidationRule[],
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'number' || isNaN(value)) {
    issues.push({
      path,
      message: `Expected number, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'number',
      field: fieldContext,
      suggestions: [`Convert the value to a number`],
    })
    return issues
  }

  // Check integer rule
  const integerRule = rules.find((r) => r.flag === 'integer')
  if (integerRule && !Number.isInteger(value)) {
    issues.push({
      path,
      message: `Expected integer, got decimal`,
      severity: 'error',
      rule: integerRule,
      value,
      expected: 'integer',
      field: fieldContext,
      suggestions: [`Round to ${Math.round(value)}`],
    })
  }

  // Check positive rule
  const positiveRule = rules.find((r) => r.flag === 'positive')
  if (positiveRule && value <= 0) {
    issues.push({
      path,
      message: `Expected positive number`,
      severity: 'error',
      rule: positiveRule,
      value,
      expected: 'positive number',
      field: fieldContext,
      suggestions: [`Use a positive value`],
    })
  }

  return issues
}

function validateBoolean(
  value: unknown,
  path: string,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  if (typeof value !== 'boolean') {
    return [{
      path,
      message: `Expected boolean, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'boolean',
      field: fieldContext,
      suggestions: [`Use true or false`],
    }]
  }
  return []
}

function validateDate(
  value: unknown,
  field: ManifestField,
  path: string,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  if (typeof value !== 'string') {
    return [{
      path,
      message: `Expected date string, got ${typeof value}`,
      severity: 'error',
      value,
      expected: field.type === 'datetime' ? 'ISO 8601 datetime string' : 'YYYY-MM-DD date string',
      field: fieldContext,
      suggestions: [field.type === 'datetime' ? 'Use format: 2024-01-15T10:30:00Z' : 'Use format: 2024-01-15'],
    }]
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return [{
      path,
      message: `Invalid date format: "${value}"`,
      severity: 'error',
      value,
      expected: field.type === 'datetime' ? 'ISO 8601 datetime string' : 'YYYY-MM-DD date string',
      field: fieldContext,
      suggestions: [field.type === 'datetime' ? 'Use format: 2024-01-15T10:30:00Z' : 'Use format: 2024-01-15'],
    }]
  }

  return []
}

function validateArray(
  value: unknown,
  field: ManifestField,
  path: string,
  typeMap: Map<string, ManifestSchemaType>,
  options: ValidateOptions,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!Array.isArray(value)) {
    issues.push({
      path,
      message: `Expected array, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'array',
      field: fieldContext,
      suggestions: [`Wrap the value in an array: [${JSON.stringify(value)}]`],
    })
    return issues
  }

  // Validate each item
  const memberTypes = field.of || []

  for (let i = 0; i < value.length; i++) {
    const item = value[i]
    const itemPath = `${path}[${i}]`

    // Check _key for objects in arrays
    if (typeof item === 'object' && item !== null && !('_key' in item)) {
      issues.push({
        path: itemPath,
        message: `Array item is missing _key property`,
        severity: 'warning',
        value: item,
        expected: 'object with _key',
        field: fieldContext,
        suggestions: [`Add a unique "_key" property to this item`],
      })
    }

    // Find matching member type
    if (typeof item === 'object' && item !== null && '_type' in item) {
      const itemType = (item as { _type: string })._type
      const memberType = memberTypes.find((m) => {
        const mType = m['type']
        return mType === itemType || m.name === itemType
      })

      if (!memberType) {
        const allowedTypes = memberTypes.map((m) => m['type'] || m.name).filter(Boolean)
        issues.push({
          path: `${itemPath}._type`,
          message: `Type "${itemType}" is not allowed in this array`,
          severity: 'error',
          value: itemType,
          expected: `one of: ${allowedTypes.join(', ')}`,
          field: fieldContext,
          suggestions: allowedTypes.map((t) => `Change _type to "${t}"`),
        })
      } else {
        // Validate against member type
        const memberTypeDef = typeMap.get(itemType) || memberType
        const memberFields = memberTypeDef['fields'] as ManifestField[] | undefined
        if (memberFields) {
          for (const f of memberFields) {
            const fieldValue = (item as Record<string, unknown>)[f.name]
            issues.push(...validateField(fieldValue, f, `${itemPath}.${f.name}`, typeMap, options))
          }
        }
      }
    } else if (memberTypes.length > 0) {
      // Primitive array items
      const expectedType = memberTypes[0]?.['type'] as string | undefined
      if (expectedType && typeof item !== expectedType) {
        issues.push({
          path: itemPath,
          message: `Expected ${expectedType}, got ${typeof item}`,
          severity: 'error',
          value: item,
          expected: expectedType,
          field: fieldContext,
        })
      }
    }
  }

  return issues
}

function validateObject(
  value: unknown,
  field: ManifestSchemaType,
  path: string,
  typeMap: Map<string, ManifestSchemaType>,
  options: ValidateOptions,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push({
      path,
      message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
      severity: 'error',
      value,
      expected: 'object',
      field: fieldContext,
    })
    return issues
  }

  const obj = value as Record<string, unknown>

  // Validate nested fields
  if (field.fields) {
    for (const f of field.fields) {
      const fieldValue = obj[f.name]
      issues.push(...validateField(fieldValue, f, `${path}.${f.name}`, typeMap, options))
    }
  }

  return issues
}

function validateReference(
  value: unknown,
  field: ManifestField,
  path: string,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'object' || value === null) {
    issues.push({
      path,
      message: `Expected reference object, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'reference object with _ref',
      field: fieldContext,
      suggestions: [`Use format: { "_type": "reference", "_ref": "document-id" }`],
    })
    return issues
  }

  const ref = value as Record<string, unknown>
  const refValue = ref['_ref']
  const refType = ref['_type']

  if (!refValue || typeof refValue !== 'string') {
    issues.push({
      path: `${path}._ref`,
      message: `Reference is missing _ref property`,
      severity: 'error',
      value: refValue,
      expected: 'string (document ID)',
      field: fieldContext,
      suggestions: [`Add "_ref": "document-id" to the reference`],
    })
  }

  // Check reference targets
  const targets = field.to || []
  if (refType && refType !== 'reference') {
    const allowedTypes = targets.map((t) => t['type']).filter(Boolean)
    if (allowedTypes.length > 0 && !allowedTypes.includes(refType as string)) {
      issues.push({
        path: `${path}._type`,
        message: `Reference to "${refType}" is not allowed`,
        severity: 'error',
        value: refType,
        expected: `reference to: ${allowedTypes.join(', ')}`,
        field: fieldContext,
        suggestions: [`Reference a document of type: ${allowedTypes.join(', ')}`],
      })
    }
  }

  return issues
}

function validateAsset(
  value: unknown,
  field: ManifestField,
  path: string,
  typeMap: Map<string, ManifestSchemaType>,
  options: ValidateOptions,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'object' || value === null) {
    issues.push({
      path,
      message: `Expected ${field.type} object, got ${typeof value}`,
      severity: 'error',
      value,
      expected: `${field.type} object with asset reference`,
      field: fieldContext,
      suggestions: [`Use format: { "asset": { "_ref": "image-..." } }`],
    })
    return issues
  }

  const asset = value as Record<string, unknown>
  const assetValue = asset['asset']

  // Check for asset reference
  if (!assetValue) {
    issues.push({
      path: `${path}.asset`,
      message: `${field.type === 'image' ? 'Image' : 'File'} is missing asset reference`,
      severity: 'error',
      expected: 'asset reference object',
      field: fieldContext,
      suggestions: [`Add "asset": { "_ref": "${field.type}-..." }`],
    })
  } else if (typeof assetValue === 'object' && assetValue !== null) {
    const assetRef = assetValue as Record<string, unknown>
    const assetRefValue = assetRef['_ref']
    if (!assetRefValue || typeof assetRefValue !== 'string') {
      issues.push({
        path: `${path}.asset._ref`,
        message: `Asset is missing _ref property`,
        severity: 'error',
        expected: 'asset ID string',
        field: fieldContext,
      })
    }
  }

  // Validate nested fields (like alt text on images)
  if (field.fields) {
    for (const f of field.fields as ManifestField[]) {
      const fieldValue = asset[f.name]
      issues.push(...validateField(fieldValue, f, `${path}.${f.name}`, typeMap, options))
    }
  }

  return issues
}

function validateSlug(
  value: unknown,
  field: ManifestField,
  path: string,
  rules: ManifestValidationRule[],
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'object' || value === null) {
    issues.push({
      path,
      message: `Expected slug object, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'slug object with current property',
      field: fieldContext,
      suggestions: [`Use format: { "current": "my-slug" }`],
    })
    return issues
  }

  const slug = value as Record<string, unknown>
  const slugCurrent = slug['current']

  if (!slugCurrent || typeof slugCurrent !== 'string') {
    issues.push({
      path: `${path}.current`,
      message: `Slug is missing current value`,
      severity: 'error',
      value: slugCurrent,
      expected: 'string',
      field: fieldContext,
      suggestions: [`Add "current": "url-friendly-slug"`],
    })
    return issues
  }

  // Check slug format
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugCurrent)) {
    issues.push({
      path: `${path}.current`,
      message: `Slug contains invalid characters`,
      severity: 'warning',
      value: slugCurrent,
      expected: 'lowercase letters, numbers, and hyphens only',
      field: fieldContext,
      suggestions: [
        `Use: "${slugCurrent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}"`,
      ],
    })
  }

  return issues
}

function validateUrl(
  value: unknown,
  path: string,
  rules: ManifestValidationRule[],
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  if (typeof value !== 'string') {
    return [{
      path,
      message: `Expected URL string, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'URL string',
      field: fieldContext,
    }]
  }

  try {
    new URL(value)
  } catch {
    return [{
      path,
      message: `Invalid URL: "${value}"`,
      severity: 'error',
      value,
      expected: 'valid URL',
      field: fieldContext,
      suggestions: [`Use format: https://example.com/path`],
    }]
  }

  return []
}

function validateBlock(
  value: unknown,
  field: ManifestField,
  path: string,
  typeMap: Map<string, ManifestSchemaType>,
  options: ValidateOptions,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (typeof value !== 'object' || value === null) {
    issues.push({
      path,
      message: `Expected block object, got ${typeof value}`,
      severity: 'error',
      value,
      expected: 'portable text block',
      field: fieldContext,
    })
    return issues
  }

  const block = value as Record<string, unknown>
  const blockType = block['_type']
  const blockKey = block['_key']
  const blockChildren = block['children']

  // Check _type
  if (!blockType) {
    issues.push({
      path: `${path}._type`,
      message: `Block is missing _type`,
      severity: 'error',
      expected: 'block type',
      field: fieldContext,
    })
  }

  // Check _key
  if (!blockKey) {
    issues.push({
      path: `${path}._key`,
      message: `Block is missing _key`,
      severity: 'warning',
      expected: 'unique key',
      field: fieldContext,
    })
  }

  // Validate children if present
  if (blockChildren && Array.isArray(blockChildren)) {
    for (let i = 0; i < blockChildren.length; i++) {
      const child = blockChildren[i] as Record<string, unknown>
      const childPath = `${path}.children[${i}]`
      const childType = child['_type']
      const childKey = child['_key']

      if (!childType) {
        issues.push({
          path: `${childPath}._type`,
          message: `Block child is missing _type`,
          severity: 'error',
          expected: 'span or inline type',
          field: fieldContext,
        })
      }

      if (!childKey) {
        issues.push({
          path: `${childPath}._key`,
          message: `Block child is missing _key`,
          severity: 'warning',
          expected: 'unique key',
          field: fieldContext,
        })
      }
    }
  }

  return issues
}

function applyValidationRules(
  value: unknown,
  rules: ManifestValidationRule[],
  path: string,
  field: ManifestField,
  fieldContext: ValidationIssue['field']
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const rule of rules) {
    switch (rule.flag) {
      case 'min': {
        const min = rule.constraint as number
        if (typeof value === 'string' && value.length < min) {
          issues.push({
            path,
            message: `Must be at least ${min} characters`,
            severity: 'error',
            rule,
            value,
            expected: `string with length >= ${min}`,
            field: fieldContext,
            suggestions: [`Add ${min - value.length} more character${min - value.length === 1 ? '' : 's'}`],
          })
        } else if (typeof value === 'number' && value < min) {
          issues.push({
            path,
            message: `Must be at least ${min}`,
            severity: 'error',
            rule,
            value,
            expected: `number >= ${min}`,
            field: fieldContext,
          })
        } else if (Array.isArray(value) && value.length < min) {
          issues.push({
            path,
            message: `Must have at least ${min} item${min === 1 ? '' : 's'}`,
            severity: 'error',
            rule,
            value: value.length,
            expected: `array with length >= ${min}`,
            field: fieldContext,
          })
        }
        break
      }

      case 'max': {
        const max = rule.constraint as number
        if (typeof value === 'string' && value.length > max) {
          issues.push({
            path,
            message: `Must be at most ${max} characters (currently ${value.length})`,
            severity: 'error',
            rule,
            value,
            expected: `string with length <= ${max}`,
            field: fieldContext,
            suggestions: [`Remove ${value.length - max} character${value.length - max === 1 ? '' : 's'}`],
          })
        } else if (typeof value === 'number' && value > max) {
          issues.push({
            path,
            message: `Must be at most ${max}`,
            severity: 'error',
            rule,
            value,
            expected: `number <= ${max}`,
            field: fieldContext,
          })
        } else if (Array.isArray(value) && value.length > max) {
          issues.push({
            path,
            message: `Must have at most ${max} item${max === 1 ? '' : 's'} (currently ${value.length})`,
            severity: 'error',
            rule,
            value: value.length,
            expected: `array with length <= ${max}`,
            field: fieldContext,
          })
        }
        break
      }

      case 'length': {
        const constraint = rule.constraint as { min?: number; max?: number }
        if (typeof value === 'string') {
          if (constraint.min !== undefined && value.length < constraint.min) {
            issues.push({
              path,
              message: `Must be at least ${constraint.min} characters`,
              severity: 'error',
              rule,
              value,
              field: fieldContext,
            })
          }
          if (constraint.max !== undefined && value.length > constraint.max) {
            issues.push({
              path,
              message: `Must be at most ${constraint.max} characters`,
              severity: 'error',
              rule,
              value,
              field: fieldContext,
            })
          }
        }
        break
      }

      case 'regex': {
        const constraint = rule.constraint as { pattern: string; name?: string }
        if (typeof value === 'string' && constraint.pattern) {
          try {
            const regex = new RegExp(constraint.pattern)
            if (!regex.test(value)) {
              issues.push({
                path,
                message: constraint.name
                  ? `Does not match ${constraint.name} format`
                  : `Does not match required pattern`,
                severity: 'error',
                rule,
                value,
                expected: constraint.name || constraint.pattern,
                field: fieldContext,
              })
            }
          } catch {
            // Invalid regex, skip
          }
        }
        break
      }

      case 'email': {
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          issues.push({
            path,
            message: `Invalid email address`,
            severity: 'error',
            rule,
            value,
            expected: 'valid email address',
            field: fieldContext,
            suggestions: [`Use format: user@example.com`],
          })
        }
        break
      }

      case 'uri': {
        if (typeof value === 'string') {
          try {
            new URL(value)
          } catch {
            issues.push({
              path,
              message: `Invalid URL`,
              severity: 'error',
              rule,
              value,
              expected: 'valid URL',
              field: fieldContext,
            })
          }
        }
        break
      }

      case 'unique': {
        // Unique validation requires context we don't have here
        // This would need to be handled at a higher level
        break
      }

      case 'custom': {
        // Custom validation can't be evaluated - it's a JS function
        // We note this as info
        issues.push({
          path,
          message: `Has custom validation that cannot be evaluated`,
          severity: 'info',
          rule,
          field: fieldContext,
        })
        break
      }
    }
  }

  return issues
}

/**
 * Format validation issues for display in a terminal or log.
 */
export function formatValidationIssues(result: ValidationResult): string {
  const lines: string[] = []

  lines.push(result.summary)
  lines.push('')

  for (const issue of result.issues) {
    const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ'
    lines.push(`${icon} ${issue.path}: ${issue.message}`)
    if (issue.suggestions && issue.suggestions.length > 0) {
      lines.push(`  → ${issue.suggestions[0]}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format validation issues as a structured object for agent consumption.
 */
export function formatValidationForAgent(result: ValidationResult): {
  valid: boolean
  summary: string
  errorCount: number
  errors: Array<{
    path: string
    message: string
    suggestion?: string
    expected?: string
  }>
} {
  return {
    valid: result.valid,
    summary: result.summary,
    errorCount: result.errors.length,
    errors: result.errors.map((e) => ({
      path: e.path,
      message: e.message,
      suggestion: e.suggestions?.[0],
      expected: e.expected,
    })),
  }
}
