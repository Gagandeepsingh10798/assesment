# Code Intelligence & Reimbursement Analyzer (RIM)

A production-grade **Reimbursement Intelligence Module** featuring Code Intelligence Engine, Reimbursement Pathway Analyzer, NTAP/TPT Calculator, AI-powered Consultation, and Application Document Generation.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18.2-blue)
![Express](https://img.shields.io/badge/Express-4.18-lightgrey)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Frontend Components](#frontend-components)
- [Data Models](#data-models)
- [Configuration](#configuration)
- [Testing](#testing)
- [Performance](#performance)
- [Project Structure](#project-structure)

---

## Features

### 🔍 Code Explorer
- Browse **164,009+ medical codes** (CPT, HCPCS, ICD-10, ICD-10-PCS)
- Real-time search by code or description
- Filter by code type (CPT, HCPCS, ICD10, ICD10-PCS)
- Pagination with configurable page size
- View detailed code information including:
  - Payment estimates for all sites of service
  - APC, DRG, and RVU data
  - Category and label classification
- One-click navigation to Reimbursement Simulator

### 💰 Reimbursement Simulator
- Calculate comprehensive financial scenarios for medical procedures
- **Input Parameters:**
  - Procedure code (searchable dropdown)
  - Site of Service (IPPS, HOPD, ASC, OBL)
  - Device cost
  - Optional NTAP add-on payment
- **Output:**
  - Base payment by site
  - Total payment (Base + NTAP)
  - Margin (Total - Device Cost)
  - Margin percentage
  - Classification (Profitable/Break-Even/Loss)
- Compare payments across all sites of service
- Interactive bar charts for visual analysis
- Detailed payment breakdown

### 📋 NTAP/TPT Calculator
- **NTAP (New Technology Add-on Payment) - Inpatient:**
  - Calculate NTAP payment based on device cost and DRG
  - Check eligibility with detailed criteria assessment
  - View approved NTAP technologies list
  - Generate NTAP application documents
- **TPT (Transitional Pass-Through Payment) - Outpatient:**
  - Calculate TPT pass-through payment based on APC
  - Check eligibility for devices, drugs, and biologicals
  - View approved TPT technologies list
  - Generate TPT application documents
- **Eligibility Assessment:**
  - FDA approval date and type verification
  - Cost threshold analysis
  - Clinical improvement documentation
  - Detailed recommendations

### 📄 Application Generator
- Generate structured NTAP/TPT application documents
- Pre-populated sections based on calculator inputs
- Sections include:
  - Cover page with applicant info
  - Technology description
  - Regulatory status (FDA approval)
  - Newness criteria justification
  - Cost analysis and payment calculations
  - Clinical improvement evidence
  - Coding information
- Export-ready format for CMS submission

### 💬 AI Consultation (Chatbot)
- Ask questions about medical codes and reimbursement
- **Features:**
  - Automatic code lookup from database (164K+ codes)
  - Google Search integration for latest CMS updates
  - File Search integration for uploaded documents
  - Markdown-formatted responses
  - Citation tracking with source links
- **File Management:**
  - Upload documents (PDF, TXT, DOC, DOCX, MD)
  - Up to 500MB file size support
  - Files stored in Google GenAI File Search Store
  - List and delete uploaded files
  - Files used as context for AI responses

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Chatbot │ │  Code   │ │Reimburse│ │ NTAP/TPT│ │   App   │  │
│  │         │ │Explorer │ │Simulator│ │  Calc   │ │Generator│  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
└───────┼──────────┼─────────┼─────────┼──────────┼──────────────┘
        │          │         │         │          │
        └──────────┴────┬────┴─────────┴──────────┘
                        │ HTTP/REST
┌───────────────────────┼─────────────────────────────────────────┐
│                       │    Backend (Express)                    │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │                    API Routes                            │   │
│  │  /health  /codes  /reimbursement  /ntap  /tpt  /chat    │   │
│  └────────────────────┬────────────────────────────────────┘   │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │                   Controllers                            │   │
│  │  health  code  reimbursement  ntap  tpt  file  chat     │   │
│  └────────────────────┬────────────────────────────────────┘   │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │                    Services                              │   │
│  │  codeService  ntapTptService  genaiService              │   │
│  └────────────────────┬────────────────────────────────────┘   │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │                     Models                               │   │
│  │  Code  ReimbursementScenario  NtapTptEligibility        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────────────┐
│               Data & External Services                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ codes_chunks│  │ ntap/tpt    │  │   Google GenAI API      │ │
│  │ (14 × ~25MB)│  │ approved    │  │  - Gemini 2.0 Flash     │ │
│  │ 164K codes  │  │ .json files │  │  - File Search Store    │ │
│  └─────────────┘  └─────────────┘  │  - Google Search        │ │
│                                     └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend (Node.js + Express)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Express 4.18 | REST API server |
| AI/ML | @google/genai 1.30 | Gemini AI, File Search, Google Search |
| File Upload | Multer 1.4.5 | Multipart form handling (500MB limit) |
| Environment | dotenv 16.3 | Environment variable management |
| CORS | cors 2.8.5 | Cross-origin resource sharing |
| Testing | Jest 30 + Supertest 7 | Unit and integration tests |

### Frontend (React + Vite)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18.2 | UI components |
| Build Tool | Vite 5.0 | Fast development and builds |
| Routing | React Router DOM 7.9 | SPA navigation |
| HTTP Client | Axios 1.6 | API communication |
| Charts | Recharts 3.5 | Payment visualization |
| Icons | Lucide React 0.555 | Modern icon library |
| Markdown | react-markdown + remark-gfm | AI response rendering |
| Testing | Vitest + Testing Library | Component tests |

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- **Google API Key** (for AI features)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd assesment
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Configure environment:**
```bash
# In backend directory, create .env file
cd ../backend
cat > .env << EOF
# Server Configuration
PORT=3001
NODE_ENV=development

# Google GenAI API Key (required for AI features)
GOOGLE_API_KEY=your_google_api_key_here

# CORS Origin (optional, defaults to *)
CORS_ORIGIN=http://localhost:5173
EOF
```

5. **Start the servers:**
```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 5173)
cd frontend
npm run dev
```

6. **Open browser:** http://localhost:5173

### Available Scripts

#### Backend
```bash
npm run dev          # Start with hot reload (development)
npm run start        # Start production server
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:coverage    # Run tests with coverage report
```

#### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:ui      # Run tests with UI
npm run test:coverage  # Run tests with coverage
```

---

## API Documentation

### Base URL
```
http://localhost:3001/api
```

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status and service info |

### Code Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/codes` | List codes with pagination |
| GET | `/codes/search?q=query` | Search codes by text |
| GET | `/codes/stats` | Database statistics (totals, types, load method) |
| GET | `/codes/:code` | Get detailed code information |

**Query Parameters for `/codes`:**
- `limit` (number, default: 50) - Results per page
- `offset` (number, default: 0) - Pagination offset
- `type` (string) - Filter by type (CPT, HCPCS, ICD10, ICD10-PCS)
- `sortBy` (string, default: 'code') - Sort field
- `sortOrder` (string, default: 'asc') - Sort direction

### Reimbursement

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reimbursement/scenario` | Calculate reimbursement scenario |
| GET | `/reimbursement/sites` | List valid sites and thresholds |
| GET | `/reimbursement/compare/:code` | Compare all sites for a code |

**POST `/reimbursement/scenario` Body:**
```json
{
  "code": "36903",
  "siteOfService": "HOPD",
  "deviceCost": 5800,
  "ntapAddOn": 3770
}
```

### NTAP (New Technology Add-on Payment)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ntap/calculate` | Calculate NTAP payment |
| POST | `/ntap/eligibility` | Check NTAP eligibility |
| POST | `/ntap/application` | Generate application document |
| GET | `/ntap/approved-list` | List approved NTAP technologies |
| GET | `/ntap/drgs` | Get available DRG codes |

**POST `/ntap/calculate` Body:**
```json
{
  "deviceCost": 32500,
  "drgCode": "216",
  "drgPayment": 45000
}
```

### TPT (Transitional Pass-Through Payment)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tpt/calculate` | Calculate TPT payment |
| POST | `/tpt/eligibility` | Check TPT eligibility |
| POST | `/tpt/application` | Generate application document |
| GET | `/tpt/approved-list` | List approved TPT technologies |
| GET | `/tpt/apcs` | Get available APC codes |

**POST `/tpt/calculate` Body:**
```json
{
  "deviceCost": 1200,
  "apcCode": "5112",
  "packagedPayment": 820
}
```

### Files & Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/files` | List files in File Search Store |
| POST | `/upload` | Upload file (multipart/form-data) |
| DELETE | `/files/:documentName` | Delete file from store |
| POST | `/chat` | Send message to AI |

**POST `/chat` Body:**
```json
{
  "message": "What is CPT code 36903?",
  "history": []
}
```

---

## Frontend Components

### Pages/Views

| Component | Route | Description |
|-----------|-------|-------------|
| `Chatbot` | `/` | AI consultation with file upload |
| `CodeExplorer` | `/codes` | Browse and search medical codes |
| `ReimbursementSimulator` | `/calculator` | Calculate financial scenarios |
| `NtapTptCalculator` | `/ntap-tpt` | NTAP/TPT calculations |
| `ApplicationGenerator` | `/ntap-tpt/application` | Generate application documents |

### Component Structure

```
frontend/src/components/
├── Chat/
│   ├── Chatbot.jsx        # Main chat interface
│   ├── MessageList.jsx    # Message display
│   ├── Message.jsx        # Single message with markdown
│   ├── MessageInput.jsx   # Input with send button
│   ├── FileUpload.jsx     # Drag-drop file upload
│   └── Citations.jsx      # Source citations display
├── CodeExplorer/
│   ├── CodeExplorer.jsx   # Code list with search/filter
│   └── CodeDetail.jsx     # Detailed code view modal
├── ReimbursementSimulator/
│   └── ReimbursementSimulator.jsx  # Scenario calculator
├── NtapTptCalculator/
│   └── NtapTptCalculator.jsx  # NTAP/TPT tabbed interface
└── ApplicationGenerator/
    └── ApplicationGenerator.jsx  # Document generation
```

### Shared Features

- **Responsive Sidebar:** Collapsible navigation with code stats
- **File Store Panel:** View and manage uploaded files
- **Code Database Stats:** Real-time counts by type
- **Breadcrumb Navigation:** Current page indicator

---

## Data Models

### Code Record
```json
{
  "code": "36903",
  "description": "Percutaneous transluminal revascularization...",
  "type": "CPT",
  "labels": ["Cardiovascular"],
  "metadata": {
    "CPT": {
      "APC": 5193,
      "SI": "J1",
      "FACILITY_RVU": 9.22,
      "NONFACILITY_RVU": 118.86
    }
  }
}
```

### Reimbursement Scenario Response
```json
{
  "code": "36903",
  "description": "...",
  "siteOfService": "Hospital Outpatient (OPPS)",
  "basePayment": 11639,
  "addOnPayment": 3770,
  "totalPayment": 15409,
  "deviceCost": 5800,
  "margin": 9609,
  "marginPercentage": "62.4",
  "classification": "profitable",
  "breakdown": {
    "basePayment": { "label": "Base Payment", "value": 11639 },
    "addOnPayment": { "label": "NTAP Add-On", "value": 3770 },
    "totalPayment": { "label": "Total Payment", "value": 15409 },
    "margin": { "label": "Margin", "value": 9609 }
  }
}
```

### NTAP Calculation Response
```json
{
  "eligible": true,
  "deviceCost": 32500,
  "drgPayment": 45000,
  "costDifference": -12500,
  "ntapPayment": 0,
  "totalReimbursement": 45000,
  "message": "Device cost does not exceed DRG payment"
}
```

### Classification Thresholds

| Classification | Margin Threshold |
|---------------|------------------|
| **Profitable** | Margin ≥ 10% of Total Payment |
| **Break-Even** | Margin between -5% and 10% |
| **Loss** | Margin < -5% of Total Payment |

### Sites of Service

| Site | Code | Description | Payment Source |
|------|------|-------------|----------------|
| IPPS | Inpatient | Inpatient Prospective Payment System | DRG-based |
| HOPD | Hospital Outpatient | Outpatient Prospective Payment System | APC-based |
| ASC | Ambulatory | Ambulatory Surgical Center | ASC rates |
| OBL | Office-Based | Physician Fee Schedule | RVU-based |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Backend server port |
| `NODE_ENV` | No | development | Environment mode |
| `GOOGLE_API_KEY` | Yes* | - | Google GenAI API key |
| `CORS_ORIGIN` | No | * | Allowed CORS origin |

*Required for AI features (chat, file search)

### Backend Configuration (`src/config/index.js`)

```javascript
{
  server: { port: 3001, env: 'development' },
  upload: { maxFileSize: 500MB },
  genai: { model: 'gemini-2.0-flash' },
  reimbursement: {
    profitableMinMargin: 0.10,
    breakEvenMinMargin: -0.05
  },
  cms: {
    facilityConversionFactor: 33.89,
    ippsMultiplier: 1.5
  },
  ntap: { percentage: 0.65, maxCap: 150000 },
  tpt: { maxPassThroughDuration: 3 }
}
```

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage
```

**Test Structure:**
```
backend/tests/
├── unit/
│   ├── models/
│   │   ├── Code.test.js
│   │   └── ReimbursementScenario.test.js
│   └── services/
│       └── codeService.test.js
└── integration/
    └── routes/
        ├── codes.test.js
        └── reimbursement.test.js
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

---

## Performance

### Code Loading (Chunked)

| Metric | Value |
|--------|-------|
| Total Codes | 164,009 |
| Chunk Files | 14 |
| Target Chunk Size | ~25MB |
| Total Load Time | ~764ms |
| Index Building | ~100ms |

### Query Performance

| Operation | Time |
|-----------|------|
| Code Lookup (by code) | O(1) ~1ms |
| Text Search | ~50-100ms |
| Pagination | ~10ms |
| Filter by Type | ~10ms |

### Memory Usage

- **Code Index:** ~200MB (in-memory Map)
- **Search Index:** ~50MB (tokenized text)
- **Type Index:** ~10MB (grouped arrays)

---

## Project Structure

```
assesment/
├── backend/
│   ├── data/
│   │   ├── codes_chunks/          # Chunked code files (~25MB each)
│   │   │   ├── manifest.json      # Chunk metadata
│   │   │   ├── codes_chunk_001.json
│   │   │   └── ... (14 chunks total)
│   │   ├── ntap_approved.json     # Approved NTAP technologies
│   │   └── tpt_approved.json      # Approved TPT technologies
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.js           # App configuration
│   │   │   └── multer.js          # File upload config
│   │   ├── controllers/
│   │   │   ├── healthController.js
│   │   │   ├── codeController.js
│   │   │   ├── reimbursementController.js
│   │   │   ├── ntapController.js
│   │   │   ├── tptController.js
│   │   │   ├── fileController.js
│   │   │   └── chatController.js
│   │   ├── middleware/
│   │   │   ├── asyncHandler.js    # Async error wrapper
│   │   │   └── errorHandler.js    # Global error handler
│   │   ├── models/
│   │   │   ├── Code.js            # Code domain model
│   │   │   ├── ReimbursementScenario.js
│   │   │   └── NtapTptEligibility.js
│   │   ├── routes/
│   │   │   ├── index.js           # Route aggregator
│   │   │   ├── healthRoutes.js
│   │   │   ├── codeRoutes.js
│   │   │   ├── reimbursementRoutes.js
│   │   │   ├── ntapRoutes.js
│   │   │   ├── tptRoutes.js
│   │   │   ├── fileRoutes.js
│   │   │   └── chatRoutes.js
│   │   ├── services/
│   │   │   ├── codeService.js     # Code indexing & search
│   │   │   ├── ntapTptService.js  # NTAP/TPT calculations
│   │   │   └── genaiService.js    # Google GenAI integration
│   │   └── app.js                 # Express app setup
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── server.js                  # Entry point
│   ├── package.json
│   └── jest.config.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   ├── CodeExplorer/
│   │   │   ├── ReimbursementSimulator/
│   │   │   ├── NtapTptCalculator/
│   │   │   └── ApplicationGenerator/
│   │   ├── domain/                # Frontend domain models
│   │   │   ├── Code.js
│   │   │   └── ReimbursementScenario.js
│   │   ├── tests/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Code Types Supported

| Type | Count | Description |
|------|-------|-------------|
| CPT | 10,779 | Current Procedural Terminology |
| HCPCS | 3 | Healthcare Common Procedure Coding System |
| ICD-10 | 74,279 | International Classification of Diseases (Diagnosis) |
| ICD-10-PCS | 78,948 | ICD-10 Procedure Coding System |
| **Total** | **164,009** | |

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Support

For issues and feature requests, please use the GitHub Issues page.
