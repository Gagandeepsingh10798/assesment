/**
 * Google GenAI Service
 * Handles all interactions with Google Generative AI including
 * file search stores, file uploads, and chat generation
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

class GenAIService {
  constructor() {
    this.ai = null;
    this.fileSearchStoreId = null;
    this.isInitialized = false;
    this.initError = null;
  }

  /**
   * Initialize the GenAI client
   */
  async initialize() {
    if (!config.genai.apiKey) {
      console.warn('GOOGLE_API_KEY not configured - GenAI features disabled');
      return false;
    }

    try {
      this.ai = new GoogleGenAI({ apiKey: config.genai.apiKey });
      console.log('Google GenAI client initialized');

      // Initialize file search store
      await this.initializeFileSearchStore();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize GenAI service:', error.message);
      this.initError = error;
      return false;
    }
  }

  /**
   * Initialize or get existing file search store
   */
  async initializeFileSearchStore() {
    if (!this.ai || !this.ai.fileSearchStores) {
      console.log('File search stores not available');
      return null;
    }

    try {
      const storeName = config.genai.defaultFileSearchStore;
      
      // Try to list existing stores
      const stores = await this.ai.fileSearchStores.list();
      const storeList = [];
      
      // Handle different return formats
      if (stores && typeof stores[Symbol.asyncIterator] === 'function') {
        for await (const store of stores) {
          storeList.push(store);
        }
      } else if (Array.isArray(stores)) {
        storeList.push(...stores);
      }

      // Look for existing store with our name
      const existing = storeList.find(s => 
        s.displayName === storeName || s.name?.includes(storeName)
      );

      if (existing) {
        this.fileSearchStoreId = existing.name;
        console.log('Using existing file search store:', this.fileSearchStoreId);
        return this.fileSearchStoreId;
      }

      // Create new store
      const newStore = await this.ai.fileSearchStores.create({
        displayName: storeName,
      });
      
      this.fileSearchStoreId = newStore.name;
      console.log('Created new file search store:', this.fileSearchStoreId);
      return this.fileSearchStoreId;

    } catch (error) {
      console.error('Error initializing file search store:', error.message);
      return null;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      apiKeyConfigured: !!config.genai.apiKey,
      fileSearchStoreId: this.fileSearchStoreId,
      error: this.initError?.message || null,
    };
  }

  /**
   * List files in file search store
   */
  async listFiles() {
    if (!this.isInitialized || !this.fileSearchStoreId) {
      return {
        files: [],
        totalFiles: 0,
        source: 'not_initialized',
      };
    }

    try {
      const files = [];
      
      // Try different SDK methods to list documents
      try {
        // Method 1: Try with full store name
        let response;
        try {
          response = await this.ai.fileSearchStores.documents.list({ parent: this.fileSearchStoreId });
        } catch (e1) {
          // Method 2: Try with store name directly
          try {
            response = await this.ai.fileSearchStores.documents.list(this.fileSearchStoreId);
          } catch (e2) {
            // Method 3: Try getting the store first, then list
            try {
              const store = await this.ai.fileSearchStores.get({ name: this.fileSearchStoreId });
              if (store && store.files) {
                response = store.files;
              }
            } catch (e3) {
              console.log('All list methods failed, trying alternative...');
              // Return empty if all methods fail
              return {
                files: [],
                totalFiles: 0,
                source: 'genai_file_search_store',
                storeId: this.fileSearchStoreId,
                note: 'Document listing temporarily unavailable',
              };
            }
          }
        }
        
        if (response) {
          // Handle PagedAsyncIterable response
          if (typeof response[Symbol.asyncIterator] === 'function') {
            for await (const doc of response) {
              if (doc) {
                files.push(this.formatDocument(doc));
              }
            }
          } 
          // Handle array response
          else if (Array.isArray(response)) {
            for (const doc of response) {
              if (doc) {
                files.push(this.formatDocument(doc));
              }
            }
          }
          // Handle object with documents property
          else if (response.documents) {
            for (const doc of response.documents) {
              if (doc) {
                files.push(this.formatDocument(doc));
              }
            }
          }
        }
        
        console.log(`Listed ${files.length} files from store`);
      } catch (listError) {
        console.error('Error in documents.list:', listError.message);
      }

      return {
        files,
        totalFiles: files.length,
        source: 'genai_file_search_store',
        storeId: this.fileSearchStoreId,
      };
    } catch (error) {
      console.error('Error listing files:', error.message);
      return {
        files: [],
        totalFiles: 0,
        source: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Format document for response
   */
  formatDocument(doc) {
    return {
      name: doc.name || '',
      displayName: doc.displayName || doc.name?.split('/').pop() || 'Unknown',
      uploadedAt: doc.createTime || null,
      size: doc.sizeBytes || 0,
      mimeType: doc.mimeType || 'application/octet-stream',
    };
  }

  /**
   * Upload file to file search store
   */
  async uploadFile(filePath, fileName) {
    if (!this.isInitialized || !this.fileSearchStoreId) {
      throw new Error('GenAI service not initialized');
    }

    try {
      const mimeType = this.getMimeType(fileName);
      const fileStats = fs.statSync(filePath);

      console.log(`Uploading file: ${fileName}, size: ${fileStats.size}, mime: ${mimeType}`);
      console.log(`File search store: ${this.fileSearchStoreId}`);

      // Method 1: Try direct upload to file search store
      try {
        console.log('Method 1: Using uploadToFileSearchStore...');
        let operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
          file: filePath,
          fileSearchStoreName: this.fileSearchStoreId,
          config: {
            displayName: fileName,
          },
        });

        console.log('Upload operation started');

        // Wait until import is complete
        while (!operation.done) {
          console.log('Waiting for upload to complete...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await this.ai.operations.get({ operation });
        }

        console.log('Upload completed:', operation);
        const docName = operation?.documentName || operation?.response?.documentName || fileName;

        return {
          success: true,
          message: 'File uploaded to file search store',
          fileName: fileName,
          documentName: docName,
          storeId: this.fileSearchStoreId,
        };
      } catch (method1Error) {
        console.log('Method 1 failed:', method1Error.message);
        
        // Method 2: Upload to Files API first, then import
        console.log('Method 2: Using files.upload + importFile...');
        
        const sampleFile = await this.ai.files.upload({
          file: filePath,
          config: { displayName: fileName }
        });

        console.log('File uploaded to Files API:', sampleFile.name);

        // Import the file into the File Search store
        let operation = await this.ai.fileSearchStores.importFile({
          fileSearchStoreName: this.fileSearchStoreId,
          fileName: sampleFile.name
        });

        console.log('Import operation started');

        // Wait until import is complete
        while (!operation.done) {
          console.log('Waiting for import to complete...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await this.ai.operations.get({ operation: operation });
        }

        console.log('Import completed:', operation);
        const docName = operation?.documentName || operation?.response?.documentName || sampleFile.name;

        return {
          success: true,
          message: 'File uploaded and imported to file search store',
          fileName: fileName,
          documentName: docName,
          storeId: this.fileSearchStoreId,
        };
      }
    } catch (error) {
      console.error('Error uploading file:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Delete file from file search store
   */
  async deleteFile(documentName) {
    if (!this.isInitialized) {
      throw new Error('GenAI service not initialized');
    }

    try {
      console.log('Deleting document:', documentName);
      
      // Use fileSearchStores.documents.delete with force=true
      // This deletes the document and all its chunks
      // API: DELETE /v1beta/{name=fileSearchStores/*/documents/*}?force=true
      
      await this.ai.fileSearchStores.documents.delete({
        name: documentName,
        config: {
          force: true  // Delete even if document contains chunks
        }
      });
      
      console.log('Document deleted successfully');
      return {
        success: true,
        message: 'File deleted successfully',
        documentName,
      };
    } catch (error) {
      console.error('Error deleting file:', error.message);
      
      // Check for specific errors
      const errorMsg = error?.message || 'Unknown error';
      if (errorMsg.includes('non-empty Document') || errorMsg.includes('FAILED_PRECONDITION')) {
        return {
          success: false,
          message: 'File cannot be deleted while it contains active chunks. Please try again later.',
          documentName,
          error: 'DELETION_BLOCKED',
        };
      }
      
      throw error;
    }
  }

  /**
   * Generate chat response with tools (sequential approach)
   * Flow: File Search → Get context → Web Search with context → Final response
   */
  async generateChatResponse(message, systemPrompt, additionalContext = '') {
    if (!this.isInitialized) {
      throw new Error('GenAI service not initialized');
    }

    const modelName = config.genai.model;
    const fullMessage = additionalContext 
      ? `${message}\n\n${additionalContext}`
      : message;

    // ALWAYS use sequential approach: File Search → Web Search → Response
    return await this.generateSequential(modelName, fullMessage, systemPrompt);
  }

  /**
   * Generate response with sequential tool calls
   * 1. ALWAYS do File Search first (search uploaded documents)
   * 2. ALWAYS do Web Search (Google Search) with file search context
   * 3. Generate final response with all context and citations
   */
  async generateSequential(modelName, message, systemPrompt) {
    let fileSearchContext = '';
    let webSearchContext = '';
    let allCitations = {
      groundingChunks: [],
      groundingSupports: [],
      webSearchQueries: [],
      fileSearchResults: [],
      processedChunks: [],
    };

    console.log('=== Starting Sequential Search ===');
    console.log('User message:', message);

    // STEP 1: ALWAYS do File Search first (if file store exists)
    if (this.fileSearchStoreId) {
      console.log('Step 1: File Search with store:', this.fileSearchStoreId);
      try {
        // Use exact format from documentation:
        // model: "gemini-2.5-flash", contents: string, config.tools: [{fileSearch: {...}}]
        const fileResult = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',  // Use exact model name from docs
          contents: message,  // Simple string
          config: {
            tools: [
              {
                fileSearch: {
                  fileSearchStoreNames: [this.fileSearchStoreId]
                }
              }
            ]
          }
        });

        console.log('File search completed successfully');

        // Extract text from file search response
        const fileText = fileResult.text || fileResult.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n');
        if (fileText) {
          fileSearchContext = fileText;
          console.log('File search context length:', fileSearchContext.length);
        }

        // Extract file search citations/grounding metadata
        const fileMetadata = fileResult.candidates?.[0]?.groundingMetadata;
        if (fileMetadata) {
          console.log('File search grounding metadata found');
          if (fileMetadata.groundingChunks) {
            allCitations.fileSearchResults.push(...fileMetadata.groundingChunks);
            allCitations.groundingChunks.push(...fileMetadata.groundingChunks);
          }
          if (fileMetadata.groundingSupports) {
            allCitations.groundingSupports.push(...fileMetadata.groundingSupports);
          }
        }
      } catch (error) {
        console.log('File search error:', error.message);
        // Log more details for debugging
        if (error.response) {
          console.log('Error response:', JSON.stringify(error.response, null, 2));
        }
        // Continue without file search
      }
    } else {
      console.log('Step 1: No file search store available, skipping file search');
    }

    // STEP 2: ALWAYS do Google Web Search (with file search context if available)
    console.log('Step 2: Web Search (Google Search)');
    try {
      // Include file search context in the web search query for better results
      const webSearchQuery = fileSearchContext
        ? `Based on this context from uploaded documents:\n${fileSearchContext.substring(0, 2000)}\n\nUser question: ${message}`
        : message;

      // Use exact format from documentation for Google Search
      const webResult = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',  // Use model that supports grounding
        contents: webSearchQuery,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      console.log('Web search completed');

      // Extract text from web search - try .text first, then candidates
      const webText = webResult.text || webResult.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n');
      if (webText) {
        webSearchContext = webText;
        console.log('Web search context length:', webSearchContext.length);
      }

      // Extract web search citations/grounding metadata
      const webMetadata = webResult.candidates?.[0]?.groundingMetadata;
      if (webMetadata) {
        console.log('Web search grounding metadata found');
        if (webMetadata.groundingChunks) {
          allCitations.groundingChunks.push(...webMetadata.groundingChunks);
        }
        if (webMetadata.groundingSupports) {
          allCitations.groundingSupports.push(...webMetadata.groundingSupports);
        }
        if (webMetadata.webSearchQueries) {
          allCitations.webSearchQueries.push(...webMetadata.webSearchQueries);
        }
      }
    } catch (error) {
      console.log('Web search error (continuing):', error.message);
    }

    // STEP 3: Generate final response using all gathered context
    console.log('Step 3: Generating final response');
    
    let finalPrompt = message;
    let hasContext = false;

    if (fileSearchContext || webSearchContext) {
      hasContext = true;
      finalPrompt = `You are a medical assistant. Answer the user's question using the provided information. Always cite your sources.

`;
      if (fileSearchContext) {
        finalPrompt += `=== Information from Uploaded Documents ===
${fileSearchContext}

`;
      }
      if (webSearchContext) {
        finalPrompt += `=== Information from Web Search ===
${webSearchContext}

`;
      }
      finalPrompt += `=== User Question ===
${message}

Please provide a comprehensive answer based on the above information. Include citations to the sources used.`;
    }

    const finalResult = await this.ai.models.generateContent({
      model: modelName,
      contents: finalPrompt,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    console.log('Final response generated');
    console.log('Total citations:', allCitations.groundingChunks.length);
    console.log('=== Search Complete ===');

    return this.processResponse(finalResult, allCitations, hasContext);
  }

  /**
   * Process GenAI response with citations
   */
  processResponse(result, existingCitations = null, hasContext = false) {
    const text = result.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .filter(Boolean)
      .join('\n') || 'No response generated';

    const metadata = result.candidates?.[0]?.groundingMetadata;
    const citations = existingCitations || {
      groundingChunks: [],
      groundingSupports: [],
      webSearchQueries: [],
      fileSearchResults: [],
      processedChunks: [],
    };

    // Add any new citations from final response
    if (metadata?.groundingChunks) {
      citations.groundingChunks.push(...metadata.groundingChunks);
    }
    if (metadata?.groundingSupports) {
      citations.groundingSupports.push(...metadata.groundingSupports);
    }
    if (metadata?.webSearchQueries) {
      citations.webSearchQueries.push(...metadata.webSearchQueries);
    }

    // Deduplicate citations by URI
    const seenUris = new Set();
    const uniqueChunks = [];
    for (const chunk of citations.groundingChunks) {
      const uri = chunk.web?.uri || chunk.retrievedContext?.uri || '';
      if (uri && !seenUris.has(uri)) {
        seenUris.add(uri);
        uniqueChunks.push(chunk);
      } else if (!uri) {
        uniqueChunks.push(chunk);
      }
    }
    citations.groundingChunks = uniqueChunks;

    // Process chunks for display
    if (citations.groundingChunks.length > 0) {
      citations.processedChunks = citations.groundingChunks.map((chunk, i) => {
        // Handle both web search and file search citation formats
        const isFileSearch = chunk.retrievedContext || chunk.fileSearch;
        return {
          index: i + 1,
          type: isFileSearch ? 'file' : 'web',
          source: chunk.web?.uri || chunk.retrievedContext?.uri || chunk.fileSearch?.uri || 'Unknown',
          title: chunk.web?.title || chunk.retrievedContext?.title || chunk.fileSearch?.title || `Source ${i + 1}`,
          content: chunk.chunk?.content || chunk.text || null,
        };
      });
    }

    // Add search queries used
    citations.searchQueries = [...new Set(citations.webSearchQueries)];

    console.log(`Response processed: ${text.length} chars, ${citations.processedChunks.length} citations`);

    return { 
      text, 
      citations,
      hasFileSearch: citations.fileSearchResults.length > 0,
      hasWebSearch: citations.webSearchQueries.length > 0,
    };
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.json': 'application/json',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Singleton instance
const genaiService = new GenAIService();

export default genaiService;
export { GenAIService };

