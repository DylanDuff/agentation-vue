<script>
  import Agentation from "../../src/Agentation.svelte";
  import Card from "./Card.svelte";

  export let onAnnotationAdd;
  export let onSubmit;

  let canSend = false;
</script>

<main>
  <Card title="Starter" />
  <button id="enable-send" on:click={() => (canSend = true)}>Enable send</button>
</main>
<Agentation {onAnnotationAdd} onSubmit={canSend ? onSubmit : undefined} appName="Shop" copyToClipboard={false} />
