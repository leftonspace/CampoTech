# CampoTech AI Service

Python FastAPI service for voice message processing with LangGraph.

## Overview

This service handles WhatsApp voice messages for CampoTech:
1. **Transcription**: Converts audio to text using OpenAI Whisper
2. **Extraction**: Extracts structured job data using GPT-4
3. **Routing**: Routes based on confidence level:
   - **High confidence (≥85%)**: Auto-creates job
   - **Medium confidence (50-84%)**: Asks customer for confirmation
   - **Low confidence (<50%)**: Queues for human review

## Architecture

```
services/ai/
├── main.py                 # FastAPI entry point
├── app/
│   ├── api/
│   │   └── voice.py        # API routes
│   ├── workflows/
│   │   └── voice_processing.py  # LangGraph workflow
│   ├── models/
│   │   └── schemas.py      # Pydantic models
│   ├── integrations/
│   │   ├── openai_client.py    # Whisper & GPT-4
│   │   ├── whatsapp.py     # WhatsApp API
│   │   └── postgres.py     # Database operations
│   └── middleware/
│       └── monitoring.py   # LangSmith integration
└── tests/
```

## Setup

### Prerequisites

- Python 3.11+
- OpenAI API key
- Connection to CampoTech backend

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your credentials
```

### Running Locally

```bash
# Development mode with auto-reload
uvicorn main:app --reload --port 8000

# Or using Python directly
python main.py
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_voice_workflow.py
```

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

### Process Voice Message
```
POST /api/voice/process
```
Start voice processing workflow.

**Request Body:**
```json
{
  "message_id": "wamid.HBgNNTQ5...",
  "audio_url": "https://lookaside.fbsbx.com/whatsapp/...",
  "customer_phone": "5491155551234",
  "organization_id": "org_abc123",
  "conversation_history": []
}
```

**Response:**
```json
{
  "success": true,
  "status": "completed",
  "transcription": "Hola, tengo un problema con mi heladera...",
  "extraction": {
    "title": "Reparación de heladera",
    "service_type": "refrigeracion",
    "overall_confidence": 0.92
  },
  "job_id": "job_xyz789"
}
```

### Resume Workflow
```
POST /api/voice/resume
```
Resume a paused workflow after customer confirmation.

## LangGraph Workflow

The voice processing workflow uses LangGraph for stateful execution:

```
┌─────────────┐
│  transcribe │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   extract   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│     route_by_confidence             │
├─────────┬─────────────┬─────────────┤
│ ≥85%    │  50-84%     │  <50%       │
▼         ▼             ▼             │
auto_     confirm       human_        │
create                  review        │
└─────────┴─────────────┴─────────────┘
```

## Monitoring

### LangSmith Integration

Set `LANGSMITH_API_KEY` to enable tracing:
- View workflow execution traces
- Debug failed extractions
- Monitor confidence distributions

### Metrics

The service collects:
- `voice_processing_started` - Total processing attempts
- `voice_processing_completed` - Successful completions
- `voice_confidence_score` - Distribution of confidence scores
- `voice_auto_created` - Jobs auto-created
- `voice_human_review` - Messages queued for review

## Docker

### Build
```bash
docker build -t campotech-ai .
```

### Run
```bash
docker run -p 8000:8000 --env-file .env campotech-ai
```

## Deployment

### Railway
```bash
railway up
```

### Render
Create a new Web Service pointing to `services/ai/`.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `CAMPOTECH_API_URL` | Backend URL | `http://localhost:3000` |
| `CONFIDENCE_AUTO_CREATE_THRESHOLD` | Auto-create threshold | `0.85` |
| `CONFIDENCE_CONFIRM_THRESHOLD` | Confirmation threshold | `0.50` |
| `LANGSMITH_API_KEY` | LangSmith API key | Optional |

## License

Proprietary - CampoTech
