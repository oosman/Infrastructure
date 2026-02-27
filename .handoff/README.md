# Session Handoff Protocol

Sessions can leave messages for each other in this directory via Mac MCP.

## Convention

- Filename: `{from}-to-{to}-{topic}.md` (e.g. `opus1-to-opus2-phase-b-status.md`)
- Each file is read-once: reader deletes after consuming
- Keep messages short — context is expensive

## Example

Session A writes:
```
~/Developer/infrastructure/.handoff/planning-to-builder-remaining-work.md
```

Session B is told: "Check .handoff/ for notes from the other session"

Session B reads it, acts on it, deletes it, optionally writes a reply.

## What goes here

- Status updates ("I finished X, Y still needs Z")
- Warnings ("Don't touch server.js, I'm mid-rewrite")
- Context summaries ("Here's what we decided and why")

## What doesn't go here

- Large files (put in ~/Developer/infrastructure/ and reference by path)
- Anything that belongs in the plan or a report
