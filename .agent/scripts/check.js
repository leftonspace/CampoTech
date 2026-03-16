const fs = require('fs');
const u = 'd:/projects/CampoTech/.agent/implementation-plans/AI_COPILOT_LANGGRAPH_UNIFICATION.md';
const text = fs.readFileSync(u, 'utf8');

const targets = [
    'B3: Session Management',
    'Adaptive Debounce',
    'Privacy',
    'What\'s Loaded Per Request',
    'Hard Limits',
    'Profile Update',
    'Session Storage Schema',
    'Relationship to Existing',
    'How the AI'
];

targets.forEach(t => {
    const i = text.indexOf(t);
    if (i === -1) {
        console.log('MISSING:', t);
    } else {
        const linesBefore = text.substring(0, i).split('\n').length;
        console.log('FOUND:', t, 'at line', linesBefore);
    }
});
