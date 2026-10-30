import { defineComponent, type InputHTMLAttributes } from "vue";
import styles from "@core/components/switch/styles.module.scss";

// Extra attributes and listeners (onChange, disabled, id) go to the <input>, like the React version.
export const Switch = defineComponent(
  (props: { class?: string; checked?: boolean } & Omit<InputHTMLAttributes, "class" | "checked">, { attrs }) => () => (
    <div
      class={`${styles.switchContainer} ${props.class ?? ""}`}
      data-checked={props.checked ? "" : undefined}
    >
      <input class={styles.switchInput} checked={props.checked} type="checkbox" {...attrs} />
      <div class={styles.switchThumb} />
    </div>
  ),
  { name: "AgentationSwitch", props: ["class", "checked"], inheritAttrs: false },
);
