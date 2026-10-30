import { defineComponent } from "vue";
import { Tooltip } from "../tooltip";
import { IconHelp } from "../icons";
import styles from "@core/components/help-tooltip/styles.module.scss";

export const HelpTooltip = defineComponent(
  (props: { content: string }) => () => (
    <Tooltip class={styles.tooltip} content={props.content}>
      <IconHelp class={styles.tooltipIcon} />
    </Tooltip>
  ),
  { name: "AgentationHelpTooltip", props: ["content"] },
);
