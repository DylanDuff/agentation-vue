<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";

const props = withDefaults(
  defineProps<{
    mode?: ShadowRootMode;
    delegatesFocus?: boolean;
    slotAssignment?: SlotAssignmentMode;
    host?: keyof HTMLElementTagNameMap | (string & {});
  }>(),
  { mode: "open", host: "div" },
);

const hostRef = ref<HTMLElement | null>(null);
const shadowContainer = shallowRef<ShadowRoot | null>(null);

onMounted(() => {
  const hostElement = hostRef.value;
  if (!hostElement || hostElement.shadowRoot) return;
  shadowContainer.value = hostElement.attachShadow({
    mode: props.mode,
    delegatesFocus: props.delegatesFocus,
    slotAssignment: props.slotAssignment,
  });
});
</script>

<template>
  <component :is="host" ref="hostRef">
    <Teleport v-if="shadowContainer" :to="shadowContainer as unknown as HTMLElement">
      <slot />
    </Teleport>
  </component>
</template>
