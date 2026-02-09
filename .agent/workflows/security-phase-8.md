---
description: Security Audit Phase 8 - AI/LLM Security (AI-SEC Agent)
---

# Phase 8: AI/LLM Security Audit

**Agent Role:** AI-SEC
**Priority:** P1 (High)
**Estimated Effort:** 2 hours
**Dependencies:** Phase 2 (Auth)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the AI/LLM infrastructure for:
- Prompt injection vulnerabilities
- Context leakage and PII exposure
- API key security and cost abuse prevention
- Input sanitization before LLM calls
- Output validation and safe rendering
- Rate limiting on AI endpoints

---

## EXECUTION STEPS

### Step 1: Discover All AI-Related Files

// turbo
1. Find all AI-related files:
```powershell
cd d:\projects\CampoTech
Get-ChildItem -Recurse -Include "*ai*", "*openai*", "*llm*", "*copilot*", "*assistant*", "*gpt*" -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.next|\.expo|\.git" } | Select-Object FullName
```

2. Find AI API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "ai|copilot|assistant" } | Select-Object FullName
```

3. List Python AI service files:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\services\ai" -Recurse -Filter "*.py" -ErrorAction SilentlyContinue | Select-Object FullName
```

### Step 2: OpenAI API Key Security (CRITICAL)

4. Search for OpenAI key usage:
```powershell
rg "OPENAI_API_KEY|openai.*key|apiKey.*openai" --type ts --type py -g "!node_modules" -A 3
```

5. Verify API key is from environment only:
```powershell
rg "sk-[a-zA-Z0-9]{20,}" --type ts --type py -g "!node_modules"  # Hardcoded API keys
```

6. Check for API key exposure in logs:
```powershell
rg "console\.log.*openai|console\.log.*api.?key|print.*api.?key" --type ts --type py -g "!node_modules"
```

7. View OpenAI integration files:
   - Directory: `d:\projects\CampoTech\apps\web\lib\integrations\openai\`
   - Check: API key initialization
   - Check: Error handling (no key in error messages)
   - Check: Request/response logging

### Step 3: Prompt Injection Prevention (CRITICAL)

8. View the AI Staff Assistant:
   - File: `d:\projects\CampoTech\apps\web\lib\services\ai-staff-assistant.ts`
   - **CRITICAL CHECK:** Is user input sanitized before including in prompts?
   - **CRITICAL CHECK:** Are system prompts separated from user input?
   - **CRITICAL CHECK:** Is there prompt template protection?

9. Search for prompt construction:
```powershell
rg "system.*prompt|systemPrompt|userPrompt|messages.*role" --type ts -g "!node_modules" -A 10
```

10. View the WhatsApp AI responder:
    - File: `d:\projects\CampoTech\apps\web\lib\services\whatsapp-ai-responder.ts`
    - Check: How user messages are incorporated into prompts
    - Check: Escape sequences for special characters

11. Search for template literal prompts (HIGH RISK):
```powershell
rg "\`.*\$\{.*\}.*\`" --type ts -g "lib/services/*ai*" -A 5
```

12. Search for user input in prompts:
```powershell
rg "user\.message|message\.text|body\.prompt|input.*content" --type ts -g "lib/services/*ai*" -A 8
```

13. Check for prompt injection sanitization:
```powershell
rg "sanitize|escape|clean.*input|stripHtml|encode" --type ts -g "lib/services/*ai*" -A 3
```

### Step 4: AI API Endpoint Security

14. View AI API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\ai" -Recurse -Filter "route.ts" | Select-Object FullName
```

15. For EACH AI endpoint, verify:
    - Authentication required (getSession check)
    - Role-based access control
    - Rate limiting applied
    - Input validation with Zod or similar

16. View Copilot endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\copilot" -Recurse -Filter "route.ts" | Select-Object FullName
```

17. Search for missing auth on AI endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" | Where-Object { $_.FullName -match "ai|copilot" } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -notmatch "getSession|authenticateRequest") {
        Write-Host "NO AUTH: $($_.FullName)"
    }
}
```

### Step 5: Context Leakage Prevention

18. Search for PII in AI prompts:
```powershell
rg "email|phone|address|cuit|password|token" --type ts -g "lib/services/*ai*" -A 5
```

19. Check for sensitive data inclusion in context:
    - **CRITICAL:** Does AI have access to financial data?
    - **CRITICAL:** Can AI see other organizations' data?
    - Check: Is tenant isolation enforced in AI context?

20. Search for context building:
```powershell
rg "buildContext|getContext|prepareContext|gatherContext" --type ts -g "!node_modules" -A 15
```

21. Verify tenant isolation in AI queries:
```powershell
rg "organizationId" --type ts -g "lib/services/*ai*" -A 3
```

22. Search for cross-tenant data in AI:
```powershell
rg "findMany|findFirst" --type ts -g "lib/services/*ai*" -A 8
```

### Step 6: Python AI Service Audit

23. View the AI service entry point:
    - File: `d:\projects\CampoTech\services\ai\main.py`
    - Check: Authentication on endpoints
    - Check: API key validation
    - Check: Rate limiting

24. List all AI service endpoints:
```powershell
rg "(@app\.post|@app\.get|@router\.)" --type py -g "services/ai/*" -A 5
```

25. Audit prompt construction in Python:
```powershell
rg "f\"|f\'|format\(|\.format" --type py -g "services/ai/*" -A 3
```

26. Check for LangChain or similar:
```powershell
rg "langchain|llm|chain|prompt|ChatOpenAI" --type py -g "services/ai/*" -A 5
```

27. Verify Python dependencies:
    - File: `d:\projects\CampoTech\services\ai\requirements.txt`
    - Check: OpenAI SDK version
    - Check: Known vulnerabilities in deps

### Step 7: Output Validation and Safe Rendering

28. Search for AI output handling:
```powershell
rg "response\.text|completion|message\.content|choices\[0\]" --type ts -g "!node_modules" -A 5
```

29. Check for unsafe output rendering:
```powershell
rg "dangerouslySetInnerHTML|innerHTML|v-html" --type ts --type tsx -g "!node_modules" -A 3
```

30. Verify AI responses are sanitized:
    - Check: HTML entities encoded
    - Check: Script tags stripped
    - Check: Markdown safely rendered

31. Search for output validation:
```powershell
rg "validateOutput|sanitizeResponse|cleanResponse" --type ts -g "!node_modules" -A 5
```

### Step 8: Rate Limiting and Cost Control

32. Search for AI rate limiting:
```powershell
rg "rateLimitAI|aiRateLimit|throttleAI|rateLimiter" --type ts -g "!node_modules" -A 5
```

33. Verify rate limits on AI endpoints:
```powershell
rg "rateLimit|Ratelimit|upstash" --type ts -g "app/api/ai/*" -A 3
rg "rateLimit|Ratelimit|upstash" --type ts -g "app/api/copilot/*" -A 3
```

34. Check for usage tracking:
```powershell
rg "usage|tokens|cost|billing" --type ts -g "lib/services/*ai*" -A 5
```

35. Search for max token limits:
```powershell
rg "max_tokens|maxTokens|token.?limit" --type ts --type py -g "!node_modules" -A 3
```

### Step 9: AI-Specific Authentication

36. Check for AI service authentication:
```powershell
rg "AI_SERVICE_KEY|AI_AUTH|serviceToken" --type ts --type py -g "!node_modules" -A 3
```

37. Verify AI service isolation:
    - Check: Separate credentials from main app
    - Check: Service-to-service authentication

38. Search for AI bypass patterns:
```powershell
rg -i "(skip.*ai|bypass.*ai|ai.*false|disable.*ai)" --type ts -g "!node_modules"
```

### Step 10: Logging and Audit Trail

39. Search for AI logging:
```powershell
rg "logAI|aiAudit|auditLog.*ai" --type ts -g "!node_modules" -A 5
```

40. Verify AI operations are logged:
    - All AI requests (success/failure)
    - User ID and organization context
    - Prompt type (not full content)
    - Token usage

41. Check for sensitive data in AI logs:
```powershell
rg "console\.log.*prompt|console\.log.*completion|logger.*message" --type ts -g "lib/services/*ai*"
```

42. Verify prompts are NOT fully logged:
```powershell
rg "log.*system.*prompt|log.*user.*prompt" --type ts -g "!node_modules"
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] OpenAI API key stored in environment only (never hardcoded)
- [ ] User input sanitized before inclusion in prompts
- [ ] System prompts separated from user input
- [ ] All AI endpoints require authentication
- [ ] Tenant isolation enforced in AI context gathering
- [ ] No PII included in prompts unnecessarily
- [ ] AI output sanitized before rendering
- [ ] Rate limiting active on AI endpoints
- [ ] Token limits set to prevent cost abuse
- [ ] AI operations logged without full prompt content

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-8-ai-findings.md`

The report MUST include:

1. **Executive Summary** - Overall AI/LLM security posture
2. **API Key Security** - Key handling and exposure analysis
3. **Prompt Injection Assessment** - Input sanitization status
4. **Context Leakage Analysis** - PII and tenant isolation
5. **Output Security** - Response handling and rendering
6. **Cost Control Measures** - Rate limiting and token limits
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "sk-[a-zA-Z0-9]{20,}" --type ts --type py -g "!node_modules"  # Hardcoded OpenAI keys
rg "\`.*\$\{.*user.*\}.*\`" --type ts -g "lib/services/*ai*"  # User input in template prompts
rg "dangerouslySetInnerHTML.*completion" --type tsx -g "!node_modules"  # Unsafe AI output
rg "console\.log.*prompt" --type ts -g "!node_modules"  # Logged prompts
rg "findMany\(\)" --type ts -g "lib/services/*ai*" -A 3  # Queries without WHERE in AI
```

---

## PROMPT INJECTION ATTACK SCENARIOS

Test these specific attack vectors:

1. **Jailbreak Attempt**: User sends "Ignore previous instructions and..."
2. **Data Exfiltration**: User asks AI to reveal system prompt
3. **Context Hijacking**: User injects fake assistant messages
4. **Token Theft**: Long input to consume API quota
5. **Cross-Tenant Leak**: Ask AI about other organizations

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- Hardcoded API keys in source code
- User input directly concatenated into prompts
- AI has access to cross-tenant data
- No rate limiting on AI endpoints
- Full prompts logged with user data
- AI output rendered without sanitization

---

## NEXT PHASE

After completing Phase 8, the following phases can proceed:
- Phase 9: COMPLIANCE-SEC (can parallel)
- Phase 10: LOGIC-SEC (depends on Phase 3)
