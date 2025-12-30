import { describe, it, expect } from 'vitest'
import type { ManifestSchemaType } from './types.js'
import {
  validateDocument,
  formatValidationIssues,
  formatValidationForAgent,
} from './validation.js'

// Test schema
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
      validation: [
        {
          rules: [
            { flag: 'min', constraint: 10 },
            { flag: 'max', constraint: 500 },
          ],
        },
      ],
    },
    {
      type: 'slug',
      name: 'slug',
      title: 'Slug',
      validation: [
        { rules: [{ flag: 'presence', constraint: 'required' }] },
      ],
    },
    {
      type: 'number',
      name: 'rating',
      title: 'Rating',
      validation: [
        {
          rules: [
            { flag: 'min', constraint: 1 },
            { flag: 'max', constraint: 5 },
          ],
        },
      ],
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
      name: 'email',
      title: 'Email',
      validation: [
        { rules: [{ flag: 'email' }] },
      ],
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
      validation: [
        { rules: [{ flag: 'min', constraint: 1 }] },
      ],
    },
    {
      type: 'image',
      name: 'mainImage',
      title: 'Main Image',
      fields: [
        {
          type: 'string',
          name: 'alt',
          title: 'Alt Text',
          validation: [
            { rules: [{ flag: 'presence', constraint: 'required' }] },
          ],
        },
      ],
    },
  ],
}

const allTypes: ManifestSchemaType[] = [articleType]

describe('validateDocument', () => {
  describe('basic validation', () => {
    it('validates a correct document', () => {
      const doc = {
        _type: 'article',
        _id: 'article-1',
        title: 'Hello World',
        slug: { current: 'hello-world' },
        tags: ['news'],
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('reports missing _type', () => {
      const doc = {
        title: 'Hello',
      }

      const result = validateDocument(doc as any, articleType, allTypes)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.path === '_type')).toBe(true)
    })

    it('reports wrong _type', () => {
      const doc = {
        _type: 'post',
        title: 'Hello',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.path === '_type' && e.message.includes('does not match'))).toBe(true)
    })
  })

  describe('required fields', () => {
    it('reports missing required field', () => {
      const doc = {
        _type: 'article',
        description: 'Some description here',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.path === 'title' && e.message.includes('required'))).toBe(true)
      expect(result.errors.some(e => e.path === 'slug' && e.message.includes('required'))).toBe(true)
    })
  })

  describe('string validation', () => {
    it('validates max length', () => {
      const doc = {
        _type: 'article',
        title: 'x'.repeat(101),
        slug: { current: 'test' },
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const titleError = result.errors.find(e => e.path === 'title')
      expect(titleError?.message).toContain('at most 100')
    })

    it('validates min length', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        description: 'Short',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const descError = result.errors.find(e => e.path === 'description')
      expect(descError?.message).toContain('at least 10')
    })

    it('validates list options', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        status: 'invalid-status',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const statusError = result.errors.find(e => e.path === 'status')
      expect(statusError?.message).toContain('not a valid option')
      expect(statusError?.suggestions).toBeDefined()
    })

    it('validates email format', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        email: 'not-an-email',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const emailError = result.errors.find(e => e.path === 'email')
      expect(emailError?.message).toContain('Invalid email')
    })
  })

  describe('number validation', () => {
    it('validates type', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        rating: 'five',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const ratingError = result.errors.find(e => e.path === 'rating')
      expect(ratingError?.message).toContain('Expected number')
    })

    it('validates min value', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        rating: 0,
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const ratingError = result.errors.find(e => e.path === 'rating')
      expect(ratingError?.message).toContain('at least 1')
    })

    it('validates max value', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        rating: 10,
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const ratingError = result.errors.find(e => e.path === 'rating')
      expect(ratingError?.message).toContain('at most 5')
    })
  })

  describe('slug validation', () => {
    it('validates slug format', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'Hello World!' },
      }

      const result = validateDocument(doc, articleType, allTypes, { includeWarnings: true })

      // Slug format is a warning, not an error
      const slugWarning = result.warnings.find(w => w.path === 'slug.current')
      expect(slugWarning?.message).toContain('invalid characters')
      expect(slugWarning?.suggestions?.[0]).toBeDefined()
    })

    it('reports missing slug.current', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: {},
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const slugError = result.errors.find(e => e.path === 'slug.current')
      expect(slugError?.message).toContain('missing current')
    })
  })

  describe('reference validation', () => {
    it('validates reference structure', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        author: 'not-a-reference',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const refError = result.errors.find(e => e.path === 'author')
      expect(refError?.message).toContain('Expected reference object')
    })

    it('validates reference _ref', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        author: { _type: 'reference' },
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const refError = result.errors.find(e => e.path === 'author._ref')
      expect(refError?.message).toContain('missing _ref')
    })
  })

  describe('array validation', () => {
    it('validates array type', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        tags: 'not-an-array',
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const tagsError = result.errors.find(e => e.path === 'tags')
      expect(tagsError?.message).toContain('Expected array')
    })

    it('validates array min length', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        tags: [],
      }

      const result = validateDocument(doc, articleType, allTypes)

      expect(result.valid).toBe(false)
      const tagsError = result.errors.find(e => e.path === 'tags')
      expect(tagsError?.message).toContain('at least 1')
    })
  })

  describe('image validation', () => {
    it('validates image structure', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        mainImage: { asset: { _ref: 'image-123' } },
      }

      const result = validateDocument(doc, articleType, allTypes)

      // Image is valid but missing required alt field
      expect(result.valid).toBe(false)
      const altError = result.errors.find(e => e.path === 'mainImage.alt')
      expect(altError?.message).toContain('required')
    })

    it('validates complete image', () => {
      const doc = {
        _type: 'article',
        title: 'Hello',
        slug: { current: 'test' },
        mainImage: {
          asset: { _ref: 'image-123' },
          alt: 'Description of image',
        },
      }

      const result = validateDocument(doc, articleType, allTypes)

      // No image-related errors
      expect(result.errors.filter(e => e.path.startsWith('mainImage'))).toHaveLength(0)
    })
  })
})

describe('formatValidationIssues', () => {
  it('formats valid result', () => {
    const result = validateDocument(
      { _type: 'article', title: 'Hi', slug: { current: 'hi' }, tags: ['a'] },
      articleType,
      allTypes
    )

    const formatted = formatValidationIssues(result)

    expect(formatted).toContain('Document is valid')
  })

  it('formats errors with paths', () => {
    const result = validateDocument(
      { _type: 'article' },
      articleType,
      allTypes
    )

    const formatted = formatValidationIssues(result)

    expect(formatted).toContain('✗')
    expect(formatted).toContain('title')
    expect(formatted).toContain('slug')
  })
})

describe('formatValidationForAgent', () => {
  it('returns structured data for agents', () => {
    const result = validateDocument(
      { _type: 'article' },
      articleType,
      allTypes
    )

    const agentFormat = formatValidationForAgent(result)

    expect(agentFormat.valid).toBe(false)
    expect(agentFormat.errorCount).toBeGreaterThan(0)
    expect(agentFormat.errors[0]).toHaveProperty('path')
    expect(agentFormat.errors[0]).toHaveProperty('message')
  })

  it('includes suggestions', () => {
    const result = validateDocument(
      { _type: 'article', status: 'invalid' },
      articleType,
      allTypes
    )

    const agentFormat = formatValidationForAgent(result)

    const statusError = agentFormat.errors.find(e => e.path === 'status')
    expect(statusError?.suggestion).toBeDefined()
  })
})
