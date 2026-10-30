import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Reactive window.scrollY. React overlays re-render whenever the toolbar does
 * (its scroll state included) and read window.scrollY during render; Vue only
 * re-renders on reactive changes, so overlays that position fixed elements
 * from document coordinates subscribe to scroll themselves.
 */
export function useWindowScroll() {
  const scrollY = ref(typeof window !== "undefined" ? window.scrollY : 0);
  const update = () => { scrollY.value = window.scrollY; };
  onMounted(() => {
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("scroll", update, true);
    window.removeEventListener("resize", update);
  });
  return scrollY;
}
