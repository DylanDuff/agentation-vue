# Toolbar to server sync

How the browser toolbar keeps its locally stored annotations in step with the
MCP server (`agentation-mcp`) when an `endpoint` is set. Code lives in:

- `package-core/src/utils/sync.ts`: HTTP helpers, including `getAnnotation` and `partitionLocalAnnotations`
- `package-core/src/utils/session-resolutions.ts`: live and polled resolution updates
- `package-core/src/ui/components/page-toolbar-css/index.tsx`: `syncLocalFeedback` and the three sync entry points
- `mcp/src/server/http.ts`: `POST /sessions/:id/annotations`

## Identity

- Annotations are stored per page in `localStorage` (`feedback-annotations-<path>`),
  and the session ID per page in `agentation-session-<path>`.
- A new note gets a client ID. When the upload succeeds, the stored copy takes the
  server ID. From then on **the stored ID is the server ID**, so it identifies the
  note on the server no matter which session it was created in.
- `_syncedTo` is still written for compatibility but no sync decision depends on it.

## When the toolbar syncs

All three paths go through `syncLocalFeedback`:

| Trigger | Session used |
| --- | --- |
| Mount with a stored or `sessionId` prop session | Joins that session |
| Mount with no session, or the join fails | Creates one for the current page. Other pages with notes to upload get their own session, which is now saved for that page |
| Health check goes from disconnected to connected | Current session, or a new one if it no longer exists |

## What gets uploaded

`partitionLocalAnnotations` decides, for each stored feedback note:

1. In the session's annotation list: nothing to do.
2. Otherwise `GET /annotations/:id`:
   - **404**: the server never saw it (or lost it, e.g. an in-memory store restarted). Upload it.
   - **Found** (any session): never re-posted. The server copy replaces the local one, so a
     `resolved` or `dismissed` status removes it from the page.
   - **Request failed**: keep the local copy untouched and try again next time.

Before this, any note missing from the session being joined was posted again. Because
sessions are per page and a new one is created whenever none is stored, that minted a
duplicate under a new ID and a new session on reloads and reconnects.

The server is also idempotent: `POST /sessions/:id/annotations` with a body `id` that
already exists returns the existing annotation with `200` (unchanged, still in its
original session) instead of creating a copy. This protects against older toolbars.

## Resolutions reaching the page

`subscribeSessionResolutions` listens to `GET /sessions/:id/events` for the current
session and, every 10 seconds while the page has feedback, re-reads the session. Notes
on the page that belong to another session get no events there, so the periodic check
also looks each of them up with `GET /annotations/:id` and removes any the agent
resolved or dismissed.
