// =============================================================================
// Server Sync Utilities
// =============================================================================
//
// Optional server synchronization for the Agentation protocol.
// When an endpoint is provided, annotations sync to a server.
// Falls back gracefully to local-only mode on network errors.
//

import type { Annotation, Session, SessionWithAnnotations } from "../types";

/**
 * List all sessions from the server.
 */
export async function listSessions(endpoint: string): Promise<Session[]> {
  const response = await fetch(`${endpoint}/sessions`);
  if (!response.ok) {
    throw new Error(`Failed to list sessions: ${response.status}`);
  }
  return response.json();
}

/**
 * Create a new session on the server.
 */
export async function createSession(
  endpoint: string,
  url: string
): Promise<Session> {
  const response = await fetch(`${endpoint}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  return response.json();
}

/**
 * Get an existing session with its annotations.
 */
export async function getSession(
  endpoint: string,
  sessionId: string
): Promise<SessionWithAnnotations> {
  const response = await fetch(`${endpoint}/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch one annotation by ID, from whichever session holds it. Resolves to
 * null on 404 so callers can tell "the server never saw it" apart from a
 * failed request.
 */
export async function getAnnotation(
  endpoint: string,
  annotationId: string,
  signal?: AbortSignal
): Promise<Annotation | null> {
  const response = await fetch(`${endpoint}/annotations/${annotationId}`, signal ? { signal } : undefined);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to get annotation: ${response.status}`);
  }

  return response.json();
}

/**
 * Split stored annotations into those that still need posting to a session
 * and those the server already holds.
 *
 * Once synced, a stored annotation carries its server ID. Missing from the
 * session being joined does not mean missing from the server: it may live in
 * an earlier session for the same page. Each such note is looked up by ID and
 * only a 404 marks it for upload. `known` holds the server's copy (so its
 * status, e.g. resolved by the agent, wins) or, when the lookup failed, the
 * local copy untouched until the next attempt.
 */
export async function partitionLocalAnnotations(
  endpoint: string,
  local: readonly Annotation[],
  sessionAnnotations: readonly Annotation[]
): Promise<{ upload: Annotation[]; known: Annotation[] }> {
  const inSession = new Set(sessionAnnotations.map((annotation) => annotation.id));
  const lookups = await Promise.all(
    local
      .filter((annotation) => !inSession.has(annotation.id))
      .map(async (annotation) => {
        try {
          const remote = await getAnnotation(endpoint, annotation.id);
          if (!remote) return { annotation, upload: true };
          return { annotation: remote.id === annotation.id ? remote : annotation, upload: false };
        } catch {
          return { annotation, upload: false };
        }
      })
  );
  return {
    upload: lookups.filter((lookup) => lookup.upload).map((lookup) => lookup.annotation),
    known: lookups.filter((lookup) => !lookup.upload).map((lookup) => lookup.annotation),
  };
}

/**
 * Sync a new annotation to the server.
 * Returns the annotation with any server-assigned fields.
 */
export async function syncAnnotation(
  endpoint: string,
  sessionId: string,
  annotation: Annotation
): Promise<Annotation> {
  // Older page-level notes were saved with an empty path, which the server
  // rejects. Repair only the two known document elements when retrying them.
  if (!annotation.elementPath && (annotation.element === "body" || annotation.element === "html")) {
    annotation = { ...annotation, elementPath: annotation.element };
  }
  const response = await fetch(`${endpoint}/sessions/${sessionId}/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync annotation: ${response.status}`);
  }

  return response.json();
}

/**
 * Update an annotation on the server.
 */
export async function updateAnnotation(
  endpoint: string,
  annotationId: string,
  data: Partial<Annotation>
): Promise<Annotation> {
  const response = await fetch(`${endpoint}/annotations/${annotationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update annotation: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete an annotation from the server.
 */
export async function deleteAnnotation(
  endpoint: string,
  annotationId: string
): Promise<void> {
  const response = await fetch(`${endpoint}/annotations/${annotationId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete annotation: ${response.status}`);
  }
}

export type ActionResponse = {
  success: boolean;
  annotationCount: number;
  delivered: {
    sseListeners: number;
    webhooks: number;
    total: number;
  };
};

/**
 * Request the agent to act on annotations.
 * Emits an action.requested event via SSE to notify connected agents.
 * Returns delivery info so the UI can show accurate feedback.
 */
export async function requestAction(
  endpoint: string,
  sessionId: string,
  output: string
): Promise<ActionResponse> {
  const response = await fetch(`${endpoint}/sessions/${sessionId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ output }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request action: ${response.status}`);
  }

  return response.json();
}
