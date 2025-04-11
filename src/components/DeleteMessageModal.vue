<template>
  <div class="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md" style="padding: 24px">
      <!-- Header -->
      <div
        class="bg-yellow-100 text-yellow-700 rounded-lg text-center"
        style="padding: 16px; margin-bottom: 20px"
      >
        <h2 class="text-2xl font-bold">Delete Message</h2>
      </div>

      <!-- Confirmation Content -->
      <div class="text-center" style="margin-bottom: 20px">
        <h3 class="text-lg font-semibold text-gray-800" style="margin-bottom: 8px">
          Are you sure you want to delete this message?
        </h3>
        <p class="text-sm text-gray-600">This action cannot be undone.</p>
      </div>

      <!-- Buttons -->
      <div class="flex justify-end gap-4 mt-6">
        <button
          class="text-gray-600 hover:text-gray-800 font-medium rounded-lg transition duration-200"
          style="padding: 8px 16px"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition duration-200"
          style="padding: 8px 16px"
          @click="$emit('confirm')"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Emits: 'confirm' and 'cancel'
</script>

<style scoped>
/* All styles managed via Tailwind + inline padding/margin */
</style>
