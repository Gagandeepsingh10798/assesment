"""
Google GenAI Service with Multi-Agent Orchestration
Handles all interactions with Google Generative AI including:
- Query Classification (SQL, PDF, General)
- File Search for uploaded documents
- SQL Query Generation
- General Knowledge responses

Based on: https://ai.google.dev/gemini-api/docs/file-search
"""

import os
import re
import time
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

from app.config import settings


class QueryClassifier:
    """Classifies user queries to route to appropriate agent"""
    
    # SQL-related keywords
    SQL_KEYWORDS = [
        'sql', 'query', 'select', 'from', 'where', 'join', 'table',
        'database', 'insert', 'update', 'delete', 'create table',
        'drop', 'alter', 'group by', 'order by', 'having',
        'give me sql', 'write sql', 'sql query', 'generate sql',
        'get all', 'fetch all', 'retrieve all', 'list all'
    ]
    
    # PDF/Document-related keywords
    PDF_KEYWORDS = [
        'pdf', 'document', 'file', 'uploaded', 'attachment',
        'report', 'analyze this', 'summary of this', 'from this',
        'in the document', 'in the file', 'patient details',
        'blood report', 'medical record', 'this document',
        'uploaded file', 'the file', 'read this', 'extract from'
    ]
    
    @classmethod
    def classify(cls, message: str) -> str:
        """
        Classify the query type
        Returns: 'sql', 'pdf', or 'general'
        """
        message_lower = message.lower()
        
        # Check for SQL queries
        sql_score = sum(1 for kw in cls.SQL_KEYWORDS if kw in message_lower)
        if sql_score >= 2 or any(kw in message_lower for kw in ['sql query', 'give me sql', 'write sql', 'generate sql']):
            return 'sql'
        
        # Check for PDF/Document queries
        pdf_score = sum(1 for kw in cls.PDF_KEYWORDS if kw in message_lower)
        if pdf_score >= 1:
            return 'pdf'
        
        # Default to general
        return 'general'


class GenAIService:
    """GenAI service with Multi-Agent Orchestration"""
    
    def __init__(self):
        self.client = None
        self.file_search_store_id: Optional[str] = None
        self.file_search_store_name: Optional[str] = None
        self.is_initialized = False
        self.init_error: Optional[Exception] = None
    
    async def initialize(self) -> bool:
        """Initialize the GenAI client"""
        if not settings.google_api_key:
            print("GOOGLE_API_KEY not configured - GenAI features disabled")
            return False
        
        try:
            from google import genai
            
            self.client = genai.Client(api_key=settings.google_api_key)
            print("Google GenAI client initialized")
            
            await self._initialize_file_search_store()
            
            self.is_initialized = True
            return True
        except Exception as error:
            print(f"Failed to initialize GenAI service: {error}")
            self.init_error = error
            return False
    
    async def _initialize_file_search_store(self) -> Optional[str]:
        """Initialize or get existing file search store"""
        if not self.client:
            print("Client not initialized")
            return None
        
        try:
            store_name = settings.default_file_search_store
            
            try:
                stores = self.client.file_search_stores.list()
                store_list = []
                
                if hasattr(stores, '__aiter__'):
                    async for store in stores:
                        store_list.append(store)
                elif hasattr(stores, '__iter__'):
                    for store in stores:
                        store_list.append(store)
                
                existing = None
                for s in store_list:
                    if getattr(s, 'display_name', '') == store_name or (hasattr(s, 'name') and store_name in s.name):
                        existing = s
                        break
                
                if existing:
                    self.file_search_store_id = existing.name
                    self.file_search_store_name = existing.name
                    print(f"Using existing file search store: {self.file_search_store_id}")
                    return self.file_search_store_id
            except Exception as list_error:
                print(f"Could not list existing stores: {list_error}")
            
            new_store = self.client.file_search_stores.create(
                config={'display_name': store_name}
            )
            
            self.file_search_store_id = new_store.name
            self.file_search_store_name = new_store.name
            print(f"Created new file search store: {self.file_search_store_id}")
            return self.file_search_store_id
            
        except Exception as error:
            print(f"Error initializing file search store: {error}")
            return None
    
    def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        return {
            "initialized": self.is_initialized,
            "apiKeyConfigured": bool(settings.google_api_key),
            "fileSearchStoreId": self.file_search_store_id,
            "error": str(self.init_error) if self.init_error else None,
        }
    
    async def list_files(self) -> Dict[str, Any]:
        """List files in file search store"""
        if not self.is_initialized:
            return {
                "files": [],
                "totalFiles": 0,
                "source": "not_initialized",
            }
        
        try:
            files = []
            
            if self.file_search_store_name:
                try:
                    docs = self.client.file_search_stores.documents.list(
                        parent=self.file_search_store_name
                    )
                    
                    if hasattr(docs, '__aiter__'):
                        async for doc in docs:
                            files.append(self._format_document(doc))
                    elif hasattr(docs, '__iter__'):
                        for doc in docs:
                            files.append(self._format_document(doc))
                except Exception as doc_error:
                    print(f"Error listing documents: {doc_error}")
            
            if not files:
                try:
                    for f in self.client.files.list():
                        files.append({
                            "name": f.name,
                            "displayName": getattr(f, 'display_name', f.name),
                            "uploadedAt": str(getattr(f, 'create_time', None)),
                            "size": getattr(f, 'size_bytes', 0),
                            "mimeType": getattr(f, 'mime_type', 'application/octet-stream'),
                        })
                except Exception as file_error:
                    print(f"Error listing files: {file_error}")
            
            return {
                "files": files,
                "totalFiles": len(files),
                "source": "genai_file_search_store",
                "storeId": self.file_search_store_id,
            }
        except Exception as error:
            print(f"Error listing files: {error}")
            return {
                "files": [],
                "totalFiles": 0,
                "source": "error",
                "error": str(error),
            }
    
    def _format_document(self, doc) -> Dict[str, Any]:
        """Format document for response"""
        return {
            "name": getattr(doc, 'name', ''),
            "displayName": getattr(doc, 'display_name', '') or getattr(doc, 'name', '').split('/')[-1],
            "uploadedAt": str(getattr(doc, 'create_time', None)),
            "size": getattr(doc, 'size_bytes', 0),
            "mimeType": getattr(doc, 'mime_type', 'application/octet-stream'),
        }
    
    async def upload_file(self, file_path: str, file_name: str) -> Dict[str, Any]:
        """Upload file to file search store"""
        if not self.is_initialized:
            raise Exception("GenAI service not initialized")
        
        if not self.file_search_store_name:
            raise Exception("File search store not initialized")
        
        try:
            mime_type = self._get_mime_type(file_name)
            
            print(f"Uploading file: {file_name}, mime: {mime_type}")
            print(f"File search store: {self.file_search_store_name}")
            
            try:
                print("Method 1: Using upload_to_file_search_store...")
                operation = self.client.file_search_stores.upload_to_file_search_store(
                    file=file_path,
                    file_search_store_name=self.file_search_store_name,
                    config={'display_name': file_name}
                )
                
                print("Upload operation started")
                
                while not operation.done:
                    print("Waiting for upload to complete...")
                    time.sleep(5)
                    operation = self.client.operations.get(operation=operation)
                
                print(f"Upload completed: {operation}")
                doc_name = getattr(operation, 'document_name', None) or \
                          getattr(getattr(operation, 'response', None), 'document_name', None) or \
                          file_name
                
                return {
                    "success": True,
                    "message": "File uploaded to file search store",
                    "fileName": file_name,
                    "documentName": doc_name,
                    "storeId": self.file_search_store_name,
                }
            except Exception as method1_error:
                print(f"Method 1 failed: {method1_error}")
                
                print("Method 2: Using files.upload + import_file...")
                
                sample_file = self.client.files.upload(
                    file=file_path,
                    config={'display_name': file_name}
                )
                
                print(f"File uploaded to Files API: {sample_file.name}")
                
                operation = self.client.file_search_stores.import_file(
                    file_search_store_name=self.file_search_store_name,
                    file_name=sample_file.name
                )
                
                print("Import operation started")
                
                while not operation.done:
                    print("Waiting for import to complete...")
                    time.sleep(5)
                    operation = self.client.operations.get(operation=operation)
                
                print(f"Import completed: {operation}")
                doc_name = getattr(operation, 'document_name', None) or \
                          getattr(getattr(operation, 'response', None), 'document_name', None) or \
                          sample_file.name
                
                return {
                    "success": True,
                    "message": "File uploaded and imported to file search store",
                    "fileName": file_name,
                    "documentName": doc_name,
                    "storeId": self.file_search_store_name,
                }
        except Exception as error:
            print(f"Error uploading file: {error}")
            raise
    
    async def delete_file(self, document_name: str) -> Dict[str, Any]:
        """Delete file from file search store"""
        if not self.is_initialized:
            raise Exception("GenAI service not initialized")
        
        try:
            print(f"Deleting document: {document_name}")
            
            try:
                self.client.file_search_stores.documents.delete(
                    name=document_name,
                    config={'force': True}
                )
                print("Document deleted from file search store")
            except Exception as store_error:
                print(f"Could not delete from store, trying files API: {store_error}")
                self.client.files.delete(name=document_name)
                print("File deleted from files API")
            
            return {
                "success": True,
                "message": "File deleted successfully",
                "documentName": document_name,
            }
        except Exception as error:
            print(f"Error deleting file: {error}")
            raise
    
    async def generate_chat_response(
        self,
        message: str,
        system_prompt: str,
        additional_context: str = ""
    ) -> Dict[str, Any]:
        """
        Generate chat response with Multi-Agent Orchestration
        
        Flow:
        1. Classify query type (SQL, PDF, General)
        2. Route to appropriate agent
        3. Return enriched response
        """
        if not self.is_initialized:
            raise Exception("GenAI service not initialized")
        
        # Step 1: Classify the query
        query_type = QueryClassifier.classify(message)
        
        print("\n" + "=" * 40)
        print(f"Query Classification: {query_type.upper()}")
        print("=" * 40)
        
        # Step 2: Route to appropriate agent
        if query_type == 'sql':
            return await self._handle_sql_query(message, system_prompt, additional_context)
        elif query_type == 'pdf':
            return await self._handle_pdf_query(message, system_prompt, additional_context)
        else:
            return await self._handle_general_query(message, system_prompt, additional_context)
    
    async def _handle_sql_query(
        self,
        message: str,
        system_prompt: str,
        additional_context: str = ""
    ) -> Dict[str, Any]:
        """
        SQL Agent: Generates SQL queries for medical code database
        """
        from google.genai import types
        
        print("=== SQL Agent Activated ===")
        
        sql_system_prompt = """You are an expert SQL query generator for a medical codes database.

The database has a table called 'codes' with the following schema:
- code (VARCHAR): The medical code (e.g., '27447', 'A0001', 'J12.9')
- description (TEXT): Full description of the code
- type (VARCHAR): Type of code - 'CPT', 'HCPCS', 'ICD10', 'ICD10-PCS'
- labels (TEXT[]): Array of labels/categories
- metadata (JSONB): Additional metadata including:
  - For CPT: APC, FACILITY_RVU, NONFACILITY_RVU, SI, RANK
  - For HCPCS: Similar fields
  - For ICD10: Category information

When the user asks for SQL queries:
1. Generate a valid SQL query that would work with this schema
2. Explain what the query does
3. Show example results if applicable

Always format SQL queries in code blocks with proper syntax.
"""
        
        try:
            result = self.client.models.generate_content(
                model=settings.genai_model,
                contents=f"{message}\n\n{additional_context}" if additional_context else message,
                config=types.GenerateContentConfig(
                    system_instruction=sql_system_prompt,
                )
            )
            
            text = self._extract_text(result)
            
            # Extract SQL query from response
            sql_query = self._extract_sql_from_text(text)
            
            print(f"SQL Query Generated: {sql_query[:100] if sql_query else 'None'}...")
            print("=== SQL Agent Complete ===\n")
            
            return {
                "text": text,
                "citations": {"processedChunks": [], "groundingChunks": []},
                "queryType": "sql",
                "sqlQuery": sql_query,
                "sqlExplanation": "SQL query generated based on the medical codes database schema",
                "hasFileSearch": False,
                "hasWebSearch": False,
            }
        except Exception as error:
            print(f"SQL Agent error: {error}")
            raise
    
    async def _handle_pdf_query(
        self,
        message: str,
        system_prompt: str,
        additional_context: str = ""
    ) -> Dict[str, Any]:
        """
        PDF Agent: Uses File Search to answer questions about uploaded documents
        """
        from google.genai import types
        
        print("=== PDF Agent Activated ===")
        
        all_citations = {
            "groundingChunks": [],
            "groundingSupports": [],
            "webSearchQueries": [],
            "fileSearchResults": [],
            "processedChunks": [],
        }
        
        file_search_context = ""
        
        # Use File Search to get document content
        if self.file_search_store_name:
            print(f"Searching in file store: {self.file_search_store_name}")
            try:
                file_result = self.client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=message,
                    config=types.GenerateContentConfig(
                        tools=[
                            types.Tool(
                                file_search=types.FileSearch(
                                    file_search_store_names=[self.file_search_store_name]
                                )
                            )
                        ]
                    )
                )
                
                print("File search completed successfully")
                
                file_text = self._extract_text(file_result)
                if file_text:
                    file_search_context = file_text
                    print(f"File search context length: {len(file_search_context)}")
                
                # Extract citations
                self._extract_citations(file_result, all_citations, is_file_search=True)
                
            except Exception as file_error:
                print(f"File search error: {file_error}")
        else:
            print("No file search store available")
        
        # Generate response based on file content
        pdf_prompt = f"""You are analyzing uploaded documents. Based on the document content provided, answer the user's question thoroughly.

=== DOCUMENT CONTENT ===
{file_search_context if file_search_context else "No document content found. Please upload a file first."}

=== USER QUESTION ===
{message}

If document content is available, provide a detailed analysis. Extract key information like:
- Patient details (if medical record)
- Key findings
- Important dates
- Relevant data points

If no document is found, inform the user to upload a file first."""
        
        try:
            result = self.client.models.generate_content(
                model=settings.genai_model,
                contents=pdf_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                )
            )
            
            text = self._extract_text(result)
            
            # Process citations
            processed_chunks = self._process_citations(all_citations["groundingChunks"])
            all_citations["processedChunks"] = processed_chunks
            
            print(f"PDF Agent response length: {len(text)}")
            print(f"Citations found: {len(processed_chunks)}")
            print("=== PDF Agent Complete ===\n")
            
            return {
                "text": text,
                "citations": all_citations,
                "queryType": "pdf",
                "hasFileSearch": len(all_citations["fileSearchResults"]) > 0 or bool(file_search_context),
                "hasWebSearch": False,
            }
        except Exception as error:
            print(f"PDF Agent error: {error}")
            raise
    
    async def _handle_general_query(
        self,
        message: str,
        system_prompt: str,
        additional_context: str = ""
    ) -> Dict[str, Any]:
        """
        General Agent: Uses web search for general medical/reimbursement questions
        """
        from google.genai import types
        
        print("=== General Agent Activated ===")
        
        all_citations = {
            "groundingChunks": [],
            "groundingSupports": [],
            "webSearchQueries": [],
            "fileSearchResults": [],
            "processedChunks": [],
        }
        
        web_search_context = ""
        
        # Use Google Search for general queries
        print("Performing web search...")
        try:
            web_result = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=message,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                )
            )
            
            print("Web search completed")
            
            web_text = self._extract_text(web_result)
            if web_text:
                web_search_context = web_text
                print(f"Web search context length: {len(web_search_context)}")
            
            # Extract citations
            self._extract_citations(web_result, all_citations, is_file_search=False)
            
        except Exception as web_error:
            print(f"Web search error: {web_error}")
        
        # Generate final response
        final_prompt = message
        if web_search_context:
            final_prompt = f"""Based on the following search results, answer the user's question about medical codes and reimbursement.

=== SEARCH RESULTS ===
{web_search_context}

=== USER QUESTION ===
{message}

Provide a comprehensive answer with citations where applicable."""
        
        try:
            result = self.client.models.generate_content(
                model=settings.genai_model,
                contents=final_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                )
            )
            
            text = self._extract_text(result)
            
            # Process citations
            processed_chunks = self._process_citations(all_citations["groundingChunks"])
            all_citations["processedChunks"] = processed_chunks
            all_citations["searchQueries"] = list(set(all_citations.get("webSearchQueries", [])))
            
            print(f"General Agent response length: {len(text)}")
            print(f"Citations found: {len(processed_chunks)}")
            print("=== General Agent Complete ===\n")
            
            return {
                "text": text,
                "citations": all_citations,
                "queryType": "general",
                "hasFileSearch": False,
                "hasWebSearch": len(processed_chunks) > 0,
            }
        except Exception as error:
            print(f"General Agent error: {error}")
            raise
    
    def _extract_text(self, result) -> str:
        """Safely extract text from API response"""
        try:
            text = getattr(result, 'text', None)
            if text:
                return text
            
            if hasattr(result, 'candidates') and result.candidates:
                candidate = result.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    parts = candidate.content.parts
                    if parts:
                        return '\n'.join(p.text for p in parts if hasattr(p, 'text') and p.text)
            
            return "No response generated"
        except Exception as e:
            print(f"Error extracting text: {e}")
            return "Error extracting response"
    
    def _extract_citations(self, result, citations: Dict, is_file_search: bool = False) -> None:
        """Safely extract citations from API response"""
        try:
            if not hasattr(result, 'candidates') or not result.candidates:
                return
            
            candidate = result.candidates[0]
            metadata = getattr(candidate, 'grounding_metadata', None)
            
            if not metadata:
                return
            
            print(f"{'File' if is_file_search else 'Web'} search grounding metadata found")
            
            # Extract grounding chunks
            chunks = getattr(metadata, 'grounding_chunks', None)
            if chunks:
                for chunk in chunks:
                    if chunk is not None:
                        if is_file_search:
                            citations["fileSearchResults"].append(chunk)
                        citations["groundingChunks"].append(chunk)
            
            # Extract grounding supports
            supports = getattr(metadata, 'grounding_supports', None)
            if supports:
                for support in supports:
                    if support is not None:
                        citations["groundingSupports"].append(support)
            
            # Extract web search queries
            queries = getattr(metadata, 'web_search_queries', None)
            if queries:
                for query in queries:
                    if query is not None:
                        citations["webSearchQueries"].append(query)
                        
        except Exception as e:
            print(f"Error extracting citations: {e}")
    
    def _process_citations(self, grounding_chunks: List) -> List[Dict]:
        """Process grounding chunks into display format"""
        processed = []
        seen_uris = set()
        
        for i, chunk in enumerate(grounding_chunks):
            if chunk is None:
                continue
                
            uri = None
            title = f"Source {i + 1}"
            is_file = False
            
            try:
                if hasattr(chunk, 'web') and chunk.web:
                    uri = getattr(chunk.web, 'uri', None)
                    title = getattr(chunk.web, 'title', None) or title
                elif hasattr(chunk, 'retrieved_context') and chunk.retrieved_context:
                    uri = getattr(chunk.retrieved_context, 'uri', None)
                    title = getattr(chunk.retrieved_context, 'title', None) or title
                    is_file = True
                
                if uri and uri not in seen_uris:
                    seen_uris.add(uri)
                    processed.append({
                        "index": len(processed) + 1,
                        "type": "file" if is_file else "web",
                        "source": uri,
                        "title": title,
                    })
            except Exception as e:
                print(f"Error processing chunk {i}: {e}")
                continue
        
        return processed
    
    def _extract_sql_from_text(self, text: str) -> Optional[str]:
        """Extract SQL query from response text"""
        # Look for SQL in code blocks
        sql_pattern = r'```sql\s*(.*?)\s*```'
        matches = re.findall(sql_pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            return matches[0].strip()
        
        # Look for generic code blocks that might be SQL
        code_pattern = r'```\s*(SELECT.*?)\s*```'
        matches = re.findall(code_pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            return matches[0].strip()
        
        # Look for inline SQL
        inline_pattern = r'(SELECT\s+.*?(?:FROM|;))'
        matches = re.findall(inline_pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            return matches[0].strip()
        
        return None
    
    def _get_mime_type(self, file_name: str) -> str:
        """Get MIME type from filename"""
        ext = os.path.splitext(file_name)[1].lower()
        mime_types = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".md": "text/markdown",
            ".csv": "text/csv",
            ".json": "application/json",
        }
        return mime_types.get(ext, "application/octet-stream")


# Singleton instance
genai_service = GenAIService()
