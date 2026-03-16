const fs = require('fs');

const workshopPath = 'd:/projects/CampoTech/.agent/implementation-plans/AI_SUBAGENT_DESIGN_WORKSHOP.md';
const unificationPath = 'd:/projects/CampoTech/.agent/implementation-plans/AI_COPILOT_LANGGRAPH_UNIFICATION.md';

let ws = fs.readFileSync(workshopPath, 'utf8').replace(/\r\n/g, '\n');
let un = fs.readFileSync(unificationPath, 'utf8').replace(/\r\n/g, '\n');

const startMarker = '### Context Window & Session Management';
const endMarker = '## Cross-References to Main Plan';

let s = ws.indexOf(startMarker);
let e = ws.indexOf(endMarker, s);

let dashE = ws.lastIndexOf('---\n', e);
if (dashE > s) {
    e = dashE;
}

const block = ws.substring(s, e);
const note = `> 📌 **MOVED TO UNIFICATION DOCUMENT:**\n> The infrastructure sections previously located here (Context Window, Session Management, Message Burst Handling, Debounce Learning, Privacy Framework, Context Limits, Profile Triggers, and Storage Schemas) have been officially migrated to \`AI_COPILOT_LANGGRAPH_UNIFICATION.md\` as they pertain to system orchestration rather than sub-agent domain design.\n\n`;

const newWs = ws.substring(0, s) + note + ws.substring(e);
fs.writeFileSync(workshopPath, newWs);
console.log('Successfully updated AI_SUBAGENT_DESIGN_WORKSHOP.md');

function extract(start, end) {
    let a = block.indexOf(start);
    if (a === -1) return '';
    if (!end) return block.substring(a);
    let b = block.indexOf(end, a);
    if (b === -1) return block.substring(a);
    return block.substring(a, b);
}

let sec1 = extract('### Context Window & Session Management', '#### Message Burst Handling & Debounce');
let sec2 = extract('#### Message Burst Handling & Debounce', '#### Adaptive Debounce Learning (Per-Customer)');
let sec3 = extract('#### Adaptive Debounce Learning (Per-Customer)', '#### Privacy & Data Access Legal Framework (Ley 25.326 + AAIP)');
let sec4 = extract('#### Privacy & Data Access Legal Framework (Ley 25.326 + AAIP)', "#### What's Loaded Per Request (3 Layers)");
let sec5 = extract("#### What's Loaded Per Request (3 Layers)", '#### Hard Limits');
let sec6 = extract('#### Hard Limits', '#### Profile Update Triggers');
let sec7 = extract('#### Profile Update Triggers', '#### How the AI References Past Interactions');
let sec8 = extract('#### How the AI References Past Interactions', '#### Session Storage Schema');
let sec9 = extract('#### Session Storage Schema', '#### Relationship to Existing Infrastructure');
let sec10 = extract('#### Relationship to Existing Infrastructure', null);

function reqRep(text, search, replacement) {
    if (text.indexOf(search) === -1) {
        console.error('FAILED TO FIND: ' + search.substring(0, 40));
        return text;
    }
    return text.replace(search, replacement);
}

sec1 = sec1.replace('### Context Window & Session Management\n\n', '');
un = reqRep(un, '### B3: Session Context & WhatsApp Message Locking\n\n> ⚠️ **Critical for WhatsApp:** Redis IS required for message locking to prevent race conditions.\n> For session caching, PostgreSQL is sufficient initially.', '### B3: Session Management & WhatsApp Infrastructure\n\n' + sec1 + '> ⚠️ **Critical for WhatsApp:** Redis IS required for message locking to prevent race conditions.\n> For session caching, PostgreSQL is sufficient initially.');
un = reqRep(un, '**The WhatsApp Race Condition Problem:**', sec2 + '\n**The WhatsApp Race Condition Problem:**');
un = reqRep(un, '### B4: Communication Style Adaptation', sec3 + '### B5: Communication Style Adaptation');
un = reqRep(un, '## Phase C: Planning & Tools (Weeks 17-20)', sec4 + '---\n\n## Phase C: Planning & Tools (Weeks 17-20)');
un = reqRep(un, '**Working Memory Pattern (Token Optimization):**', sec5 + '\n**Working Memory Pattern (Token Optimization):**');
un = reqRep(un, '| Working memory pattern | ~500 | $ |', '| Working memory pattern | ~500 | $ |\n\n' + sec6);
un = reqRep(un, '**Tier 2: Intent-Based Profile Extraction (Not Cron)**', '**Tier 2: Intent-Based Profile Extraction (Not Cron)**\n\n' + sec7);
un = reqRep(un, '  @@map("customer_ai_profiles")\n}\n```', '  @@map("customer_ai_profiles")\n}\n```\n\n' + sec8);
un = reqRep(un, '**Phase B3a: PostgreSQL-Only (Dashboard Copilot)**\n```python\n# Works fine for dashboard - no burst messages\nasync def load_session_context(conversation_id: str) -> dict:\n    return await prisma.aiconversationlog.find_many(\n        where={"conversationId": conversation_id},\n        take=20,\n        order={"createdAt": "desc"}\n    )\n```', sec9);
un = reqRep(un, '    "queue": "org:{org_id}:whatsapp:queue:{conversation_id}",  # No TTL\n    "rate": "org:{org_id}:rate:{user_id}",                 # TTL: 60 seconds\n}', '    "queue": "org:{org_id}:whatsapp:queue:{conversation_id}",  # No TTL\n    "rate": "org:{org_id}:rate:{user_id}",                 # TTL: 60 seconds\n}\n```\n\n' + sec10);

fs.writeFileSync(unificationPath, un);
console.log('Successfully updated AI_COPILOT_LANGGRAPH_UNIFICATION.md!');
