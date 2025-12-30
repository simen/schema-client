import type { SanityClient } from '@sanity/client'
import type {
  StoredWorkspaceSchema,
  ParsedWorkspaceSchema,
  ManifestSchemaType,
  SchemaClientConfig,
  GetSchemaOptions,
  DeploySchemaInput,
} from './types.js'

/** Default API version for schema operations */
const DEFAULT_API_VERSION = '2025-03-01'

/**
 * Error thrown when schema operations fail.
 */
export class SchemaClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message)
    this.name = 'SchemaClientError'
  }
}

/**
 * Client for working with Sanity server-side deployed schemas.
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
 * const types = await schemaClient.getTypes()
 * ```
 */
export class SchemaClient {
  private client: SanityClient
  private projectId: string
  private dataset: string

  constructor(client: SanityClient) {
    this.client = client
    const config = client.config()

    if (!config.projectId) {
      throw new SchemaClientError('projectId is required in client configuration')
    }
    if (!config.dataset) {
      throw new SchemaClientError('dataset is required in client configuration')
    }

    this.projectId = config.projectId
    this.dataset = config.dataset
  }

  /**
   * List all deployed schemas for this project/dataset.
   *
   * @returns Array of stored workspace schemas (with stringified schema field)
   *
   * @example
   * ```ts
   * const schemas = await schemaClient.list()
   * console.log(schemas.map(s => s.workspace.name))
   * ```
   */
  async list(): Promise<StoredWorkspaceSchema[]> {
    try {
      const schemas = await this.client.request<StoredWorkspaceSchema[]>({
        method: 'GET',
        url: `/projects/${this.projectId}/datasets/${this.dataset}/schemas`,
      })
      return schemas
    } catch (error) {
      throw this.wrapError(error, 'Failed to list schemas')
    }
  }

  /**
   * Get a specific schema by workspace name and optional tag.
   *
   * @param options - Options for fetching the schema
   * @returns The stored workspace schema, or null if not found
   *
   * @example
   * ```ts
   * // Get default workspace schema
   * const schema = await schemaClient.get()
   *
   * // Get specific workspace
   * const stagingSchema = await schemaClient.get({ workspace: 'staging' })
   *
   * // Get tagged version
   * const v1Schema = await schemaClient.get({ workspace: 'default', tag: 'v1' })
   * ```
   */
  async get(options: GetSchemaOptions = {}): Promise<StoredWorkspaceSchema | null> {
    const { workspace = 'default', tag } = options
    const schemaId = tag
      ? `_.schemas.${workspace}.${tag}`
      : `_.schemas.${workspace}`

    try {
      const response = await this.client.request<StoredWorkspaceSchema | StoredWorkspaceSchema[]>({
        method: 'GET',
        url: `/projects/${this.projectId}/datasets/${this.dataset}/schemas/${schemaId}`,
      })
      // Handle both array and object responses (API may return either)
      if (Array.isArray(response)) {
        // Find matching schema by workspace name, or return first if only one
        const match = response.find((s) => s.workspace?.name === workspace)
        return match ?? response[0] ?? null
      }
      return response
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return null
      }
      throw this.wrapError(error, `Failed to get schema '${schemaId}'`)
    }
  }

  /**
   * Get a schema with the schema field already parsed.
   *
   * @param options - Options for fetching the schema
   * @returns The parsed workspace schema, or null if not found
   */
  async getParsed(options: GetSchemaOptions = {}): Promise<ParsedWorkspaceSchema | null> {
    const stored = await this.get(options)
    if (!stored) return null

    return {
      ...stored,
      schema: this.parseSchemaTypes(stored.schema),
    }
  }

  /**
   * Get all schema types from the default workspace.
   *
   * This is a convenience method that fetches the schema and parses the types.
   *
   * @param options - Options for fetching the schema
   * @returns Array of parsed schema types
   *
   * @example
   * ```ts
   * const types = await schemaClient.getTypes()
   * const documentTypes = types.filter(t => t.type === 'document')
   * ```
   */
  async getTypes(options: GetSchemaOptions = {}): Promise<ManifestSchemaType[]> {
    const schema = await this.get(options)
    if (!schema) {
      return []
    }
    return this.parseSchemaTypes(schema.schema)
  }

  /**
   * Get only document types from the schema.
   *
   * @param options - Options for fetching the schema
   * @returns Array of document type definitions
   *
   * @example
   * ```ts
   * const documentTypes = await schemaClient.getDocumentTypes()
   * console.log(documentTypes.map(t => t.name))
   * // ['article', 'author', 'category', ...]
   * ```
   */
  async getDocumentTypes(options: GetSchemaOptions = {}): Promise<ManifestSchemaType[]> {
    const types = await this.getTypes(options)
    return types.filter((t) => t.type === 'document')
  }

  /**
   * Get only object types from the schema.
   *
   * @param options - Options for fetching the schema
   * @returns Array of object type definitions
   */
  async getObjectTypes(options: GetSchemaOptions = {}): Promise<ManifestSchemaType[]> {
    const types = await this.getTypes(options)
    return types.filter((t) => t.type === 'object')
  }

  /**
   * Get a specific type by name.
   *
   * @param typeName - The name of the type to find
   * @param options - Options for fetching the schema
   * @returns The type definition, or null if not found
   *
   * @example
   * ```ts
   * const articleType = await schemaClient.getType('article')
   * if (articleType) {
   *   console.log(articleType.fields?.map(f => f.name))
   * }
   * ```
   */
  async getType(
    typeName: string,
    options: GetSchemaOptions = {}
  ): Promise<ManifestSchemaType | null> {
    const types = await this.getTypes(options)
    return types.find((t) => t.name === typeName) ?? null
  }

  /**
   * Deploy schemas to the server.
   *
   * Note: This requires the `deployStudio` permission, typically only available
   * to Administrator or Deploy Studio roles.
   *
   * @param schemas - Array of schemas to deploy
   * @returns The deployed schemas
   *
   * @example
   * ```ts
   * await schemaClient.deploy([{
   *   workspace: { name: 'default', title: 'My Studio' },
   *   schema: mySchemaTypes,
   * }])
   * ```
   */
  async deploy(schemas: DeploySchemaInput[]): Promise<StoredWorkspaceSchema[]> {
    const payload = {
      schemas: schemas.map((s) => ({
        version: s.version ?? '2025-05-01',
        tag: s.tag,
        workspace: s.workspace,
        schema: s.schema,
      })),
    }

    try {
      const result = await this.client.request<StoredWorkspaceSchema[]>({
        method: 'PUT',
        url: `/projects/${this.projectId}/datasets/${this.dataset}/schemas`,
        body: payload,
      })
      return result
    } catch (error) {
      throw this.wrapError(error, 'Failed to deploy schemas')
    }
  }

  /**
   * Delete schemas by ID.
   *
   * @param schemaIds - Array of schema IDs to delete
   *
   * @example
   * ```ts
   * await schemaClient.delete(['_.schemas.default', '_.schemas.staging'])
   * ```
   */
  async delete(schemaIds: string[]): Promise<void> {
    try {
      await this.client.request({
        method: 'DELETE',
        url: `/projects/${this.projectId}/datasets/${this.dataset}/schemas`,
        body: { ids: schemaIds },
      })
    } catch (error) {
      throw this.wrapError(error, 'Failed to delete schemas')
    }
  }

  /**
   * Parse the stringified schema JSON into typed objects.
   */
  private parseSchemaTypes(schemaJson: string): ManifestSchemaType[] {
    // Handle empty/undefined schema field gracefully
    if (!schemaJson) {
      return []
    }
    try {
      const parsed = JSON.parse(schemaJson)
      if (!Array.isArray(parsed)) {
        throw new SchemaClientError('Schema is not an array')
      }
      return parsed as ManifestSchemaType[]
    } catch (error) {
      if (error instanceof SchemaClientError) throw error
      throw new SchemaClientError(`Failed to parse schema JSON: ${error}`)
    }
  }

  /**
   * Check if an error is a 404 Not Found response.
   */
  private isNotFoundError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as { statusCode: number }).statusCode === 404
    )
  }

  /**
   * Wrap an error with additional context.
   */
  private wrapError(error: unknown, message: string): SchemaClientError {
    if (error instanceof SchemaClientError) {
      return error
    }

    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : undefined

    const errorMessage =
      error instanceof Error ? error.message : String(error)

    return new SchemaClientError(
      `${message}: ${errorMessage}`,
      statusCode,
      error
    )
  }
}

/**
 * Create a SchemaClient from configuration options.
 *
 * This is a convenience function that creates both the Sanity client
 * and the SchemaClient in one step.
 *
 * @param config - Configuration options
 * @param createSanityClient - The createClient function from @sanity/client
 * @returns A configured SchemaClient instance
 *
 * @example
 * ```ts
 * import { createClient } from '@sanity/client'
 * import { createSchemaClient } from '@sanity/schema-client'
 *
 * const schemaClient = createSchemaClient({
 *   projectId: 'your-project-id',
 *   dataset: 'production',
 *   token: 'your-token',
 * }, createClient)
 * ```
 */
export function createSchemaClient(
  config: SchemaClientConfig,
  createSanityClient: (config: {
    projectId: string
    dataset: string
    token?: string
    apiVersion: string
    apiHost?: string
    useCdn: boolean
  }) => SanityClient
): SchemaClient {
  const sanityClient = createSanityClient({
    projectId: config.projectId,
    dataset: config.dataset,
    token: config.token,
    apiVersion: config.apiVersion ?? DEFAULT_API_VERSION,
    apiHost: config.apiHost,
    useCdn: config.useCdn ?? false,
  })

  return new SchemaClient(sanityClient)
}
