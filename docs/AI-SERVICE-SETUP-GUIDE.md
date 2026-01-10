# 🤖 CampoTech AI Service Setup Guide

Complete step-by-step guide to set up and test the LangGraph-powered AI features.

---

## 📋 What You're Setting Up

CampoTech has **TWO AI features** powered by LangGraph:

### 1. **Voice Message Processing** (WhatsApp)
- Transcribes voice messages using OpenAI Whisper
- Extracts job details using GPT-4
- Auto-creates jobs or asks for confirmation
- Routes to human review if confidence is low

### 2. **Support Chat Bot** (Help Widget)
- Answers customer questions in Spanish
- Provides instant support responses
- Escalates to human if needed
- Integrated into the help widget

---

## 🎯 Prerequisites

### Required Accounts

1. **OpenAI Account** (for GPT-4 and Whisper)
   - Go to: https://platform.openai.com/signup
   - Add payment method (required for API access)
   - Get API key from: https://platform.openai.com/api-keys

2. **LangSmith Account** (OPTIONAL but recommended for debugging)
   - Go to: https://smith.langchain.com/
   - Sign up (free tier available)
   - Get API key from settings

### Required Software

- ✅ Python 3.11+ (check: `python --version`)
- ✅ PostgreSQL (already running for your main app)
- ✅ Redis (optional, for state persistence)

---

## 🚀 Step-by-Step Setup

### Step 1: Install Python Dependencies

```bash
# Navigate to AI service directory
cd d:\projects\CampoTech\services\ai

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Expected output:** Should install ~30 packages including `langgraph`, `langchain-openai`, `fastapi`

---

### Step 2: Configure Environment Variables

```bash
# Copy example env file
copy .env.example .env

# Open .env in your editor
notepad .env
```

**Edit the `.env` file with these values:**

```env
# ═══════════════════════════════════════════════════════════════
# REQUIRED - OpenAI API
# ═══════════════════════════════════════════════════════════════
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# ═══════════════════════════════════════════════════════════════
# REQUIRED - Database (use your existing Supabase connection)
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://postgres.jcdlmtixxuksdjjaqtku:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# ═══════════════════════════════════════════════════════════════
# OPTIONAL - Redis (can skip for now, uses in-memory fallback)
# ═══════════════════════════════════════════════════════════════
REDIS_URL=redis://localhost:6379/0

# ═══════════════════════════════════════════════════════════════
# OPTIONAL - LangSmith (for debugging, highly recommended)
# ═══════════════════════════════════════════════════════════════
LANGSMITH_API_KEY=lsv2_pt_YOUR_KEY_HERE
LANGSMITH_PROJECT=campotech-ai
LANGCHAIN_TRACING_V2=true

# ═══════════════════════════════════════════════════════════════
# REQUIRED - Backend URLs
# ═══════════════════════════════════════════════════════════════
CAMPOTECH_API_URL=http://localhost:3000
CAMPOTECH_API_KEY=dev-internal-key-12345

# ═══════════════════════════════════════════════════════════════
# Service Configuration
# ═══════════════════════════════════════════════════════════════
LOG_LEVEL=INFO
ENVIRONMENT=development
```

**Where to get your DATABASE_URL:**
- Check your `apps/web/.env` file
- Look for `DATABASE_URL` variable
- Copy the entire connection string

---

### Step 3: Start the AI Service

```bash
# Make sure you're in services/ai directory
cd d:\projects\CampoTech\services\ai

# Make sure venv is activated
venv\Scripts\activate

# Start the service
python main.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**✅ Success!** The AI service is now running on `http://localhost:8000`

---

### Step 4: Update Web App Environment

Open `apps/web/.env` and add:

```env
# AI Service URL (local development)
AI_SERVICE_URL=http://localhost:8000

# Already exists, just verify:
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

---

### Step 5: Test the AI Service

#### Test 1: Health Check

Open your browser or use curl:
```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "campotech-ai",
  "version": "1.0.0"
}
```

#### Test 2: Support Bot API

```bash
curl -X POST http://localhost:8000/api/support/chat \
  -H "Content-Type: application/json" \
  -d "{\"messages\": [{\"role\": \"user\", \"content\": \"Hola, cómo funciona CampoTech?\"}]}"
```

**Expected response:**
```json
{
  "response": "¡Hola! CampoTech es una plataforma que conecta...",
  "session_id": "abc123",
  "needs_escalation": false
}
```

---

## 🧪 Testing in the Web App

### Test the Support Chat Bot

1. **Start your web app:**
   ```bash
   cd d:\projects\CampoTech\apps\web
   pnpm dev
   ```

2. **Open browser:** http://localhost:3000

3. **Click the Help Widget** (bottom right corner - blue question mark icon)

4. **Click "Chat con IA"** (the green gradient option with "Nuevo" badge)

5. **Type a question in Spanish:**
   - "Cómo funciona CampoTech?"
   - "Qué servicios ofrecen?"
   - "Cómo creo un trabajo?"

6. **Watch the AI respond!** 🎉

**What's happening:**
```
Your Browser
    ↓ (question)
Next.js API Route (/api/support/chat)
    ↓ (forwards to AI service)
FastAPI AI Service (localhost:8000)
    ↓ (calls OpenAI GPT-4)
OpenAI API
    ↓ (response)
FastAPI → Next.js → Browser
```

---

## 🎤 Testing Voice Processing (Advanced)

### Prerequisites for Voice Testing

You'll need:
1. A WhatsApp Business Account
2. Meta Business Account
3. WhatsApp API access

**For now, you can test the API directly:**

```bash
# Create a test audio file URL (use any public audio file)
curl -X POST http://localhost:8000/api/voice/process \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "test_123",
    "audio_url": "https://example.com/test-audio.ogg",
    "customer_phone": "5491155551234",
    "organization_id": "your_org_id",
    "conversation_history": []
  }'
```

---

## 🔍 Debugging with LangSmith (Optional)

### Setup LangSmith

1. **Sign up:** https://smith.langchain.com/

2. **Create a project:** "campotech-ai"

3. **Get API key:** Settings → API Keys

4. **Add to `.env`:**
   ```env
   LANGSMITH_API_KEY=lsv2_pt_YOUR_KEY_HERE
   LANGSMITH_PROJECT=campotech-ai
   LANGCHAIN_TRACING_V2=true
   ```

5. **Restart AI service**

6. **View traces:** https://smith.langchain.com/

**What you'll see:**
- Every AI conversation
- Token usage
- Latency metrics
- Error traces
- Full conversation history

---

## 🐛 Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'langgraph'"

**Solution:**
```bash
# Make sure venv is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

---

### Issue: "OpenAI API key not found"

**Solution:**
1. Check `.env` file exists in `services/ai/`
2. Verify `OPENAI_API_KEY` is set
3. Restart the AI service

---

### Issue: "Connection refused to localhost:8000"

**Solution:**
1. Make sure AI service is running: `python main.py`
2. Check for errors in the terminal
3. Verify port 8000 is not in use

---

### Issue: "Database connection failed"

**Solution:**
1. Verify `DATABASE_URL` in `.env`
2. Test connection from web app first
3. Make sure Supabase is accessible

---

### Issue: AI responses are slow

**Expected:** First response takes 2-5 seconds (OpenAI API call)

**If slower:**
1. Check your internet connection
2. Verify OpenAI API status: https://status.openai.com/
3. Check LangSmith traces for bottlenecks

---

## 📊 Monitoring

### Check AI Service Logs

```bash
# In the terminal where AI service is running
# You'll see:
INFO:     127.0.0.1:52341 - "POST /api/support/chat HTTP/1.1" 200 OK
INFO:     Processing support request...
INFO:     OpenAI response received in 2.3s
```

### Check Web App Logs

```bash
# In your Next.js terminal
[AIChatWidget] Sending message: Hola
[AIChatWidget] Response received: ¡Hola! CampoTech es...
```

---

## 🎯 Next Steps

Once everything is working:

1. **Test different questions** to see AI responses
2. **Check LangSmith** to see conversation traces
3. **Monitor token usage** in OpenAI dashboard
4. **Deploy AI service** to Railway/Render for production

---

## 💰 Cost Estimation

### OpenAI API Costs (approximate)

- **Support Chat:** ~$0.002 per conversation (GPT-4-turbo)
- **Voice Processing:** ~$0.006 per minute (Whisper) + ~$0.003 (GPT-4)

**Monthly estimate for 1000 conversations:**
- Support: $2
- Voice: $9
- **Total: ~$11/month**

**Free tier:** $5 credit for new accounts

---

## 📝 Summary Checklist

- [ ] Python 3.11+ installed
- [ ] OpenAI account created
- [ ] OpenAI API key obtained
- [ ] Virtual environment created
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file configured
- [ ] AI service started (`python main.py`)
- [ ] Health check passed (http://localhost:8000/health)
- [ ] Web app `.env` updated with `AI_SERVICE_URL`
- [ ] Support chat tested in browser
- [ ] (Optional) LangSmith configured

---

## 🆘 Need Help?

**Check these files for reference:**
- `services/ai/README.md` - Service documentation
- `services/ai/app/workflows/support_bot.py` - Support bot logic
- `services/ai/app/workflows/voice_processing.py` - Voice processing logic
- `apps/web/components/support/AIChatWidget.tsx` - Chat UI

**Common commands:**
```bash
# Start AI service
cd services/ai
venv\Scripts\activate
python main.py

# Start web app
cd apps/web
pnpm dev

# View AI service logs
# (in AI service terminal)

# Test health
curl http://localhost:8000/health
```

---

**Ready to test? Start with Step 1! 🚀**
