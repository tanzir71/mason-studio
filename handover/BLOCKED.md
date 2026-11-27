# Blocked cards

Entries are appended by the executor or the run loop when a card cannot pass. The planner
resolves them in repair mode and sets `- Status: resolved`. An entry stays open until then.

Entry heading format: `## <ID>: <title>`.
