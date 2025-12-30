import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchemaClient, SchemaClientError } from './client.js'
import type { StoredWorkspaceSchema } from './types.js'

// Mock Sanity client
function createMockClient(overrides: Partial<{
  config: () => { projectId?: string; dataset?: string }
  request: <T>(options: { method: string; url: string; body?: unknown }) => Promise<T>
}> = {}) {
  return {
    config: () => ({
      projectId: 'test-project',
      dataset: 'test-dataset',
    }),
    request: vi.fn(),
    ...overrides,
  } as any
}

const mockStoredSchema: StoredWorkspaceSchema = {
  _type: 'system.schema',
  _id: '_.schemas.default',
  _createdAt: '2025-01-01T00:00:00Z',
  _updatedAt: '2025-01-01T00:00:00Z',
  _rev: 'abc123',
  version: '2025-05-01',
  workspace: {
    name: 'default',
    title: 'Default Workspace',
  },
  schema: JSON.stringify([
    {
      type: 'document',
      name: 'article',
      title: 'Article',
      fields: [
        { type: 'string', name: 'title', title: 'Title' },
      ],
    },
    {
      type: 'object',
      name: 'seo',
      title: 'SEO',
      fields: [],
    },
  ]),
}

describe('SchemaClient', () => {
  describe('constructor', () => {
    it('throws if projectId is missing', () => {
      const mockClient = createMockClient({
        config: () => ({ projectId: undefined, dataset: 'test' }),
      })

      expect(() => new SchemaClient(mockClient)).toThrow('projectId is required')
    })

    it('throws if dataset is missing', () => {
      const mockClient = createMockClient({
        config: () => ({ projectId: 'test', dataset: undefined }),
      })

      expect(() => new SchemaClient(mockClient)).toThrow('dataset is required')
    })

    it('creates client with valid config', () => {
      const mockClient = createMockClient()
      const schemaClient = new SchemaClient(mockClient)
      expect(schemaClient).toBeInstanceOf(SchemaClient)
    })
  })

  describe('list', () => {
    it('fetches all schemas', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue([mockStoredSchema])

      const schemaClient = new SchemaClient(mockClient)
      const schemas = await schemaClient.list()

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/projects/test-project/datasets/test-dataset/schemas',
      })
      expect(schemas).toHaveLength(1)
      expect(schemas[0]?._id).toBe('_.schemas.default')
    })

    it('wraps errors', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockRejectedValue(new Error('Network error'))

      const schemaClient = new SchemaClient(mockClient)

      await expect(schemaClient.list()).rejects.toThrow(SchemaClientError)
      await expect(schemaClient.list()).rejects.toThrow('Failed to list schemas')
    })
  })

  describe('get', () => {
    it('fetches default workspace schema', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      const schema = await schemaClient.get()

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/projects/test-project/datasets/test-dataset/schemas/_.schemas.default',
      })
      expect(schema?._id).toBe('_.schemas.default')
    })

    it('fetches specific workspace schema', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      await schemaClient.get({ workspace: 'staging' })

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/projects/test-project/datasets/test-dataset/schemas/_.schemas.staging',
      })
    })

    it('fetches tagged schema', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      await schemaClient.get({ workspace: 'default', tag: 'v1' })

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/projects/test-project/datasets/test-dataset/schemas/_.schemas.default.v1',
      })
    })

    it('returns null for 404', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockRejectedValue({ statusCode: 404 })

      const schemaClient = new SchemaClient(mockClient)
      const schema = await schemaClient.get()

      expect(schema).toBeNull()
    })
  })

  describe('getTypes', () => {
    it('parses schema types from JSON string', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      const types = await schemaClient.getTypes()

      expect(types).toHaveLength(2)
      expect(types[0]?.name).toBe('article')
      expect(types[0]?.type).toBe('document')
      expect(types[1]?.name).toBe('seo')
    })

    it('returns empty array if no schema found', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockRejectedValue({ statusCode: 404 })

      const schemaClient = new SchemaClient(mockClient)
      const types = await schemaClient.getTypes()

      expect(types).toEqual([])
    })
  })

  describe('getDocumentTypes', () => {
    it('returns only document types', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      const docTypes = await schemaClient.getDocumentTypes()

      expect(docTypes).toHaveLength(1)
      expect(docTypes[0]?.name).toBe('article')
      expect(docTypes[0]?.type).toBe('document')
    })
  })

  describe('getObjectTypes', () => {
    it('returns only object types', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      const objectTypes = await schemaClient.getObjectTypes()

      expect(objectTypes).toHaveLength(1)
      expect(objectTypes[0]?.name).toBe('seo')
      expect(objectTypes[0]?.type).toBe('object')
    })
  })

  describe('getType', () => {
    it('finds type by name', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      const articleType = await schemaClient.getType('article')

      expect(articleType?.name).toBe('article')
      expect(articleType?.fields).toHaveLength(1)
    })

    it('returns null for unknown type', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(mockStoredSchema)

      const schemaClient = new SchemaClient(mockClient)
      const unknownType = await schemaClient.getType('nonexistent')

      expect(unknownType).toBeNull()
    })
  })

  describe('deploy', () => {
    it('deploys schemas', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue([mockStoredSchema])

      const schemaClient = new SchemaClient(mockClient)
      const result = await schemaClient.deploy([{
        workspace: { name: 'default', title: 'Default' },
        schema: [{ type: 'document', name: 'article' }],
      }])

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/projects/test-project/datasets/test-dataset/schemas',
        body: {
          schemas: [{
            version: '2025-05-01',
            tag: undefined,
            workspace: { name: 'default', title: 'Default' },
            schema: [{ type: 'document', name: 'article' }],
          }],
        },
      })
      expect(result).toHaveLength(1)
    })
  })

  describe('delete', () => {
    it('deletes schemas by ID', async () => {
      const mockClient = createMockClient()
      mockClient.request.mockResolvedValue(undefined)

      const schemaClient = new SchemaClient(mockClient)
      await schemaClient.delete(['_.schemas.default'])

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/projects/test-project/datasets/test-dataset/schemas',
        body: { ids: ['_.schemas.default'] },
      })
    })
  })
})

describe('SchemaClientError', () => {
  it('captures status code and response', () => {
    const error = new SchemaClientError('Test error', 401, { message: 'Unauthorized' })

    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(401)
    expect(error.response).toEqual({ message: 'Unauthorized' })
    expect(error.name).toBe('SchemaClientError')
  })
})
