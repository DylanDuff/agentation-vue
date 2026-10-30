/** @jsxImportSource react */
import { useLayoutEffect, useRef } from "react";
import styles from "../../../styles/page-toolbar-css/styles.module.scss";

type HoverTooltipProps = {
  x: number;
  y: number;
  elementName: string;
  reactComponents?: string | null;
};

export function HoverTooltip({ x, y, elementName, reactComponents }: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tooltip = ref.current;
    if (!tooltip) return;
    const position = () => {
      // Layout dimensions exclude the entrance transform, so the settled label
      // fits too. Do not guess its width from the pointer or component count.
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      tooltip.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
      const preferredTop = y - height - 8;
      tooltip.style.top = `${Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8))}px`;
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [x, y, elementName, reactComponents]);

  return (
    <div ref={ref} className={`${styles.hoverTooltip} ${styles.enter}`}>
      {reactComponents && <div className={styles.hoverReactPath}>{reactComponents}</div>}
      <div className={styles.hoverElementName}>{elementName}</div>
    </div>
  );
}
