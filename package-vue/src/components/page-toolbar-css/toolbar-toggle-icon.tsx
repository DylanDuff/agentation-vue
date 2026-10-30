import styles from "@core/components/page-toolbar-css/styles.module.scss";

// The same strokes form the launcher and close icon, so interrupted motion can
// reverse from its current shape without swapping SVGs or fading the glyph out.
export function ToolbarToggleIcon({ active }: { active: boolean }) {
  return (
    <svg
      class={styles.toggleGlyph}
      data-active={active}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path class={styles.toggleTopLine} d="M5.5 6.75H18.5" />
      <path class={styles.toggleMiddleLine} d="M5.5 12H11.5" />
      <path class={styles.toggleBottomLine} d="M5.5 17.25H9.25" />
      <path
        class={styles.toggleSparkle}
        d="M16 12.75L16.5179 13.9677C16.8078 14.6494 17.3506 15.1922 18.0323 15.4821L19.25 16L18.0323 16.5179C17.3506 16.8078 16.8078 17.3506 16.5179 18.0323L16 19.25L15.4821 18.0323C15.1922 17.3506 14.6494 16.8078 13.9677 16.5179L12.75 16L13.9677 15.4821C14.6494 15.1922 15.1922 14.6494 15.4821 13.9677L16 12.75Z"
      />
    </svg>
  );
}
