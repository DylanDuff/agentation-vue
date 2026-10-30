<script>
  import Agentation from "../src/Agentation.svelte";
  import ProductCard from "./ProductCard.svelte";

  let log = [];
  const onAdd = (annotation) => (log = [...log, `add: ${annotation.comment}`]);
  const onCopy = (output) => (log = [...log, `copy: ${output.length} chars`]);
</script>

<main class="page">
  <h1>Agentation Svelte playground</h1>
  <p class="lede">Open the toolbar in the bottom right, then click anything on this page to leave a note.</p>
  <section class="cards">
    <ProductCard title="Starter" price="$9" />
    <ProductCard title="Team" price="$29" />
  </section>
  <ul data-testid="log">
    {#each log as entry}
      <li>{entry}</li>
    {/each}
  </ul>
  <Agentation onAnnotationAdd={onAdd} {onCopy} copyToClipboard={false} />
</main>

<style>
  :global(body) { font-family: system-ui, sans-serif; margin: 0; }
  .page { max-width: 720px; margin: 0 auto; padding: 40px 20px 200px; }
  .cards { display: flex; gap: 16px; }
</style>
