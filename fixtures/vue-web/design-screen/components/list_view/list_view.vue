<script setup lang="ts">
defineProps<{
  title?: string;
  total?: number;
  pager?: 'full' | 'mini' | 'none';
}>();
</script>

<template>
  <section class="list-view flex flex-col gap-[var(--grid-md)]">
    <h2 v-if="title" class="font-heading text-foreground">
      {{ title }}<span v-if="total != null" class="text-secondary"> ({{ total }})</span>
    </h2>
    <div v-if="$slots.rows" class="grid gap-[var(--grid-md)] sm:grid-cols-2 lg:grid-cols-3">
      <slot name="rows" />
    </div>
    <p v-if="$slots.empty" class="font-body text-secondary"><slot name="empty" /></p>
  </section>
</template>
