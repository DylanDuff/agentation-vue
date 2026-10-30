import { defineComponent } from "vue";
import styles from "@core/components/checkbox/styles.module.scss";

// Extra attributes and listeners (onChange, disabled, id) go to the <input>, like the React version.
export const Checkbox = defineComponent(
  (props: { class?: string; checked?: boolean }, { attrs }) => () => (
    <div
      class={`${styles.checkboxContainer} ${props.class ?? ""}`}
      data-checked={props.checked ? "" : undefined}
    >
      <input class={styles.checkboxInput} type="checkbox" checked={props.checked} {...attrs} />
      <svg class={styles.checkboxCheck} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          class={styles.checkboxCheckPath}
          d="M3.94 7L6.13 9.19L10.5 4.81"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  ),
  { name: "AgentationCheckbox", props: ["class", "checked"], inheritAttrs: false },
);
