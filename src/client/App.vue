<template>
  <div>
    <h1>Container Dashboard</h1>
    <p>Last updated: {{ lastUpdated }}</p>
    <h2>Container Images</h2>
    <table>
      <thead>
        <tr>
          <th @click="sortBy('repository')">
            Repository
          </th>
          <th @click="sortBy('tag')">
            Tag
          </th>
          <th @click="sortBy('namespaces')">
            Namespaces
          </th>
          <th @click="sortBy('container_names')">
            Container Names
          </th>
          <th @click="sortBy('oldest_pod_age')">
            Oldest Pod Age
          </th>
          <th @click="sortBy('total_restarts')">
            Total Restarts
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="image in sortedImages"
          :key="`${image.repository}:${image.tag}`"
        >
          <td>{{ image.repository }}</td>
          <td
            :title="
              image.newer_image_available
                ? `Newer image available: ${image.latest_image}`
                : ''
            "
          >
            {{ image.tag }}
            <span
              v-if="image.newer_image_available"
              class="update-icon"
            >🚀</span>
          </td>
          <td>{{ image.namespaces.join(", ") }}</td>
          <td>{{ image.container_names.join(", ") }}</td>
          <td>
            {{ formatAge(image.oldest_pod_age) }}
            <span
              v-if="isOld(image.oldest_pod_age)"
              class="age-icon"
            >🕰️</span>
          </td>
          <td>
            {{ image.total_restarts }}
            <span
              v-if="hasManyRestarts(image.total_restarts)"
              class="restarts-icon"
            >🔥</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="controls">
      <button
        :title="`Excluded namespaces: ${excludedNamespaces.join(', ')}`"
        @click="toggleShowExcluded"
      >
        {{ showExcluded ? "Hide" : "Show" }} excluded namespaces
      </button>
    </div>

    <h2>Helm Charts</h2>
    <table>
      <thead>
        <tr>
          <th @click="sortHelmBy('name')">
            Name
          </th>
          <th @click="sortHelmBy('chart')">
            Chart
          </th>
          <th @click="sortHelmBy('configured_version')">
            Configured Version
          </th>
          <th @click="sortHelmBy('installed_version')">
            Installed Version
          </th>
          <th @click="sortHelmBy('repository_url')">
            Repository URL
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="chart in sortedHelmCharts"
          :key="chart.name"
        >
          <td>{{ chart.name }}</td>
          <td>{{ chart.chart }}</td>
          <td>{{ chart.configured_version }}</td>
          <td>{{ chart.installed_version }}</td>
          <td>
            <a
              :href="chart.repository_url"
              target="_blank"
            >{{
              chart.repository_url
            }}</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed } from "vue";

interface ContainerImage {
  repository: string;
  tag: string;
  namespaces: string[];
  container_names: string[];
  newer_image_available: boolean;
  latest_image: string;
  oldest_pod_age: number;
  total_restarts: number;
}

interface HelmChart {
  name: string;
  chart: string;
  configured_version: string;
  installed_version: string;
  repository_url: string;
}

export default defineComponent({
  name: "App",
  setup() {
    const images = ref<ContainerImage[]>([]);
    const helmCharts = ref<HelmChart[]>([]);
    const lastUpdated = ref<string>("");
    const excludedNamespaces = ref<string[]>([]);
    const showExcluded = ref(false);
    const sortKey = ref<keyof ContainerImage>("namespaces");
    const sortOrder = ref<"asc" | "desc">("asc");
    const helmSortKey = ref<keyof HelmChart>("chart");
    const helmSortOrder = ref<"asc" | "desc">("asc");

    const fetchImages = async () => {
      const res = await fetch("/api/images");
      const data = await res.json();
      images.value = data.images;
      lastUpdated.value = new Date(data.last_updated).toLocaleString();
      excludedNamespaces.value = data.excluded_namespaces;
    };

    const fetchHelmCharts = async () => {
      const res = await fetch("/api/helm-charts");
      const data = await res.json();
      helmCharts.value = data.helm_charts;
    };

    const toggleShowExcluded = () => {
      showExcluded.value = !showExcluded.value;
    };

    const filteredImages = computed(() => {
      if (showExcluded.value) {
        return images.value;
      }
      return images.value.filter(
        (image) =>
          !image.namespaces.every((ns) =>
            excludedNamespaces.value.includes(ns),
          ),
      );
    });

    const sortBy = (key: keyof ContainerImage) => {
      if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
      } else {
        sortKey.value = key;
        sortOrder.value = "asc";
      }
    };

    const sortHelmBy = (key: keyof HelmChart) => {
      if (helmSortKey.value === key) {
        helmSortOrder.value = helmSortOrder.value === "asc" ? "desc" : "asc";
      } else {
        helmSortKey.value = key;
        helmSortOrder.value = "asc";
      }
    };

    const sortedImages = computed(() => {
      return [...filteredImages.value].sort((a, b) => {
        const aValue = a[sortKey.value];
        const bValue = b[sortKey.value];

        // Handle array sorting by joining the array
        const aComparable = Array.isArray(aValue) ? aValue.join(", ") : aValue;
        const bComparable = Array.isArray(bValue) ? bValue.join(", ") : bValue;

        if (aComparable < bComparable) {
          return sortOrder.value === "asc" ? -1 : 1;
        }
        if (aComparable > bComparable) {
          return sortOrder.value === "asc" ? 1 : -1;
        }
        return 0;
      });
    });

    const sortedHelmCharts = computed(() => {
      return [...helmCharts.value].sort((a, b) => {
        const aValue = a[helmSortKey.value];
        const bValue = b[helmSortKey.value];

        if (aValue < bValue) {
          return helmSortOrder.value === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return helmSortOrder.value === "asc" ? 1 : -1;
        }
        return 0;
      });
    });

    const formatAge = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
      return `${Math.floor(seconds / 86400)}d`;
    };

    const isOld = (seconds: number) => {
      return seconds > 30 * 24 * 3600; // 30 days
    };

    const hasManyRestarts = (restarts: number) => {
      return restarts > 10;
    };

    onMounted(() => {
      fetchImages();
      fetchHelmCharts();
    });

    return {
      images,
      helmCharts,
      lastUpdated,
      sortBy,
      sortedImages,
      showExcluded,
      toggleShowExcluded,
      sortHelmBy,
      sortedHelmCharts,
      formatAge,
      isOld,
      hasManyRestarts,
      excludedNamespaces,
    };
  },
});
</script>

<style scoped>
.update-icon,
.age-icon,
.restarts-icon {
  margin-left: 0.5rem;
}
.controls {
  margin-top: 1rem;
  text-align: right;
}
h2 {
  margin-top: 2rem;
  color: #93a1a1;
}
a {
  color: #268bd2;
}
button {
  background-color: #073642;
  color: #839496;
  border: 1px solid #586e75;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #002b36;
}
</style>
