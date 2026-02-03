# Resume Update Assistant - Improvement Tickets

## Ticket 1: Varied Questioning Approach for Metrics ✅
**Priority:** High
**Status:** DONE (commit bf2d06b)

### Solution Implemented
- AI now varies question types instead of repeating
- Offers specific suggestions (time saved, users affected, revenue)
- Gives concrete examples ("hours/week", "days/month")
- Accepts qualitative impact after 2-3 attempts
- Bullets without metrics marked as isStrong: false

---

## Ticket 2: Skills Extraction Feature ✅
**Priority:** Medium
**Status:** DONE (commit 67ddccb)

### Solution Implemented
- Skills extracted from conversation alongside bullets
- Stored in session and displayed in sidebar
- Categorized: Technical, Tools, Soft Skills, Methodology
- Click individual skill to copy
- "Copy all skills" button for bulk copy
- Deduplication prevents repeats

---

## Ticket 3: Copy Button per Bullet ✅
**Priority:** High
**Status:** DONE (commit 2c3851f)

### Solution Implemented
- Copy icon appears on hover next to each bullet
- Clicking copies bullet text to clipboard
- Green highlight + tooltip feedback on copy
- Export All button still available
