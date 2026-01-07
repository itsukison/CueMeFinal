import { SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface QnACollection {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  qna_count?: number
}

export interface QnAItem {
  id: string
  collection_id: string
  question: string
  answer: string
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface SearchResult {
  id: string
  question: string
  answer: string
  tags: string[]
  similarity: number
}

export class QnAService {
  private supabase: SupabaseClient
  private genAI: GoogleGenerativeAI
  private geminiApiKey: string

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient

    // Initialize Gemini client for embeddings
    this.geminiApiKey = process.env.GEMINI_API_KEY || ''

    if (!this.geminiApiKey) {
      console.error('[QnAService] Missing Gemini API key - embeddings will not work')
      console.warn('[QnAService] Q&A search functionality requires GEMINI_API_KEY for embeddings')
    }

    this.genAI = new GoogleGenerativeAI(this.geminiApiKey || 'placeholder-key')

    console.log('[QnAService] Initialized with Gemini embeddings (768 dimensions)')
  }

  private normalizeJapaneseText(text: string): string {
    return text
      // Normalize full-width to half-width numbers
      .replace(/[０-９]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0xFEE0))
      // Normalize full-width to half-width ASCII
      .replace(/[Ａ-Ｚａ-ｚ]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0xFEE0))
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.geminiApiKey) {
        throw new Error('Gemini API key not configured in QnAService')
      }

      // Normalize Japanese text for better embedding quality
      const normalizedText = this.normalizeJapaneseText(text)

      // Use Gemini's text embedding model (768 dimensions)
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' })

      const result = await model.embedContent(normalizedText.replace(/\n/g, ' '))

      return result.embedding.values
    } catch (error) {
      console.error('[QnAService] Error generating Gemini embedding:', error)
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async getUserCollections(userId: string): Promise<QnACollection[]> {
    try {
      const { data, error } = await this.supabase
        .from('qna_collections')
        .select(`
          *,
          qna_items(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const collectionsWithCount = data?.map(collection => ({
        ...collection,
        qna_count: collection.qna_items?.[0]?.count || 0
      })) || []

      return collectionsWithCount
    } catch (error) {
      console.error('Error fetching collections:', error)
      throw error
    }
  }

  public async getCollection(collectionId: string): Promise<QnACollection | null> {
    try {
      const { data, error } = await this.supabase
        .from('qna_collections')
        .select('*')
        .eq('id', collectionId)
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error fetching collection:', error)
      return null
    }
  }

  public async getCollectionItems(collectionId: string): Promise<QnAItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('qna_items')
        .select('*')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching collection items:', error)
      throw error
    }
  }

  public async searchQnAItems(
    query: string,
    collectionId: string,
    matchThreshold: number = 0.8,
    matchCount: number = 5
  ): Promise<SearchResult[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query)
      
      // Use the Postgres function for vector similarity search
      const { data, error } = await this.supabase.rpc('search_qna_items', {
        query_embedding: queryEmbedding,
        collection_id_filter: collectionId,
        match_threshold: matchThreshold,
        match_count: matchCount
      })

      if (error) {
        console.error('Search error:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error searching QnA items:', error)
      throw error
    }
  }

  public async findRelevantAnswers(
    question: string,
    collectionId: string,
    threshold: number = 0.7
  ): Promise<{
    hasRelevantAnswers: boolean
    answers: SearchResult[]
    bestMatch?: SearchResult
  }> {
    try {
      const results = await this.searchQnAItems(question, collectionId, threshold, 3)
      
      const hasRelevantAnswers = results.length > 0
      const bestMatch = results.length > 0 ? results[0] : undefined
      
      return {
        hasRelevantAnswers,
        answers: results,
        bestMatch
      }
    } catch (error) {
      console.error('Error finding relevant answers:', error)
      return {
        hasRelevantAnswers: false,
        answers: []
      }
    }
  }

  public formatRAGContext(results: SearchResult[]): string {
    if (results.length === 0) return ''
    
    const context = results
      .map((result, index) => {
        return `Context ${index + 1} (similarity: ${result.similarity.toFixed(2)}):\nQ: ${result.question}\nA: ${result.answer}`
      })
      .join('\n\n---\n\n')
      
    return `Based on the following relevant information from your knowledge base:\n\n${context}\n\nPlease provide a comprehensive answer:`
  }

  public async createCollection(
    userId: string,
    name: string,
    description?: string
  ): Promise<QnACollection> {
    try {
      const { data, error } = await this.supabase
        .from('qna_collections')
        .insert({
          user_id: userId,
          name,
          description
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error creating collection:', error)
      throw error
    }
  }

  public async addQnAItem(
    collectionId: string,
    question: string,
    answer: string,
    tags?: string[]
  ): Promise<QnAItem> {
    try {
      // Generate embedding for the question
      const embedding = await this.generateEmbedding(question)

      const { data, error } = await this.supabase
        .from('qna_items')
        .insert({
          collection_id: collectionId,
          question,
          answer,
          tags,
          embedding
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error adding QnA item:', error)
      throw error
    }
  }

  public async updateQnAItem(
    itemId: string,
    updates: {
      question?: string
      answer?: string
      tags?: string[]
    }
  ): Promise<QnAItem> {
    try {
      let updateData: any = { ...updates }

      // If question is being updated, regenerate embedding
      if (updates.question) {
        updateData.embedding = await this.generateEmbedding(updates.question)
      }

      const { data, error } = await this.supabase
        .from('qna_items')
        .update(updateData)
        .eq('id', itemId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error updating QnA item:', error)
      throw error
    }
  }

  public async deleteQnAItem(itemId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('qna_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error deleting QnA item:', error)
      return false
    }
  }

  public async deleteCollection(collectionId: string): Promise<boolean> {
    try {
      // First delete all items in the collection
      await this.supabase
        .from('qna_items')
        .delete()
        .eq('collection_id', collectionId)

      // Then delete the collection
      const { error } = await this.supabase
        .from('qna_collections')
        .delete()
        .eq('id', collectionId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error deleting collection:', error)
      return false
    }
  }
}