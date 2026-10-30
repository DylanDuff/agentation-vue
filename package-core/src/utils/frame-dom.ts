import type { Annotation } from "../types";

/** Same-origin frame helpers. Never access a cross-origin child document. */
export function frameDocument(frame: Element): Document | null {
  if (frame.tagName !== "IFRAME") return null;
  try {
    return (frame as HTMLIFrameElement).contentDocument;
  } catch {
    return null;
  }
}

export function parentFrame(doc: Document, root: Document = document): HTMLIFrameElement | null {
  if (doc === root) return null;
  try {
    return doc.defaultView?.frameElement as HTMLIFrameElement | null;
  } catch {
    return null;
  }
}

export function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && "host" in node;
}

export function frameGeometry(frame: HTMLIFrameElement) {
  const rect = frame.getBoundingClientRect();
  const sx = frame.offsetWidth ? rect.width / frame.offsetWidth : 1;
  const sy = frame.offsetHeight ? rect.height / frame.offsetHeight : 1;
  // clientLeft/Top cover borders; padding also offsets the frame's viewport.
  const style = frame.ownerDocument.defaultView?.getComputedStyle(frame);
  const padding = (value?: string) => parseFloat(value || "0") || 0;
  const left = padding(style?.paddingLeft), top = padding(style?.paddingTop);
  const width = frame.clientWidth - left - padding(style?.paddingRight);
  const height = frame.clientHeight - top - padding(style?.paddingBottom);
  return {
    x: rect.left + (frame.clientLeft + left) * sx,
    y: rect.top + (frame.clientTop + top) * sy,
    sx,
    sy,
    width: width * sx,
    height: height * sy,
  };
}

/** Frames are matched by origin and pathname so in-frame hash or query changes keep their notes. */
export function frameLocationKey(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

export function viewportPoint(doc: Document, x: number, y: number, root: Document = document): { x: number; y: number } {
  let frame = parentFrame(doc, root);
  while (frame) {
    const box = frameGeometry(frame);
    x = box.x + x * box.sx;
    y = box.y + y * box.sy;
    frame = parentFrame(frame.ownerDocument, root);
  }
  return { x, y };
}

export function viewportRect(element: Element, root: Document = document): DOMRect {
  const rect = element.getBoundingClientRect();
  return rectInViewport(element.ownerDocument, rect, root);
}

function rectInViewport(doc: Document, rect: DOMRect, root: Document): DOMRect {
  if (!parentFrame(doc, root)) return rect;
  let left = rect.left,
    top = rect.top,
    right = rect.right,
    bottom = rect.bottom;
  let frame = parentFrame(doc, root);
  while (frame) {
    const box = frameGeometry(frame);
    left = Math.max(box.x, box.x + left * box.sx);
    top = Math.max(box.y, box.y + top * box.sy);
    right = Math.min(box.x + box.width, box.x + right * box.sx);
    bottom = Math.min(box.y + box.height, box.y + bottom * box.sy);
    frame = parentFrame(frame.ownerDocument, root);
  }
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

function framesIn(root: Document | ShadowRoot): HTMLIFrameElement[] {
  const result: HTMLIFrameElement[] = [];
  for (const element of root.querySelectorAll("*")) {
    if (element.tagName === "IFRAME") result.push(element as HTMLIFrameElement);
    if (element.shadowRoot && element.tagName !== "AGENTATION-TOOLBAR")
      result.push(...framesIn(element.shadowRoot));
  }
  return result;
}

export function captureFrameContext(
  element: HTMLElement,
  x: number,
  y: number,
  root: Document = document,
): Annotation["frame"] {
  const chain: HTMLIFrameElement[] = [];
  for (
    let frame = parentFrame(element.ownerDocument, root);
    frame;
    frame = parentFrame(frame.ownerDocument, root)
  )
    chain.unshift(frame);
  if (!chain.length) return undefined;
  const path = chain.map((frame) => {
    const box = frameGeometry(frame);
    x = (x - box.x) / box.sx;
    y = (y - box.y) / box.sy;
    return {
      index: framesIn(frame.ownerDocument).indexOf(frame),
      id: frame.id || undefined,
      url: frameDocument(frame)?.URL ?? "",
    };
  });
  const win = element.ownerDocument.defaultView!;
  let fixed = false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (["fixed", "sticky"].includes(win.getComputedStyle(current).position)) {
      fixed = true;
      break;
    }
  }
  const dx = fixed ? 0 : win.scrollX,
    dy = fixed ? 0 : win.scrollY;
  const rect = element.getBoundingClientRect();
  return {
    path,
    x: x + dx,
    y: y + dy,
    fixed,
    boundingBox: { x: rect.left + dx, y: rect.top + dy, width: rect.width, height: rect.height },
  };
}

type FrameAnnotation = Pick<Annotation, "frame" | "x" | "y" | "isFixed" | "boundingBox">;
type FrameLookup = (doc: Document) => HTMLIFrameElement[];

/** Share document scans within one render, never across scroll/navigation updates. */
export function createFrameProjector(root: Document = document) {
  const framesByDocument = new Map<Document, HTMLIFrameElement[]>();
  const lookup: FrameLookup = (doc) => {
    let frames = framesByDocument.get(doc);
    if (!frames) {
      frames = framesIn(doc);
      framesByDocument.set(doc, frames);
    }
    return frames;
  };
  return <T extends FrameAnnotation>(annotation: T): T | null =>
    projectFrameAnnotation(annotation, root, lookup);
}

/** Reproject saved frame notes after child scroll, resize, or parent movement. */
export function projectFrameAnnotation<T extends FrameAnnotation>(
  annotation: T,
  root: Document = document,
  lookup: FrameLookup = framesIn,
): T | null {
  const context = annotation.frame;
  if (!context) return annotation;
  let doc = root;
  for (const entry of context.path) {
    const frames = lookup(doc);
    const frame = entry.id ? frames.find((frame) => frame.id === entry.id) : frames[entry.index];
    const child = frame && frameDocument(frame);
    if (!child || frameLocationKey(child.URL) !== frameLocationKey(entry.url)) return null;
    doc = child;
  }
  const win = doc.defaultView!;
  const dx = context.fixed ? 0 : win.scrollX,
    dy = context.fixed ? 0 : win.scrollY;
  let localX = context.x - dx,
    localY = context.y - dy;
  for (let current = doc, frame = parentFrame(doc, root); frame; frame = parentFrame(current, root)) {
    const view = current.defaultView!;
    if (localX < 0 || localY < 0 || localX > view.innerWidth || localY > view.innerHeight)
      return null;
    const box = frameGeometry(frame);
    if (box.width <= 0 || box.height <= 0) return null;
    localX = box.x + localX * box.sx;
    localY = box.y + localY * box.sy;
    current = frame.ownerDocument;
  }
  const box = context.boundingBox;
  const rect = rectInViewport(doc, new DOMRect(box.x - dx, box.y - dy, box.width, box.height), root);
  const rootWindow = root.defaultView!;
  return {
    ...annotation,
    x: (localX / rootWindow.innerWidth) * 100,
    y: localY + (annotation.isFixed ? 0 : rootWindow.scrollY),
    boundingBox: {
      x: rect.x,
      y: rect.y + (annotation.isFixed ? 0 : rootWindow.scrollY),
      width: rect.width,
      height: rect.height,
    },
  };
}

/** Normalize a native event without dispatching a second event into the host. */
function pageEvent<T extends Event>(event: T, doc: Document, root: Document): T {
  if (!("clientX" in event) || doc === root) return event;
  const point = viewportPoint(
    doc,
    (event as unknown as MouseEvent).clientX,
    (event as unknown as MouseEvent).clientY,
    root,
  );
  return new Proxy(event, {
    get(target, key) {
      if (key === "clientX") return point.x;
      if (key === "clientY") return point.y;
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

type Subscription = {
  type: string;
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
  handlers: Map<Document, EventListener>;
};

/** One document registry per toolbar, shared by every picking/keyboard listener. */
export function createPageEvents(root: Document, onGeometryChange?: () => void) {
  const documents = new Set<Document>([root]);
  const subscriptions = new Set<Subscription>();
  let observers: MutationObserver[] = [];
  let frames = new Set<Element>();
  let queued = false,
    running = false;
  let resizeObserver: ResizeObserver | undefined;
  const connect = (subscription: Subscription, doc: Document) => {
    const handler: EventListener = (event) => subscription.listener(pageEvent(event, doc, root));
    subscription.handlers.set(doc, handler);
    doc.addEventListener(subscription.type, handler, subscription.options);
  };
  const reconcile = () => {
    queued = false;
    if (!running) return;
    const next = new Set<Document>();
    const nextFrames = new Set<Element>();
    const roots: (Document | ShadowRoot)[] = [];
    const visit = (tree: Document | ShadowRoot) => {
      roots.push(tree);
      for (const element of tree.querySelectorAll("*")) {
        if (element.matches("agentation-toolbar, [data-agentation-portal]")) continue;
        if (element.shadowRoot) visit(element.shadowRoot);
        if (element.tagName === "IFRAME") {
          nextFrames.add(element);
          const child = frameDocument(element);
          if (child && !next.has(child)) {
            next.add(child);
            visit(child);
          }
        }
      }
    };
    next.add(root);
    visit(root);
    for (const doc of documents)
      if (!next.has(doc)) {
        for (const subscription of subscriptions) {
          const handler = subscription.handlers.get(doc);
          if (handler) doc.removeEventListener(subscription.type, handler, subscription.options);
          subscription.handlers.delete(doc);
        }
        documents.delete(doc);
      }
    for (const doc of next)
      if (!documents.has(doc)) {
        documents.add(doc);
        for (const subscription of subscriptions) connect(subscription, doc);
      }
    for (const frame of frames)
      if (!nextFrames.has(frame)) frame.removeEventListener("load", reconcile);
    for (const frame of nextFrames)
      if (!frames.has(frame)) frame.addEventListener("load", reconcile);
    frames = nextFrames;
    resizeObserver?.disconnect();
    frames.forEach((frame) => resizeObserver?.observe(frame));
    observers.forEach((observer) => observer.disconnect());
    observers = roots.map((tree) => {
      const observer = new MutationObserver((records) => {
        // Text, annotation rendering and ordinary attributes do not rescan the page.
        const structural = records.some((record) =>
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node.nodeType === 1 &&
              !(node as Element).closest("agentation-toolbar, [data-agentation-portal]") &&
              ((node as Element).tagName === "IFRAME" ||
                !!(node as Element).shadowRoot ||
                !!(node as Element).querySelector("iframe")),
          ),
        );
        if (structural && !queued) {
          queued = true;
          queueMicrotask(reconcile);
        }
      });
      observer.observe(tree, { childList: true, subtree: true });
      return observer;
    });
    onGeometryChange?.();
  };
  return {
    start() {
      if (running) return;
      running = true;
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => onGeometryChange?.());
      }
      reconcile();
    },
    stop() {
      running = false;
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      observers.forEach((observer) => observer.disconnect());
      observers = [];
      for (const frame of frames) frame.removeEventListener("load", reconcile);
      frames.clear();
      for (const subscription of subscriptions)
        for (const [doc, handler] of subscription.handlers) {
          doc.removeEventListener(subscription.type, handler, subscription.options);
        }
      subscriptions.clear();
      documents.clear();
      documents.add(root);
    },
    addEventListener<K extends keyof DocumentEventMap>(
      type: K,
      listener: (event: DocumentEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ) {
      const subscription: Subscription = {
        type,
        listener: listener as EventListener,
        options,
        handlers: new Map(),
      };
      subscriptions.add(subscription);
      for (const doc of documents) connect(subscription, doc);
    },
    removeEventListener<K extends keyof DocumentEventMap>(
      type: K,
      listener: (event: DocumentEventMap[K]) => void,
      _options?: boolean | EventListenerOptions,
    ) {
      for (const subscription of subscriptions)
        if (subscription.type === type && subscription.listener === listener) {
          for (const [doc, handler] of subscription.handlers)
            doc.removeEventListener(type, handler, subscription.options);
          subscriptions.delete(subscription);
        }
    },
    querySelectorAll(selector: string): Element[] {
      return [...documents].flatMap((doc) => [...doc.querySelectorAll(selector)]);
    },
  };
}
