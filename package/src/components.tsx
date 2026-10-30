"use client";

import { PageFeedbackToolbarCSS as CoreToolbar } from "@agentation/core/ui";
import type { PageFeedbackToolbarCSSProps } from "@agentation/core/ui";
import { reactDetector } from "./detectors/react";

const REACT_DETECTORS = [reactDetector];

/** The shared toolbar, rendered by the host app's React with the React component detector */
export function PageFeedbackToolbarCSS(props: PageFeedbackToolbarCSSProps = {}) {
  return <CoreToolbar detectors={REACT_DETECTORS} {...props} />;
}
