<!--
  Agentation toolbar for Svelte 4 and 5. Takes the same props as the React and
  Vue components (endpoint, appName, onAnnotationAdd, onCopy, ...).
-->
<script>
  import { onDestroy, onMount } from "svelte";
  import { createAgentation } from "./runtime.js";

  let anchor;
  let instance;

  onMount(() => {
    instance = createAgentation(anchor, $$props);
  });

  $: if (instance) instance.update($$props);

  onDestroy(() => {
    instance?.destroy();
    instance = undefined;
  });
</script>

<span bind:this={anchor} style="display: contents" data-agentation-svelte></span>
