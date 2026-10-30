import { Tooltip } from "../tooltip";
import { IconHelp } from "../icons";
import styles from "@agentation/core/styles/help-tooltip/styles.module.scss";

interface HelpTooltipProps {
  content: string;
}

export const HelpTooltip = ({ content }: HelpTooltipProps) => {
  return (
    <Tooltip className={styles.tooltip} content={content}>
      <IconHelp className={styles.tooltipIcon} />
    </Tooltip>
  );
};
