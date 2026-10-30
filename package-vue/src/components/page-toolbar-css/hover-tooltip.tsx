import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import styles from "@agentation/core/styles/page-toolbar-css/styles.module.scss";

type HoverTooltipProps = {
  x: number;
  y: number;
  elementName: string;
  reactComponents?: string | null;
};

export const HoverTooltip = defineComponent(
  (props: HoverTooltipProps) => {
    const el = ref<HTMLDivElement | null>(null);

    const position = () => {
      const tooltip = el.value;
      if (!tooltip) return;
      // Layout dimensions exclude the entrance transform, so the settled label
      // fits too. Do not guess its width from the pointer or component count.
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      tooltip.style.left = `${Math.max(8, Math.min(props.x, window.innerWidth - width - 8))}px`;
      const preferredTop = props.y - height - 8;
      tooltip.style.top = `${Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8))}px`;
    };

    onMounted(() => {
      position();
      window.addEventListener("resize", position);
    });
    onBeforeUnmount(() => window.removeEventListener("resize", position));
    watch(() => [props.x, props.y, props.elementName, props.reactComponents], position, { flush: "post" });

    return () => (
      <div ref={el} class={`${styles.hoverTooltip} ${styles.enter}`}>
        {props.reactComponents && <div class={styles.hoverReactPath}>{props.reactComponents}</div>}
        <div class={styles.hoverElementName}>{props.elementName}</div>
      </div>
    );
  },
  { name: "AgentationHoverTooltip", props: ["x", "y", "elementName", "reactComponents"] },
);
