# Container Dashboard

This project is a web application that displays a dashboard of all deployed container images and their versions in a Kubernetes cluster.

It consists of a Python backend using FastAPI and a Vue.js frontend.

## Project Structure

- `backend/`: The FastAPI backend application.
- `frontend/`: The Vue.js frontend application.
- `k8s/`: Kubernetes deployment files.
- `.github/workflows/`: GitHub Actions for CI/CD.
- `Dockerfile`: Dockerfile for building the application container.

## Local Development

To run the application locally, you need to have Python, Node.js, and npm installed.

### Backend

1.  Navigate to the `backend` directory.
2.  Install dependencies: `uv pip install -r requirements.txt`
3.  Run the development server: `uvicorn main:app --reload`

The backend will be running at `http://127.0.0.1:8000`.

### Frontend

1.  Navigate to the `frontend` directory.
2.  Install dependencies: `npm install`
3.  Run the development server: `npm run dev`

The frontend will be running at `http://127.0.0.1:5173`.

## Docker

### Build the container

To build the Docker container locally, run the following command from the project root:

```bash
docker build -t container-dashboard .
```

### Run the container

To run the container locally, you need to provide it with access to your Kubernetes cluster. You can do this by mounting your kubeconfig file.

```bash
docker run -p 8080:80 -v ~/.kube/config:/root/.kube/config container-dashboard
```

The application will be available at `http://localhost:8080`.

## Kubernetes Deployment

1.  **Build and Push the Image**: The included GitHub Action will automatically build and push the container image to the GitHub Container Registry.

2.  **Update Deployment YAML**: Open `k8s/deployment.yaml` and replace `ghcr.io/YOUR_USERNAME/YOUR_REPOSITORY:latest` with the path to your container image.

3.  **Apply the YAML**: Use `kubectl` to deploy the application to your cluster:

    ```bash
    kubectl apply -f k8s/deployment.yaml
    ```

4.  **Access the Application**: The service is of type `ClusterIP` by default. To access it, you can use port-forwarding:

    ```bash
    kubectl port-forward svc/container-dashboard-service 8080:80
    ```

    The dashboard will then be available at `http://localhost:8080`.
