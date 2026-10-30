<script setup lang="ts">
import { ref } from "vue";
import { Agentation, type Annotation } from "../src";
import ProductCard from "./ProductCard.vue";

const log = ref<string[]>([]);
const onAdd = (annotation: Annotation) => log.value.push(`add: ${annotation.comment}`);
const onCopy = (output: string) => log.value.push(`copy: ${output.length} chars`);
</script>

<template>
  <main class="page">
    <h1>Agentation Vue playground</h1>
    <p class="lede">Open the toolbar in the bottom right, then click anything on this page to leave a note.</p>
    <section class="cards">
      <ProductCard title="Starter" price="$9" />
      <ProductCard title="Team" price="$29" />
    </section>
    <ul data-testid="log">
      <li v-for="(entry, i) in log" :key="i">{{ entry }}</li>
    </ul>
    <Agentation :on-annotation-add="onAdd" :on-copy="onCopy" :copy-to-clipboard="false" />
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 0; }
.page { max-width: 720px; margin: 0 auto; padding: 40px 20px 200px; }
.cards { display: flex; gap: 16px; }
</style>
