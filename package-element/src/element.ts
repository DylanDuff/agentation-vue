import type { Annotation } from "@agentation/core/types";
import { createStableCallbacks, mountAgentation, type AgentationInstance, type AgentationOptions } from "./mount";

export const AGENTATION_ELEMENT_TAG = "agentation-feedback";

/** String and boolean options settable as attributes, for plain HTML use */
const ATTRIBUTES = {
  endpoint: "string",
  "session-id": "string",
  "webhook-url": "string",
  "app-name": "string",
  "copy-format": "string",
  "class-name": "string",
  "use-hash-location": "boolean",
  "copy-to-clipboard": "boolean",
  "enable-keyboard-shortcuts": "boolean",
  "dev-mode": "boolean",
} as const;

type AttributeName = keyof typeof ATTRIBUTES;

const OPTION_FOR_ATTRIBUTE: Record<AttributeName, keyof AgentationOptions> = {
  endpoint: "endpoint",
  "session-id": "sessionId",
  "webhook-url": "webhookUrl",
  "app-name": "appName",
  "copy-format": "copyFormat",
  "class-name": "className",
  "use-hash-location": "useHashLocation",
  "copy-to-clipboard": "copyToClipboard",
  "enable-keyboard-shortcuts": "enableKeyboardShortcuts",
  "dev-mode": "isDevMode",
};

/** DOM events fired alongside the callbacks, named after them */
export interface AgentationEventMap {
  "agentation:annotation-add": CustomEvent<Annotation>;
  "agentation:annotation-delete": CustomEvent<Annotation>;
  "agentation:annotation-update": CustomEvent<Annotation>;
  "agentation:annotations-clear": CustomEvent<Annotation[]>;
  "agentation:copy": CustomEvent<string>;
  "agentation:submit": CustomEvent<{ output: string; annotations: Annotation[] }>;
  "agentation:session-created": CustomEvent<string>;
  "agentation:open-source": CustomEvent<string>;
}

function readAttribute(element: Element, name: AttributeName): string | boolean | undefined {
  const value = element.getAttribute(name);
  if (value === null) return undefined;
  if (ATTRIBUTES[name] === "boolean") return value !== "false";
  return value;
}

// Some environments (SSR, old test runners) have no HTMLElement to extend
const BaseElement = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * `<agentation-feedback>`: the Agentation toolbar for any page. Simple options
 * are attributes (`endpoint`, `app-name`, `use-hash-location`, ...); set the
 * `options` property for callbacks, `demoAnnotations`, `detectors` and the
 * rest. Every callback is also dispatched as an `agentation:*` DOM event.
 * `agentation:submit` needs an `onSubmit` option or the `send` attribute,
 * which shows the Send to Agent button.
 */
export class AgentationElement extends BaseElement {
  static observedAttributes = [...Object.keys(ATTRIBUTES), "send"];

  private instance: AgentationInstance | null = null;
  private propertyOptions: AgentationOptions = {};
  private readonly stabilize = createStableCallbacks();

  /** Options in addition to the attributes; properties win over attributes */
  get options(): AgentationOptions {
    return this.propertyOptions;
  }

  set options(value: AgentationOptions) {
    this.propertyOptions = value ?? {};
    this.refresh();
  }

  connectedCallback() {
    this.style.display = "contents";
    this.instance ??= mountAgentation(this, this.resolveOptions());
  }

  disconnectedCallback() {
    this.instance?.destroy();
    this.instance = null;
  }

  attributeChangedCallback() {
    this.refresh();
  }

  private refresh() {
    this.instance?.update(this.resolveOptions());
  }

  private emit<K extends keyof AgentationEventMap>(type: K, detail: AgentationEventMap[K]["detail"]) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private resolveOptions(): AgentationOptions {
    const fromAttributes: Record<string, unknown> = {};
    for (const name of Object.keys(ATTRIBUTES) as AttributeName[]) {
      const value = readAttribute(this, name);
      if (value !== undefined) fromAttributes[OPTION_FOR_ATTRIBUTE[name]] = value;
    }
    const options = { ...fromAttributes, ...this.propertyOptions } as AgentationOptions;
    const sendAttribute = this.hasAttribute("send");
    // Every callback is also announced as a DOM event
    return this.stabilize({
      ...options,
      onAnnotationAdd: (annotation) => {
        options.onAnnotationAdd?.(annotation);
        this.emit("agentation:annotation-add", annotation);
      },
      onAnnotationDelete: (annotation) => {
        options.onAnnotationDelete?.(annotation);
        this.emit("agentation:annotation-delete", annotation);
      },
      onAnnotationUpdate: (annotation) => {
        options.onAnnotationUpdate?.(annotation);
        this.emit("agentation:annotation-update", annotation);
      },
      onAnnotationsClear: (annotations) => {
        options.onAnnotationsClear?.(annotations);
        this.emit("agentation:annotations-clear", annotations);
      },
      onCopy: (output) => {
        options.onCopy?.(output);
        this.emit("agentation:copy", output);
      },
      onSessionCreated: (sessionId) => {
        options.onSessionCreated?.(sessionId);
        this.emit("agentation:session-created", sessionId);
      },
      onSubmit: options.onSubmit || sendAttribute
        ? (output, annotations) => {
          options.onSubmit?.(output, annotations);
          this.emit("agentation:submit", { output, annotations });
        }
        : undefined,
      onOpenSource: options.onOpenSource
        ? (sourceFile) => {
          options.onOpenSource?.(sourceFile);
          this.emit("agentation:open-source", sourceFile);
        }
        : undefined,
    });
  }
}

/** Registers `<agentation-feedback>` (or `tag`) once; safe to call repeatedly */
export function defineAgentationElement(tag = AGENTATION_ELEMENT_TAG) {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;
  customElements.define(tag, class extends AgentationElement {});
}

declare global {
  interface HTMLElementTagNameMap {
    "agentation-feedback": AgentationElement;
  }
}
