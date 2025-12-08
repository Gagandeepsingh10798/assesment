# Reimbursement Intelligence Module - Python Backend

FastAPI-based backend server for the Reimbursement Intelligence Module. This is a Python/FastAPI equivalent of the Node.js Express backend.

## Features

- **Medical Code Lookup**: Search and retrieve CPT, HCPCS, and ICD-10 codes
- **Reimbursement Calculations**: Calculate payments across different sites of service (IPPS, HOPD, ASC, OBL)
- **NTAP Calculator**: New Technology Add-on Payment calculations and eligibility checking
- **TPT Calculator**: Transitional Pass-Through payment calculations
- **AI Chat**: Google GenAI-powered chat for medical coding questions
- **File Upload**: Upload and manage documents for AI analysis

## Prerequisites

- Python 3.10+
- pip or pip3

## Setup

1. **Navigate to the backend_python directory:**
   ```bash
   cd backend_python
   ```

2. **Create and activate virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create a `.env` file with the following variables:
   ```env
   # Server Configuration
   PORT=3001
   ENV=development

   # Google GenAI API Key (required for AI chat features)
   GOOGLE_API_KEY=your_google_api_key_here

   # CORS Configuration
   CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000", "*"]
   ```

## Running the Server

### Development Mode (with auto-reload)
```bash
source venv/bin/activate
python run.py
```

Or using uvicorn directly:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
```

### Production Mode
```bash
uvicorn app.main:app --host 0.0.0.0 --port 3001
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check and service status |
| GET | `/api/codes` | List codes with pagination |
| GET | `/api/codes/search?q=term` | Search codes |
| GET | `/api/codes/{code}` | Get code details |
| GET | `/api/codes/stats` | Get code statistics |
| POST | `/api/reimbursement/scenario` | Calculate reimbursement scenario |
| GET | `/api/reimbursement/compare/{code}` | Compare all sites of service |
| GET | `/api/reimbursement/sites` | Get valid sites of service |
| POST | `/api/ntap/calculate` | Calculate NTAP payment |
| POST | `/api/ntap/eligibility` | Check NTAP eligibility |
| POST | `/api/ntap/application` | Generate NTAP application |
| GET | `/api/ntap/approved-list` | Get approved NTAP technologies |
| GET | `/api/ntap/drgs` | Get available DRG codes |
| POST | `/api/tpt/calculate` | Calculate TPT payment |
| POST | `/api/tpt/eligibility` | Check TPT eligibility |
| POST | `/api/tpt/application` | Generate TPT application |
| GET | `/api/tpt/approved-list` | Get approved TPT technologies |
| GET | `/api/tpt/apcs` | Get available APC codes |
| POST | `/api/chat` | AI chat endpoint |
| GET | `/api/chat/status` | Get chat agent status |
| GET | `/api/files` | List uploaded files |
| POST | `/api/files` | Upload file |
| DELETE | `/api/files/{name}` | Delete file |
| POST | `/api/upload` | Upload file (legacy) |

## Project Structure

```
backend_python/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py      # Application configuration
│   ├── models/
│   │   ├── __init__.py
│   │   ├── code.py          # Code domain model
│   │   └── reimbursement.py # Reimbursement scenario model
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── health.py        # Health check endpoints
│   │   ├── codes.py         # Code lookup endpoints
│   │   ├── reimbursement.py # Reimbursement calculation endpoints
│   │   ├── ntap.py          # NTAP endpoints
│   │   ├── tpt.py           # TPT endpoints
│   │   ├── files.py         # File management endpoints
│   │   └── chat.py          # AI chat endpoints
│   └── services/
│       ├── __init__.py
│       ├── code_service.py      # Medical code service
│       ├── ntap_tpt_service.py  # NTAP/TPT calculation service
│       └── genai_service.py     # Google GenAI service
├── data/
│   ├── codes_chunks/        # Chunked medical codes data
│   ├── ntap_approved.json   # Approved NTAP technologies
│   └── tpt_approved.json    # Approved TPT technologies
├── uploads/                 # Uploaded files directory
├── venv/                    # Virtual environment
├── requirements.txt         # Python dependencies
├── run.py                   # Server entry point
└── README.md
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc

## Development

### Adding New Endpoints

1. Create a new router in `app/routers/`
2. Define route functions with proper type hints
3. Import and include the router in `app/main.py`

### Adding New Services

1. Create a new service in `app/services/`
2. Export it from `app/services/__init__.py`
3. Import and use in routers as needed

## License

MIT

