import express from "express";
import * as k8s from "@kubernetes/client-node";
import { createCache } from "cache-manager";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ImagePolicy {
  metadata: {
    name: string;
  };
  status?: {
    latestImage?: string;
  };
}

interface HelmChartCR {
  metadata: {
    name: string;
  };
  spec: {
    chart: string;
    version: string;
    sourceRef: {
      name: string;
    };
  };
  status?: {
    artifact?: {
      revision: string;
    };
  };
}

interface HelmRepository {
  metadata: {
    name: string;
  };
  spec: {
    url: string;
  };
}

async function createServer() {
  const app = express();
  const port = parseInt(process.env.VITE_PORT) || 8080;

  const cache = createCache({
    ttl: (parseInt(process.env.CACHE_TTL) || 300) * 1000,
  });

  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

  async function fetchContainerImages() {
    const excludedNamespaces = (process.env.EXCLUDED_NAMESPACES || "")
      .split(",")
      .filter(Boolean);

    const latestImages = new Map();
    try {
      const imagePolicies = (await k8sCustomApi.listNamespacedCustomObject(
        "image.toolkit.fluxcd.io",
        "v1beta2",
        "flux-system",
        "imagepolicies",
      )) as { body: { items: ImagePolicy[] } };

      if (imagePolicies && imagePolicies.body.items) {
        for (const policy of imagePolicies.body.items) {
          if (
            policy.metadata.name.endsWith("-latest") &&
            policy.status &&
            policy.status.latestImage
          ) {
            const latestImage = policy.status.latestImage;
            const repository = latestImage.split(":")[0];
            latestImages.set(repository, latestImage);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch ImagePolicies:", error);
    }

    const pods = await k8sApi.listPodForAllNamespaces();
    const imagesMap = new Map();
    for (const pod of pods.body.items) {
      if (pod.status?.phase !== "Running" || !pod.spec || !pod.metadata) {
        continue;
      }

      const podAge = pod.metadata.creationTimestamp
        ? Math.floor(
            (new Date().getTime() -
              new Date(pod.metadata.creationTimestamp).getTime()) /
              1000,
          )
        : 0;
      const restartCount = pod.status.containerStatuses
        ? pod.status.containerStatuses.reduce(
            (acc, status) => acc + status.restartCount,
            0,
          )
        : 0;

      for (const container of pod.spec.containers) {
        const imageFull = container.image;
        if (!imageFull) {
          continue;
        }
        let repository, tag;
        if (imageFull.includes(":")) {
          [repository, tag] = imageFull.split(":", 2);
        } else {
          repository = imageFull;
          tag = "latest";
        }
        const imageIdentifier = `${repository}:${tag}`;

        let newer_image_available = false;
        let latest_image = "";
        if (latestImages.has(repository)) {
          const latestImage = latestImages.get(repository);
          if (latestImage !== imageFull) {
            newer_image_available = true;
            latest_image = latestImage;
          }
        }

        if (!imagesMap.has(imageIdentifier)) {
          imagesMap.set(imageIdentifier, {
            repository,
            tag,
            namespaces: [],
            container_names: [],
            newer_image_available,
            latest_image,
            oldest_pod_age: podAge,
            total_restarts: restartCount,
          });
        } else {
          const image = imagesMap.get(imageIdentifier);
          if (podAge > image.oldest_pod_age) {
            image.oldest_pod_age = podAge;
          }
          image.total_restarts += restartCount;
        }
        const image = imagesMap.get(imageIdentifier);
        image.namespaces.push(pod.metadata.namespace);
        image.container_names.push(container.name);
      }
    }
    const images = Array.from(imagesMap.values());
    return {
      images,
      last_updated: Date.now(),
      excluded_namespaces: excludedNamespaces,
    };
  }

  async function fetchHelmCharts() {
    const helmCharts = [];
    const helmRepositories = new Map();
    try {
      const helmRepoList = (await k8sCustomApi.listNamespacedCustomObject(
        "source.toolkit.fluxcd.io",
        "v1",
        "flux-system",
        "helmrepositories",
      )) as { body: { items: HelmRepository[] } };

      if (helmRepoList && helmRepoList.body.items) {
        for (const repo of helmRepoList.body.items) {
          helmRepositories.set(repo.metadata.name, repo.spec.url);
        }
      }

      const helmChartList = (await k8sCustomApi.listNamespacedCustomObject(
        "source.toolkit.fluxcd.io",
        "v1beta2",
        "flux-system",
        "helmcharts",
      )) as { body: { items: HelmChartCR[] } };

      if (helmChartList && helmChartList.body.items) {
        for (const chart of helmChartList.body.items) {
          helmCharts.push({
            name: chart.metadata.name,
            chart: chart.spec.chart,
            configured_version: chart.spec.version,
            installed_version: chart.status?.artifact?.revision,
            repository_url: helmRepositories.get(chart.spec.sourceRef.name),
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch HelmCharts:", error);
    }
    return { helm_charts: helmCharts, last_updated: Date.now() };
  }

  app.get("/api/images", async (req, res) => {
    try {
      const cachedData = await cache.get("images");
      if (cachedData) {
        return res.json(cachedData);
      }
      const data = await fetchContainerImages();
      await cache.set("images", data);
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch container images" });
    }
  });

  app.get("/api/helm-charts", async (req, res) => {
    try {
      const cachedData = await cache.get("helm-charts");
      if (cachedData) {
        return res.json(cachedData);
      }
      const data = await fetchHelmCharts();
      await cache.set("helm-charts", data);
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch helm charts" });
    }
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve(__dirname, "..", "client")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "..", "client", "index.html"));
    });
  } else {
    const { default: vue } = await import("@vitejs/plugin-vue");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      root: path.resolve(__dirname, "..", "client"),
      appType: "spa",
      plugins: [vue()],
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(
      `Server is running at http://${process.env.VITE_HOST || "localhost"}:${port}`,
    );
  });
}

createServer();
