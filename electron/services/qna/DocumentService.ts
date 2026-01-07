import { SupabaseClient } from '@supabase/supabase-js'

export interface Document {
  id: string
  display_name: string
  file_name: string
  file_size?: number
  file_type?: string
  status: string
  chunk_count?: number
  collection_id?: string
  collection_name?: string
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  char_start: number
  char_end: number
  similarity: number
}

export interface DocumentSearchResult {
  chunks: DocumentChunk[]
  hasRelevantContent: boolean
  topSimilarity: number
  context: string  // Formatted context from chunks
}

export class DocumentService {
  private supabase: SupabaseClient
  private webApiUrl: string

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient

    // Web API URL for document operations
    this.webApiUrl = process.env.WEB_API_URL || 'https://www.cueme.ink'

    console.log('[DocumentService] Initialized with Supabase pgvector support')
    console.log('[DocumentService] Web API URL:', this.webApiUrl)
  }


  public async getUserDocuments(userId: string): Promise<Document[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select(`
          id,
          display_name,
          original_file_name,
          file_size,
          file_type,
          status,
          chunk_count,
          collection_id,
          created_at,
          qna_collections (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform to match Document interface
      const documents: Document[] = (data || []).map(file => ({
        id: file.id,
        display_name: file.display_name,
        file_name: file.original_file_name,
        file_size: file.file_size,
        file_type: file.file_type,
        status: file.status,
        chunk_count: file.chunk_count,
        collection_id: file.collection_id,
        collection_name: Array.isArray(file.qna_collections)
          ? file.qna_collections[0]?.name
          : (file.qna_collections as any)?.name,
        created_at: file.created_at
      }))

      return documents
    } catch (error) {
      console.error('[DocumentService] Error fetching user documents:', error)
      throw error
    }
  }

  public async getDocument(documentId: string): Promise<Document | null> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select(`
          id,
          display_name,
          original_file_name,
          file_size,
          file_type,
          status,
          chunk_count,
          collection_id,
          created_at,
          qna_collections (
            id,
            name
          )
        `)
        .eq('id', documentId)
        .single()

      if (error) throw error

      if (!data) return null

      // Transform to match Document interface
      return {
        id: data.id,
        display_name: data.display_name,
        file_name: data.original_file_name,
        file_size: data.file_size,
        file_type: data.file_type,
        status: data.status,
        chunk_count: data.chunk_count,
        collection_id: data.collection_id,
        collection_name: Array.isArray(data.qna_collections)
          ? data.qna_collections[0]?.name
          : (data.qna_collections as any)?.name,
        created_at: data.created_at
      }
    } catch (error) {
      console.error('[DocumentService] Error fetching document:', error)
      return null
    }
  }

  /**
   * Query documents using vector similarity search
   * Returns relevant chunks with similarity scores
   */
  public async queryDocuments(
    collectionId: string,
    query: string,
    matchThreshold: number = 0.6,
    matchCount: number = 5
  ): Promise<DocumentSearchResult> {
    console.log('[DocumentService] ===== DOCUMENT QUERY START =====')
    console.log('[DocumentService] Query:', query.substring(0, 100) + (query.length > 100 ? '...' : ''))
    console.log('[DocumentService] CollectionId:', collectionId)
    console.log('[DocumentService] Threshold:', matchThreshold, 'MaxResults:', matchCount)

    try {
      // Get user's session for authentication
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession()

      console.log('[DocumentService] Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        sessionError: sessionError?.message
      })

      if (!session) {
        console.error('[DocumentService] No session available - authentication required')
        throw new Error('Authentication required')
      }

      console.log('[DocumentService] Making HTTP request to:', `${this.webApiUrl}/api/documents/query`)

      // Call new vector search endpoint
      const response = await fetch(`${this.webApiUrl}/api/documents/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          query,
          collectionId,
          matchThreshold,
          matchCount
        })
      })

      console.log('[DocumentService] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[DocumentService] API Error response:', errorData)
        throw new Error(errorData.error || 'Query failed')
      }

      const result = await response.json()

      console.log('[DocumentService] Query result:', {
        chunksFound: result.chunks?.length || 0,
        hasRelevantContent: result.hasRelevantContent,
        topSimilarity: result.topSimilarity?.toFixed(3)
      })
      console.log('[DocumentService] ===== DOCUMENT QUERY SUCCESS =====')

      // Format context from chunks
      const context = this.formatChunksAsContext(result.chunks || [])

      return {
        chunks: result.chunks || [],
        hasRelevantContent: result.hasRelevantContent,
        topSimilarity: result.topSimilarity,
        context
      }
    } catch (error) {
      console.error('[DocumentService] ===== DOCUMENT QUERY ERROR =====')
      console.error('[DocumentService] Error details:', error)
      throw error
    }
  }

  /**
   * Find relevant chunks for a question
   * Used by LLMHelper for RAG context
   */
  public async findRelevantChunks(
    question: string,
    collectionId: string,
    threshold: number = 0.6
  ): Promise<{
    hasRelevantChunks: boolean
    result?: DocumentSearchResult
  }> {
    try {
      const result = await this.queryDocuments(collectionId, question, threshold)

      console.log('[DocumentService] Relevance check:', {
        chunksFound: result.chunks.length,
        hasRelevantContent: result.hasRelevantContent,
        topSimilarity: result.topSimilarity
      })

      return {
        hasRelevantChunks: result.hasRelevantContent,
        result
      }
    } catch (error) {
      console.error('[DocumentService] Error finding relevant chunks:', error)
      return {
        hasRelevantChunks: false
      }
    }
  }

  /**
   * Format chunks into a context string for the LLM
   */
  private formatChunksAsContext(chunks: DocumentChunk[]): string {
    if (chunks.length === 0) return ''

    const contextParts = chunks.map((chunk, index) => {
      return `[Document ${index + 1}, Relevance: ${(chunk.similarity * 100).toFixed(0)}%]\n${chunk.content}`
    })

    return contextParts.join('\n\n---\n\n')
  }

  /**
   * Format result for RAG prompt (legacy compatibility)
   */
  public formatRAGContext(result: DocumentSearchResult): string {
    if (!result.hasRelevantContent || result.chunks.length === 0) return ''

    return `Based on relevant information from your documents:\n\n${result.context}\n\nPlease provide a comprehensive answer based on this information:`
  }
}