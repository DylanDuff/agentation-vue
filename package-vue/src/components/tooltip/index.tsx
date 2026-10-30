import { defineComponent, onBeforeUnmount, ref, Teleport } from "vue";
import { originalSetTimeout } from "@core/utils/freeze-animations";

export const Tooltip = defineComponent(
  (props: { content: string }, { slots, attrs }) => {
    const visible = ref(false);
    const shouldRender = ref(false);
    const position = ref({ top: 0, right: 0 });
    const triggerRef = ref<HTMLSpanElement | null>(null);
    let timeout: ReturnType<typeof originalSetTimeout> | null = null;
    let exitTimeout: ReturnType<typeof originalSetTimeout> | null = null;

    const updatePosition = () => {
      if (triggerRef.value) {
        const rect = triggerRef.value.getBoundingClientRect();
        position.value = {
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + 8,
        };
      }
    };

    const handleMouseEnter = () => {
      shouldRender.value = true;
      if (exitTimeout) {
        clearTimeout(exitTimeout);
        exitTimeout = null;
      }
      updatePosition();
      timeout = originalSetTimeout(() => {
        visible.value = true;
      }, 500);
    };

    const handleMouseLeave = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      visible.value = false;
      // Keep rendered during exit animation
      exitTimeout = originalSetTimeout(() => {
        shouldRender.value = false;
      }, 150);
    };

    onBeforeUnmount(() => {
      if (timeout) clearTimeout(timeout);
      if (exitTimeout) clearTimeout(exitTimeout);
    });

    return () => (
      <>
        <span ref={triggerRef} onMouseenter={handleMouseEnter} onMouseleave={handleMouseLeave} {...attrs}>
          {slots.default?.()}
        </span>
        {shouldRender.value && (
          <Teleport to="body">
            <div
              data-feedback-toolbar
              style={{
                position: "fixed",
                top: `${position.value.top}px`,
                right: `${position.value.right}px`,
                transform: "translateY(-50%)",
                padding: "6px 10px",
                background: "#383838",
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "14px",
                borderRadius: "10px",
                width: "180px",
                textAlign: "left",
                zIndex: 100020,
                pointerEvents: "none",
                boxShadow: "0px 1px 8px rgba(0, 0, 0, 0.28)",
                opacity: visible.value ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            >
              {props.content}
            </div>
          </Teleport>
        )}
      </>
    );
  },
  { name: "AgentationTooltip", props: ["content"], inheritAttrs: false },
);
