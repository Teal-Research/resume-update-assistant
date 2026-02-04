# Resume Update Assistant - Improvement Tickets

## Completed
- ✅ Ticket 1: Varied Questioning (bf2d06b)
- ✅ Ticket 2: Skills Extraction (67ddccb)
- ✅ Ticket 3: Copy Button per Bullet (2c3851f)
- ✅ Ticket 4: Proactive Accomplishment Suggestions (4b858a2)
- ✅ Ticket 5: Smart Metric Suggestions (4b858a2)
- ✅ Ticket 6: Polish Bullets (172d83c)
- ✅ Ticket 7: Discovery Phase Before Specifics (SKILL.md updated)
- ✅ Ticket 8: Voice Input with Browser Speech Recognition
- ✅ Ticket 9: Maintain Chat Input Focus (requestAnimationFrame fix)
- ✅ Ticket 10: Working Bullet Preview in Sidebar (already existed)
- ✅ Ticket 11: Distinguish Imported vs New Bullets with Icons (📄/✨ already implemented)
- ✅ Ticket 12: Adapt to User's Communication Style (tone matching in SKILL.md)
- ✅ Ticket 13: Update Bullet Tool (updateBullet tool added)

---

## Implementation Notes

### Ticket 8: Voice Input
- Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition)
- Mic button toggles recording on/off
- Pulsing red indicator when recording
- Continuous mode - keeps listening until user clicks again
- Interim results shown in status, final results appended to input
- Graceful fallback for unsupported browsers (button disabled)

### Ticket 12: Tone Matching
Added to SKILL.md system prompt:
- Mirror user's communication style (brief vs detailed)
- Match tone (casual vs professional)
- Watch for cues: one-word answers, emojis, formal language
- Adapt response length to user's verbosity

### Ticket 13: Update Bullet Tool
- New `updateBullet` tool for improving existing bullets
- Finds bullets by company + partial text match (fuzzy)
- Streams `bulletUpdate` event to frontend
- Frontend updates bullet in place without adding duplicate
