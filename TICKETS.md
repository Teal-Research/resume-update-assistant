# Resume Update Assistant - Improvement Tickets

## Ticket 1: Varied Questioning Approach for Metrics
**Priority:** High
**Status:** TODO

### Problem
The chat is too focused on repeatedly asking for metrics in the same way. Users often don't know how to quantify their accomplishments.

### Solution
- Update the prompt to vary questioning approaches
- Offer specific examples/suggestions to help users think of metrics
- Provide prompts like:
  - "Did this save time? How much per week/month?"
  - "How many people used this? How many were on the team?"
  - "Did this affect revenue? Even a rough estimate helps"
  - "What was the before vs after?"
- If user struggles after 2 attempts, help them estimate or accept qualitative impact

### Acceptance Criteria
- [ ] Prompt includes varied questioning strategies
- [ ] Provides concrete examples to help users think of metrics
- [ ] Doesn't get stuck in a loop asking the same question
- [ ] Can gracefully accept qualitative impact if metrics aren't available

---

## Ticket 2: Skills Extraction Feature
**Priority:** Medium
**Status:** TODO

### Problem
Users might find it easier to identify skills they used rather than jumping straight into accomplishments. Skills can also be valuable resume content.

### Solution
- Add skills detection to the conversation flow
- When discussing accomplishments, identify and extract relevant skills
- Store skills separately in the sidebar
- Could be technologies, soft skills, methodologies, etc.

### Acceptance Criteria
- [ ] Skills are extracted from conversation
- [ ] Skills appear in sidebar (separate section from bullets)
- [ ] Skills are categorized (technical, soft skills, tools, etc.)
- [ ] Can copy/export skills

---

## Ticket 3: Copy Button per Bullet
**Priority:** High
**Status:** TODO

### Problem
Currently there's only an "Export" button at the bottom. Users want to copy individual bullets as they're generated.

### Solution
- Add a copy icon/button next to each bullet in the sidebar
- Click copies just that bullet text to clipboard
- Show brief "Copied!" feedback
- Keep the Export All button for convenience

### Acceptance Criteria
- [ ] Each bullet has a copy button
- [ ] Clicking copies the bullet text to clipboard
- [ ] Visual feedback on copy (tooltip or brief highlight)
- [ ] Export All button still works

---

## Implementation Order
1. Ticket 3 (Copy per bullet) - Quick UI win
2. Ticket 1 (Varied questioning) - Core UX improvement
3. Ticket 2 (Skills extraction) - New feature
