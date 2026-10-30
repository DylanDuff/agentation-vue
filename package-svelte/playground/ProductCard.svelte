<script>
  export let title;
  export let price;
</script>

<div class="card">
  <h2>{title}</h2>
  <p class="price">{price} / month</p>
  <button>Choose {title}</button>
</div>

<style>
  .card { flex: 1; border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
</style>
