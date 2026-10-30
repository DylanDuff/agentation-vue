import { defineComponent, useId, type PropType } from "vue";
import { Checkbox } from "../../../checkbox";
import { HelpTooltip } from "../../../help-tooltip";
import styles from "@core/components/page-toolbar-css/settings-panel/checkbox-field/styles.module.scss";

export const CheckboxField = defineComponent({
  name: "CheckboxField",
  props: {
    class: { type: String, default: "" },
    label: { type: String, required: true },
    tooltip: String,
    checked: Boolean,
    onChange: Function as PropType<(event: Event) => void>,
  },
  setup(props, { attrs }) {
    const id = useId();
    return () => (
      <div class={`${styles.container} ${props.class}`} {...attrs}>
        <Checkbox id={id} onChange={props.onChange} checked={props.checked} />
        <label class={styles.label} for={id}>
          {props.label}
        </label>
        {props.tooltip && <HelpTooltip content={props.tooltip} />}
      </div>
    );
  },
  inheritAttrs: false,
});
