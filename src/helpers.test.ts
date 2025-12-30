import { describe, it, expect } from 'vitest'
import type { ManifestSchemaType, ManifestField } from './types.js'
import {
  isDocumentType,
  isObjectType,
  isArrayType,
  isReferenceType,
  isBlockType,
  isPrimitiveType,
  getFieldByName,
  getRequiredFields,
  getFieldsByFieldset,
  getVisibleFields,
  isFieldRequired,
  hasValidationRule,
  getValidationRules,
  getMinConstraint,
  getMaxConstraint,
  getReferenceTargetTypes,
  getArrayMemberTypes,
  getListOptions,
  hasListOptions,
  getSlugSource,
  hasHotspot,
  walkSchemaTypes,
  findTypeByName,
  getReferencedTypeNames,
} from './helpers.js'

// Test fixtures
const articleType: ManifestSchemaType = {
  type: 'document',
  name: 'article',
  title: 'Article',
  fields: [
    {
      type: 'string',
      name: 'title',
      title: 'Title',
      validation: [
        {
          rules: [
            { flag: 'presence', constraint: 'required' },
            { flag: 'max', constraint: 100 },
          ],
        },
      ],
    },
    {
      type: 'text',
      name: 'description',
      title: 'Description',
      rows: 3,
      fieldset: 'meta',
    },
    {
      type: 'slug',
      name: 'slug',
      title: 'Slug',
      options: { source: 'title' },
    },
    {
      type: 'reference',
      name: 'author',
      title: 'Author',
      to: [{ type: 'author' }, { type: 'person' }],
    },
    {
      type: 'array',
      name: 'tags',
      title: 'Tags',
      of: [{ type: 'string' }],
    },
    {
      type: 'image',
      name: 'mainImage',
      title: 'Main Image',
      options: { hotspot: true },
    },
    {
      type: 'string',
      name: 'status',
      title: 'Status',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
        ],
      },
    },
    {
      type: 'string',
      name: 'hiddenField',
      hidden: true,
    },
  ],
}

const objectType: ManifestSchemaType = {
  type: 'object',
  name: 'seo',
  title: 'SEO',
  fields: [
    { type: 'string', name: 'metaTitle', title: 'Meta Title' },
    { type: 'text', name: 'metaDescription', title: 'Meta Description' },
  ],
}

const blockType: ManifestSchemaType = {
  type: 'block',
  name: 'customBlock',
  marks: {
    decorators: [{ value: 'strong', title: 'Bold' }],
    annotations: [{ type: 'link' }],
  },
  styles: [{ value: 'normal', title: 'Normal' }],
}

describe('Type Guards', () => {
  it('isDocumentType', () => {
    expect(isDocumentType(articleType)).toBe(true)
    expect(isDocumentType(objectType)).toBe(false)
  })

  it('isObjectType', () => {
    expect(isObjectType(objectType)).toBe(true)
    expect(isObjectType(articleType)).toBe(false)
  })

  it('isArrayType', () => {
    const arrayField = articleType.fields?.find(f => f.name === 'tags')
    expect(isArrayType(arrayField!)).toBe(true)
    expect(isArrayType(articleType)).toBe(false)
  })

  it('isReferenceType', () => {
    const refField = articleType.fields?.find(f => f.name === 'author')
    expect(isReferenceType(refField!)).toBe(true)
    expect(isReferenceType(articleType)).toBe(false)
  })

  it('isBlockType', () => {
    expect(isBlockType(blockType)).toBe(true)
    expect(isBlockType(articleType)).toBe(false)
  })

  it('isPrimitiveType', () => {
    const titleField = articleType.fields?.find(f => f.name === 'title')
    expect(isPrimitiveType(titleField!)).toBe(true)
    expect(isPrimitiveType(articleType)).toBe(false)
  })
})

describe('Field Helpers', () => {
  it('getFieldByName', () => {
    const field = getFieldByName(articleType, 'title')
    expect(field?.name).toBe('title')
    expect(field?.type).toBe('string')

    expect(getFieldByName(articleType, 'nonexistent')).toBeUndefined()
  })

  it('getRequiredFields', () => {
    const required = getRequiredFields(articleType)
    expect(required.map(f => f.name)).toEqual(['title'])
  })

  it('getFieldsByFieldset', () => {
    const metaFields = getFieldsByFieldset(articleType, 'meta')
    expect(metaFields.map(f => f.name)).toEqual(['description'])
  })

  it('getVisibleFields', () => {
    const visible = getVisibleFields(articleType)
    expect(visible.some(f => f.name === 'hiddenField')).toBe(false)
    expect(visible.some(f => f.name === 'title')).toBe(true)
  })
})

describe('Validation Helpers', () => {
  it('isFieldRequired', () => {
    const titleField = getFieldByName(articleType, 'title')!
    const descField = getFieldByName(articleType, 'description')!

    expect(isFieldRequired(titleField)).toBe(true)
    expect(isFieldRequired(descField)).toBe(false)
  })

  it('hasValidationRule', () => {
    const titleField = getFieldByName(articleType, 'title')!

    expect(hasValidationRule(titleField, 'presence', 'required')).toBe(true)
    expect(hasValidationRule(titleField, 'max')).toBe(true)
    expect(hasValidationRule(titleField, 'min')).toBe(false)
  })

  it('getValidationRules', () => {
    const titleField = getFieldByName(articleType, 'title')!
    const rules = getValidationRules(titleField)

    expect(rules).toHaveLength(2)
    expect(rules.map(r => r.flag)).toContain('presence')
    expect(rules.map(r => r.flag)).toContain('max')
  })

  it('getMinConstraint / getMaxConstraint', () => {
    const titleField = getFieldByName(articleType, 'title')!

    expect(getMinConstraint(titleField)).toBeUndefined()
    expect(getMaxConstraint(titleField)).toBe(100)
  })
})

describe('Reference Helpers', () => {
  it('getReferenceTargetTypes', () => {
    const authorField = getFieldByName(articleType, 'author')!
    const targets = getReferenceTargetTypes(authorField)

    expect(targets).toEqual(['author', 'person'])
  })

  it('getReferenceTargetTypes returns empty for non-reference', () => {
    const titleField = getFieldByName(articleType, 'title')!
    expect(getReferenceTargetTypes(titleField)).toEqual([])
  })
})

describe('Array Helpers', () => {
  it('getArrayMemberTypes', () => {
    const tagsField = getFieldByName(articleType, 'tags')!
    const memberTypes = getArrayMemberTypes(tagsField)

    expect(memberTypes).toEqual(['string'])
  })

  it('getArrayMemberTypes returns empty for non-array', () => {
    const titleField = getFieldByName(articleType, 'title')!
    expect(getArrayMemberTypes(titleField)).toEqual([])
  })
})

describe('Options Helpers', () => {
  it('getListOptions', () => {
    const statusField = getFieldByName(articleType, 'status')!
    const options = getListOptions(statusField)

    expect(options).toEqual([
      { title: 'Draft', value: 'draft' },
      { title: 'Published', value: 'published' },
    ])
  })

  it('hasListOptions', () => {
    const statusField = getFieldByName(articleType, 'status')!
    const titleField = getFieldByName(articleType, 'title')!

    expect(hasListOptions(statusField)).toBe(true)
    expect(hasListOptions(titleField)).toBe(false)
  })

  it('getSlugSource', () => {
    const slugField = getFieldByName(articleType, 'slug')!
    expect(getSlugSource(slugField)).toBe('title')

    const titleField = getFieldByName(articleType, 'title')!
    expect(getSlugSource(titleField)).toBeUndefined()
  })

  it('hasHotspot', () => {
    const imageField = getFieldByName(articleType, 'mainImage')!
    const titleField = getFieldByName(articleType, 'title')!

    expect(hasHotspot(imageField)).toBe(true)
    expect(hasHotspot(titleField)).toBe(false)
  })
})

describe('Schema Traversal', () => {
  it('walkSchemaTypes visits all types and fields', () => {
    const visited: string[] = []
    walkSchemaTypes([articleType], (type, path) => {
      visited.push(path.join('.'))
    })

    expect(visited).toContain('article')
    expect(visited).toContain('article.title')
    expect(visited).toContain('article.author')
    expect(visited).toContain('article.tags')
  })

  it('findTypeByName', () => {
    const types = [articleType, objectType, blockType]

    expect(findTypeByName(types, 'article')?.name).toBe('article')
    expect(findTypeByName(types, 'seo')?.name).toBe('seo')
    expect(findTypeByName(types, 'nonexistent')).toBeUndefined()
  })

  it('getReferencedTypeNames', () => {
    const referenced = getReferencedTypeNames(articleType)

    expect(referenced).toContain('author')
    expect(referenced).toContain('person')
  })
})
