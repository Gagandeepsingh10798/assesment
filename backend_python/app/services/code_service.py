"""
Code Intelligence Service
Provides efficient loading, indexing, and querying of medical codes (CPT, HCPCS, ICD-10/Dx, PCS)
Supports loading from chunked JSON files for better memory management
"""

import json
import os
from typing import Dict, List, Optional, Any
from pathlib import Path

from app.models.code import Code


class CodeService:
    """Code service for managing medical codes"""
    
    def __init__(self):
        self.codes: List[Dict[str, Any]] = []
        self.code_index: Dict[str, Dict[str, Any]] = {}  # code -> full object
        self.type_index: Dict[str, List[Dict[str, Any]]] = {}  # type -> [codes]
        self.search_index: List[Dict[str, Any]] = []  # Array for text search
        self._is_loaded = False
        self.load_error: Optional[Exception] = None
        self.manifest: Optional[Dict[str, Any]] = None  # Manifest info when loading chunks
    
    def _get_data_path(self) -> Path:
        """Get the path to the data directory"""
        # Look for data relative to the backend_python directory
        current_dir = Path(__file__).parent.parent.parent
        data_dir = current_dir / "data"
        
        # If not found, check the original backend's data directory
        if not data_dir.exists():
            data_dir = current_dir.parent / "backend" / "data"
        
        return data_dir
    
    async def load_codes(self) -> None:
        """Load and index codes - supports both chunked and single file loading"""
        if self._is_loaded:
            return
        
        try:
            data_path = self._get_data_path()
            chunks_dir = data_path / "codes_chunks"
            manifest_path = chunks_dir / "manifest.json"
            
            # Check if chunked files exist
            if manifest_path.exists():
                await self._load_from_chunks(chunks_dir, manifest_path)
            else:
                # Fallback to single file loading
                await self._load_from_single_file(data_path)
            
            self._is_loaded = True
        except Exception as error:
            print(f"Error loading codes: {error}")
            self.load_error = error
            raise
    
    async def _load_from_chunks(self, chunks_dir: Path, manifest_path: Path) -> None:
        """Load codes from chunked JSON files"""
        import time
        print("Loading codes from chunked files...")
        start_time = time.time()
        
        # Read manifest
        with open(manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)
        
        print(f"Manifest: {self.manifest['chunkCount']} chunks, {self.manifest['totalCodes']} total codes")
        
        # Load each chunk
        loaded_codes = 0
        for chunk in self.manifest["chunks"]:
            chunk_path = chunks_dir / chunk["fileName"]
            chunk_start = time.time()
            
            with open(chunk_path, "r", encoding="utf-8") as f:
                chunk_codes = json.load(f)
            
            # Add to main codes array
            self.codes.extend(chunk_codes)
            loaded_codes += len(chunk_codes)
            
            print(f"  Loaded {chunk['fileName']}: {len(chunk_codes)} codes ({int((time.time() - chunk_start) * 1000)}ms)")
        
        print(f"Loaded {loaded_codes} codes from {self.manifest['chunkCount']} chunks in {int((time.time() - start_time) * 1000)}ms")
        
        # Build indexes
        self._build_indexes()
        
        print(f"Total loading + indexing: {int((time.time() - start_time) * 1000)}ms")
    
    async def _load_from_single_file(self, data_path: Path) -> None:
        """Load codes from single JSON file (legacy/fallback)"""
        import time
        codes_file = data_path / "codes_2025.json"
        print(f"Loading codes from single file: {codes_file}")
        
        start_time = time.time()
        
        # Read and parse JSON
        with open(codes_file, "r", encoding="utf-8") as f:
            self.codes = json.load(f)
        
        print(f"Loaded {len(self.codes)} codes in {int((time.time() - start_time) * 1000)}ms")
        
        # Build indexes
        self._build_indexes()
        
        print(f"Indexing complete in {int((time.time() - start_time) * 1000)}ms")
    
    def _build_indexes(self) -> None:
        """Build in-memory indexes for fast lookup"""
        print("Building indexes...")
        
        # Clear existing indexes
        self.code_index.clear()
        self.type_index.clear()
        self.search_index = []
        
        for code_obj in self.codes:
            # Index by code
            self.code_index[code_obj["code"]] = code_obj
            
            # Index by type
            code_type = self._normalize_type(code_obj.get("type"))
            if code_type not in self.type_index:
                self.type_index[code_type] = []
            self.type_index[code_type].append(code_obj)
            
            # Build search index (code + description tokens)
            self.search_index.append({
                "code": code_obj["code"],
                "search_text": f"{code_obj['code']} {code_obj.get('description', '')}".lower(),
                "type": code_type,
            })
        
        print("Index stats:")
        print(f"  - Code index size: {len(self.code_index)}")
        print(f"  - Types: {list(self.type_index.keys())}")
        for type_name, codes in self.type_index.items():
            print(f"    - {type_name}: {len(codes)} codes")
    
    def _normalize_type(self, code_type: Optional[str]) -> str:
        """Normalize type name for consistent querying"""
        if not code_type:
            return "OTHER"
        upper_type = code_type.upper()
        if upper_type == "DX":
            return "ICD10"
        if upper_type == "PCS":
            return "ICD10-PCS"
        return upper_type
    
    def get_all_codes(
        self,
        limit: int = 50,
        offset: int = 0,
        code_type: Optional[str] = None,
        sort_by: str = "code",
        sort_order: str = "asc"
    ) -> Dict[str, Any]:
        """Get all codes with pagination and filtering"""
        if code_type:
            results = self.type_index.get(code_type.upper(), []).copy()
        else:
            results = self.codes.copy()
        
        # Sort
        reverse = sort_order == "desc"
        results.sort(key=lambda x: str(x.get(sort_by, "")), reverse=reverse)
        
        # Paginate
        paginated = results[offset:offset + limit]
        
        return {
            "codes": [self._format_code_summary(c) for c in paginated],
            "total": len(results),
            "limit": limit,
            "offset": offset,
            "hasMore": offset + limit < len(results),
        }
    
    def get_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get a single code by code string"""
        code_obj = self.code_index.get(code) or self.code_index.get(code.upper())
        if not code_obj:
            return None
        return self._format_code_detail(code_obj)
    
    def search_codes(
        self,
        query: str,
        limit: int = 50,
        code_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search codes by query string"""
        if not query or len(query.strip()) < 2:
            return {"codes": [], "total": 0, "query": query}
        
        search_term = query.lower().strip()
        terms = search_term.split()
        
        # Score-based search
        results = []
        
        for item in self.search_index:
            # Filter by type if specified
            if code_type and item["type"] != code_type.upper():
                continue
            
            score = 0
            
            # Exact code match gets highest score
            if item["code"].lower() == search_term:
                score = 100
            elif search_term in item["code"].lower():
                score = 80
            
            # Term matching in description
            for term in terms:
                if term in item["search_text"]:
                    score += 10
            
            if score > 0:
                results.append({"code": item["code"], "score": score})
        
        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Get full code objects for top results
        top_results = []
        for r in results[:limit]:
            code_obj = self.code_index.get(r["code"])
            if code_obj:
                top_results.append(self._format_code_summary(code_obj))
        
        return {
            "codes": top_results,
            "total": len(results),
            "query": query,
        }
    
    def _format_code_summary(self, code_obj: Dict[str, Any]) -> Dict[str, Any]:
        """Format code for summary listing"""
        try:
            code = Code.from_raw(code_obj)
            return code.to_summary()
        except Exception:
            # Fallback formatting
            return {
                "code": code_obj.get("code"),
                "description": code_obj.get("description"),
                "category": code_obj.get("labels", [None])[0] if code_obj.get("labels") else self._normalize_type(code_obj.get("type")),
                "type": self._normalize_type(code_obj.get("type")),
                "labels": code_obj.get("labels", []),
            }
    
    def _format_code_detail(self, code_obj: Dict[str, Any]) -> Dict[str, Any]:
        """Format code for detailed view with payments"""
        try:
            code = Code.from_raw(code_obj)
            return code.to_detail()
        except Exception:
            # Fallback formatting
            return {
                "code": code_obj.get("code"),
                "description": code_obj.get("description"),
                "category": code_obj.get("labels", [None])[0] if code_obj.get("labels") else self._normalize_type(code_obj.get("type")),
                "type": self._normalize_type(code_obj.get("type")),
                "labels": code_obj.get("labels", []),
                "payments": {"IPPS": 0, "HOPD": 0, "ASC": 0, "OBL": 0},
                "optional": {},
                "rawMetadata": code_obj.get("metadata"),
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about loaded codes"""
        stats = {
            "totalCodes": len(self.codes),
            "isLoaded": self._is_loaded,
            "types": {},
            "loadMethod": "chunked" if self.manifest else "single-file",
        }
        
        if self.manifest:
            stats["chunks"] = {
                "count": self.manifest.get("chunkCount"),
                "targetSizeMB": self.manifest.get("targetChunkSizeMB"),
                "createdAt": self.manifest.get("createdAt"),
            }
        
        for type_name, codes in self.type_index.items():
            stats["types"][type_name] = len(codes)
        
        return stats
    
    def is_ready(self) -> bool:
        """Check if service is ready"""
        return self._is_loaded and self.load_error is None


# Singleton instance
code_service = CodeService()

