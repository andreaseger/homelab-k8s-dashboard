import express from 'express';
import * as k8s from '@kubernetes/client-node';
import { createCache } from 'cache-manager';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
    const app = express();
    const port = 3000;

    const cache = createCache({ ttl: 300 * 1000 });

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

    async function fetchContainerImages() {
        const excludedNamespaces = (process.env.EXCLUDED_NAMESPACES || '').split(',').filter(Boolean);

        let latestImages = new Map();
        try {
            const imagePolicies: any = await k8sCustomApi.listNamespacedCustomObject({
                group: 'image.toolkit.fluxcd.io',
                version: 'v1beta2',
                namespace: 'flux-system',
                plural: 'imagepolicies'
            });

            if (imagePolicies && imagePolicies.items) {
                for (const policy of imagePolicies.items) {
                    if (policy.metadata.name.endsWith('-latest') && policy.status && policy.status.latestImage) {
                        const latestImage = policy.status.latestImage;
                        const repository = latestImage.split(':')[0];
                        latestImages.set(repository, latestImage);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch ImagePolicies:", error);
        }

        const pods = await k8sApi.listPodForAllNamespaces();
        const imagesMap = new Map();
        for (const pod of pods.items) {
            if (pod.status?.phase !== "Running" || !pod.spec || !pod.metadata) {
                continue;
            }
            for (const container of pod.spec.containers) {
                const imageFull = container.image;
                if (!imageFull) {
                    continue;
                }
                let repository, tag;
                if (imageFull.includes(':')) {
                    [repository, tag] = imageFull.split(':', 2);
                } else {
                    repository = imageFull;
                    tag = 'latest';
                }
                const imageIdentifier = `${repository}:${tag}`;

                let newer_image_available = false;
                let latest_image = '';
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
                    });
                }
                const image = imagesMap.get(imageIdentifier);
                image.namespaces.push(pod.metadata.namespace);
                image.container_names.push(container.name);
            }
        }
        const images = Array.from(imagesMap.values());
        return { images, last_updated: Date.now(), excluded_namespaces: excludedNamespaces };
    }

    app.get('/api/images', async (req, res) => {
        try {
            const cachedData = await cache.get('images');
            if (cachedData) {
                return res.json(cachedData);
            }
            const data = await fetchContainerImages();
            await cache.set('images', data);
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch container images' });
        }
    });

    if (process.env.NODE_ENV === 'production') {
        app.use(express.static(path.resolve(__dirname, '..', 'client')));
        app.get('*', (req, res) => {
            res.sendFile(path.resolve(__dirname, '..', 'client', 'index.html'));
        });
    } else {
        const { default: vue } = await import('@vitejs/plugin-vue');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            root: path.resolve(__dirname, '..', 'client'),
            appType: 'spa',
            plugins: [vue()]
        })
        app.use(vite.middlewares)
    }


    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
}

createServer();