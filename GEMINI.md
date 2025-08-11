# Project Overview

This project is a web application that displays a dashboard of all deployed container images and their versions in a Kubernetes cluster. It is designed to work with a cluster that is managed by Flux CD.

The application is composed of a Vue.js frontend and an Express.js backend. The backend connects to the Kubernetes API to fetch information about running pods, container images, and Helm charts. The frontend displays this information in a user-friendly dashboard.

## Key Technologies

- **Frontend:** Vue.js, Vite
- **Backend:** Express.js, TypeScript
- **Kubernetes Interaction:** @kubernetes/client-node
- **Linting/Formatting:** ESLint, Prettier

# Building and Running

## Development

To run the application in development mode, use the following command:

```bash
npm run dev
```

This will start the backend server and the Vite development server for the frontend.

## Production

To build the application for production, use the following command:

```bash
npm run build
```

This will create a `dist` directory with the compiled backend and frontend code.

To run the application in production, use the following command:

```bash
npm start
```

# Development Conventions

## Linting and Formatting

This project uses ESLint for linting and Prettier for formatting. There is a pre-commit hook configured with Husky and lint-staged that will automatically format and lint your code before you commit.

You can also manually run the linter and formatter with the following commands:

```bash
npm run lint
npm run format
```
