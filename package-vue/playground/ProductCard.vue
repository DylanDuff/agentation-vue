<script setup lang="ts">
defineProps<{ title: string; price: string }>();
</script>

<template>
  <article class="card">
    <h2>{{ title }}</h2>
    <p class="price">{{ price }} / month</p>
    <button type="button">Choose {{ title }}</button>
  </article>
</template>

<style scoped>
.card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; flex: 1; }
.price { font-size: 24px; font-weight: 600; }
</style>
