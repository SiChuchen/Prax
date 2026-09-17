# state_ownership_declared — receipt (pass)

screen.sdir.yaml state_ownership:
- selection → owner: session
- mode → owner: session
- query → owner: region-event-feed
- viewport → owner: session

interaction.preview = "none" (explicitly declared, no preview state offered). Selection owner declared — check satisfied; implementation matches (single selectedId in js/app.js closure = session-owned selection; filterAnomalyOnly lives with the feed region logic).
