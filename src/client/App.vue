<template>
  <div>
    <h1>Container Dashboard</h1>
    <p>Last updated: {{ lastUpdated }}</p>
    <div class="controls">
        <button @click="toggleShowExcluded">{{ showExcluded ? 'Hide' : 'Show' }} excluded namespaces</button>
    </div>
    <table>
      <thead>
        <tr>
          <th @click="sortBy('repository')">Repository</th>
          <th @click="sortBy('tag')">Tag</th>
          <th @click="sortBy('namespaces')">Namespaces</th>
          <th @click="sortBy('container_names')">Container Names</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="image in sortedImages" :key="`${image.repository}:${image.tag}`">
          <td>{{ image.repository }}</td>
          <td :title="image.newer_image_available ? `Newer image available: ${image.latest_image}` : ''">
            {{ image.tag }}
            <span v-if="image.newer_image_available" class="update-icon">🚀</span>
          </td>
          <td>{{ image.namespaces.join(', ') }}</td>
          <td>{{ image.container_names.join(', ') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed } from 'vue';

interface ContainerImage {
  repository: string;
  tag: string;
  namespaces: string[];
  container_names: string[];
  newer_image_available: boolean;
  latest_image: string;
}

export default defineComponent({
  name: 'App',
  setup() {
    const images = ref<ContainerImage[]>([]);
    const lastUpdated = ref<string>('');
    const excludedNamespaces = ref<string[]>([]);
    const showExcluded = ref(false);
    const sortKey = ref<keyof ContainerImage>('repository');
    const sortOrder = ref<'asc' | 'desc'>('asc');

    const fetchImages = async () => {
      const res = await fetch('/api/images');
      const data = await res.json();
      images.value = data.images;
      lastUpdated.value = new Date(data.last_updated).toLocaleString();
      excludedNamespaces.value = data.excluded_namespaces;
    };

    const toggleShowExcluded = () => {
      showExcluded.value = !showExcluded.value;
    };

    const filteredImages = computed(() => {
        if (showExcluded.value) {
            return images.value;
        }
        return images.value.filter(image =>
            !image.namespaces.every(ns => excludedNamespaces.value.includes(ns))
        );
    });

    const sortBy = (key: keyof ContainerImage) => {
      if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
      }
    };

    const sortedImages = computed(() => {
      return [...filteredImages.value].sort((a, b) => {
        const aValue = a[sortKey.value];
        const bValue = b[sortKey.value];
        
        // Handle array sorting by joining the array
        const aComparable = Array.isArray(aValue) ? aValue.join(', ') : aValue;
        const bComparable = Array.isArray(bValue) ? bValue.join(', ') : bValue;

        if (aComparable < bComparable) {
          return sortOrder.value === 'asc' ? -1 : 1;
        }
        if (aComparable > bComparable) {
          return sortOrder.value === 'asc' ? 1 : -1;
        }
        return 0;
      });
    });

    onMounted(fetchImages);

    return {
      images,
      lastUpdated,
      sortBy,
      sortedImages,
      showExcluded,
      toggleShowExcluded,
    };
  },
});
</script>

<style scoped>
.update-icon {
  margin-left: 0.5rem;
  cursor: help;
}
.controls {
    margin-bottom: 1rem;
    text-align: right;
}
</style>
