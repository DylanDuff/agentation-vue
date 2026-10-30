import { defineComponent, ref, watch, type CSSProperties, type PropType } from "vue";
import { usePanelPresence } from "../../../composables/use-panel-presence";
import { COLOR_OPTIONS, type ToolbarSettings } from "../constants";
import { OUTPUT_DETAIL_OPTIONS } from "@agentation/core/output/generate-output";
import { HelpTooltip } from "../../help-tooltip";
import { IconChevronLeft, IconMoon, IconSun } from "../../icons";
import { Switch } from "../../switch";
import { CheckboxField } from "./checkbox-field";
import styles from "@agentation/core/styles/page-toolbar-css/settings-panel/styles.module.scss";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type SettingsPanelProps = {
  settings: ToolbarSettings;
  onSettingsChange: (patch: Partial<ToolbarSettings>) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  isDevMode: boolean;
  connectionStatus: ConnectionStatus;
  endpoint?: string;
  onExited: () => void;
  isOpen: boolean;
  /** Position override: show panel above toolbar when toolbar is near bottom */
  toolbarNearBottom: boolean;
  settingsPage: "main" | "automations";
  onSettingsPageChange: (page: "main" | "automations") => void;
  onHideToolbar: () => void;
};

const checked = (event: Event) => (event.target as HTMLInputElement).checked;

export const SettingsPanel = defineComponent({
  name: "SettingsPanel",
  props: {
    settings: { type: Object as PropType<ToolbarSettings>, required: true },
    onSettingsChange: { type: Function as PropType<(patch: Partial<ToolbarSettings>) => void>, required: true },
    isDarkMode: Boolean,
    onToggleTheme: { type: Function as PropType<() => void>, required: true },
    isDevMode: Boolean,
    connectionStatus: { type: String as PropType<ConnectionStatus>, required: true },
    endpoint: String,
    onExited: { type: Function as PropType<() => void>, required: true },
    isOpen: Boolean,
    toolbarNearBottom: Boolean,
    settingsPage: { type: String as PropType<"main" | "automations">, required: true },
    onSettingsPageChange: { type: Function as PropType<(page: "main" | "automations") => void>, required: true },
    onHideToolbar: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const { el: panelRef } = usePanelPresence(() => props.isOpen, { keepMounted: true, onExited: () => props.onExited() });
    const navRef = ref<HTMLButtonElement | null>(null);
    const backRef = ref<HTMLButtonElement | null>(null);
    let focusPage = false;
    watch(
      [() => props.isOpen, () => props.settingsPage],
      () => {
        if (!props.isOpen || !focusPage) return;
        focusPage = false;
        (props.settingsPage === "automations" ? backRef : navRef).value?.focus();
      },
      { flush: "post" },
    );

    return () => {
      const { settings, onSettingsChange, isDarkMode, isDevMode, connectionStatus, endpoint, isOpen, settingsPage } = props;
      const themeToggleLabel = isDarkMode ? "Switch to light mode" : "Switch to dark mode";

      return (
        <div
          class={`${styles.settingsPanel} ${props.toolbarNearBottom ? styles.below : ""}`}
          style={props.toolbarNearBottom ? { bottom: "auto", top: "calc(100% + 0.5rem)" } : undefined}
          data-agentation-settings-panel
          ref={(node) => {
            panelRef.value = node as HTMLDivElement | null;
            (node as HTMLElement | null)?.toggleAttribute("inert", !isOpen);
          }}
          role="group"
          aria-label="Feedback settings"
          aria-hidden={!isOpen}
        >
          <div class={styles.settingsPanelContainer}>
            {/* ── Main page ── */}
            <div
              class={`${styles.settingsPage} ${settingsPage === "automations" ? styles.slideLeft : ""}`}
              ref={(node) => { (node as HTMLElement | null)?.toggleAttribute("inert", settingsPage !== "main"); }}
              aria-hidden={settingsPage !== "main"}
            >
              <div class={styles.settingsHeader}>
                <a class={styles.settingsBrand} href="https://agentation.com" target="_blank" rel="noopener noreferrer" aria-label="Agentation">
                  Agentation
                </a>
                <p class={styles.settingsVersion}>v{__VERSION__}</p>
                <button
                  class={styles.themeToggle}
                  onClick={() => props.onToggleTheme()}
                  title={themeToggleLabel}
                  aria-label={themeToggleLabel}
                >
                  <span class={styles.themeIconWrapper}>
                    <span key={isDarkMode ? "sun" : "moon"} class={styles.themeIcon}>
                      {isDarkMode ? <IconSun size={20} /> : <IconMoon size={20} />}
                    </span>
                  </span>
                </button>
              </div>

              <div class={styles.divider}></div>

              {/* Output detail + component detection toggle */}
              <div class={styles.settingsSection}>
                <div class={styles.settingsRow}>
                  <div class={styles.settingsLabel}>
                    Output Detail
                    <HelpTooltip content="Controls how much detail is included in the copied output" />
                  </div>
                  <button
                    class={styles.cycleButton}
                    onClick={() => {
                      const currentIndex = OUTPUT_DETAIL_OPTIONS.findIndex((opt) => opt.value === settings.outputDetail);
                      const nextIndex = (currentIndex + 1) % OUTPUT_DETAIL_OPTIONS.length;
                      onSettingsChange({ outputDetail: OUTPUT_DETAIL_OPTIONS[nextIndex].value });
                    }}
                  >
                    <span key={settings.outputDetail} class={styles.cycleButtonText}>
                      {OUTPUT_DETAIL_OPTIONS.find((opt) => opt.value === settings.outputDetail)?.label}
                    </span>
                    <span class={styles.cycleDots}>
                      {OUTPUT_DETAIL_OPTIONS.map((option) => (
                        <span
                          key={option.value}
                          class={`${styles.cycleDot} ${settings.outputDetail === option.value ? styles.active : ""}`}
                        />
                      ))}
                    </span>
                  </button>
                </div>

                <div class={`${styles.settingsRow} ${styles.settingsRowMarginTop} ${!isDevMode ? styles.settingsRowDisabled : ""}`}>
                  <div class={styles.settingsLabel}>
                    Vue Components
                    <HelpTooltip
                      content={
                        !isDevMode
                          ? "Disabled — production builds drop component names and source files, making detection unreliable. Use in development mode."
                          : "Include Vue component names in annotations"
                      }
                    />
                  </div>
                  <Switch
                    aria-label="Vue Components"
                    checked={isDevMode && settings.reactEnabled}
                    onChange={(e: Event) => onSettingsChange({ reactEnabled: checked(e) })}
                    disabled={!isDevMode}
                  />
                </div>

                <div class={`${styles.settingsRow} ${styles.settingsRowMarginTop}`}>
                  <div class={styles.settingsLabel}>
                    Hide Until Restart
                    <HelpTooltip content="Hides the toolbar until you open a new tab" />
                  </div>
                  <Switch
                    aria-label="Hide Until Restart"
                    checked={false}
                    onChange={(e: Event) => {
                      if (checked(e)) props.onHideToolbar();
                    }}
                  />
                </div>
              </div>

              <div class={styles.divider}></div>

              {/* Color picker */}
              <div class={styles.settingsSection}>
                <div class={`${styles.settingsLabel} ${styles.settingsLabelMarker}`}>Marker Color</div>
                <div class={styles.colorOptions}>
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      class={`${styles.colorOption} ${settings.annotationColorId === color.id ? styles.selected : ""}`}
                      style={{ "--swatch": color.srgb, "--swatch-p3": color.p3 } as CSSProperties}
                      onClick={() => onSettingsChange({ annotationColorId: color.id })}
                      title={color.label}
                      aria-label={color.label}
                      type="button"
                      key={color.id}
                    ></button>
                  ))}
                </div>
              </div>

              <div class={styles.divider}></div>

              {/* Checkboxes */}
              <div class={styles.settingsSection}>
                <CheckboxField
                  class="checkbox-field"
                  label="Clear on copy/send"
                  checked={settings.autoClearAfterCopy}
                  onChange={(e: Event) => onSettingsChange({ autoClearAfterCopy: checked(e) })}
                  tooltip="Automatically clear annotations after copying"
                />
                <CheckboxField
                  class={styles.checkboxField}
                  label="Block page interactions"
                  checked={settings.blockInteractions}
                  onChange={(e: Event) => onSettingsChange({ blockInteractions: checked(e) })}
                />
              </div>

              <div class={styles.divider} />

              {/* Nav to automations */}
              <button
                class={styles.settingsNavLink}
                ref={navRef}
                onClick={(event: MouseEvent) => {
                  focusPage = event.detail === 0;
                  (event.currentTarget as HTMLElement).blur();
                  props.onSettingsPageChange("automations");
                }}
              >
                <span>Manage MCP & Webhooks</span>
                <span class={styles.settingsNavLinkRight}>
                  {endpoint && connectionStatus !== "disconnected" && (
                    <span class={`${styles.mcpNavIndicator} ${styles[connectionStatus]}`} />
                  )}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M7.5 12.5L12 8L7.5 3.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              </button>
            </div>

            {/* ── Automations page ── */}
            <div
              class={`${styles.settingsPage} ${styles.automationsPage} ${settingsPage === "automations" ? styles.slideIn : ""}`}
              ref={(node) => { (node as HTMLElement | null)?.toggleAttribute("inert", settingsPage !== "automations"); }}
              aria-hidden={settingsPage !== "automations"}
            >
              <button
                class={styles.settingsBackButton}
                ref={backRef}
                aria-label="Back to settings"
                onClick={(event: MouseEvent) => {
                  focusPage = event.detail === 0;
                  (event.currentTarget as HTMLElement).blur();
                  props.onSettingsPageChange("main");
                }}
              >
                <IconChevronLeft size={16} />
                <span>Manage MCP & Webhooks</span>
              </button>

              <div class={styles.divider}></div>

              {/* MCP section */}
              <div class={styles.settingsSection}>
                <div class={styles.settingsRow}>
                  <span class={styles.automationHeader}>
                    MCP Connection
                    <HelpTooltip content="Connect via Model Context Protocol to let AI agents like Claude Code receive annotations in real-time." />
                  </span>
                  {endpoint && (
                    <div
                      class={`${styles.mcpStatusDot} ${styles[connectionStatus]}`}
                      title={
                        connectionStatus === "connected"
                          ? "Connected"
                          : connectionStatus === "connecting"
                            ? "Connecting..."
                            : "Disconnected"
                      }
                    />
                  )}
                </div>
                <p class={styles.automationDescription} style={{ paddingBottom: "6px" }}>
                  MCP connection allows agents to receive and act on annotations.{" "}
                  <a href="https://agentation.com/mcp" target="_blank" rel="noopener noreferrer" class={styles.learnMoreLink}>
                    Learn more
                  </a>
                </p>
              </div>

              <div class={styles.divider}></div>

              {/* Webhooks section */}
              <div class={`${styles.settingsSection} ${styles.settingsSectionGrow}`}>
                <div class={styles.settingsRow}>
                  <span class={styles.automationHeader}>
                    Webhooks
                    <HelpTooltip content="Send annotation data to any URL endpoint when annotations change. Useful for custom integrations." />
                  </span>
                  <div class={styles.autoSendContainer}>
                    <label
                      for="agentation-auto-send"
                      class={`${styles.autoSendLabel} ${settings.webhooksEnabled ? styles.active : ""} ${!settings.webhookUrl ? styles.disabled : ""}`}
                    >
                      Auto-Send
                    </label>
                    <Switch
                      id="agentation-auto-send"
                      checked={settings.webhooksEnabled}
                      onChange={(e: Event) => onSettingsChange({ webhooksEnabled: checked(e) })}
                      disabled={!settings.webhookUrl}
                    />
                  </div>
                </div>
                <p class={styles.automationDescription}>
                  The webhook URL will receive live annotation changes and annotation data.
                </p>
                <textarea
                  class={styles.webhookUrlInput}
                  placeholder="Webhook URL"
                  aria-label="Webhook URL"
                  value={settings.webhookUrl}
                  onKeydown={(e: KeyboardEvent) => e.stopPropagation()}
                  onInput={(e: Event) => onSettingsChange({ webhookUrl: (e.target as HTMLTextAreaElement).value })}
                />
              </div>
            </div>
          </div>
        </div>
      );
    };
  },
});
