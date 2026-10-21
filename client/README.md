# Mystic Die Studios frontend

Run `npm run dev` from `client/`, then open <http://localhost:5173/preview> to demonstrate the workspace without signing in or starting Django. The preview includes sample documents, a task board, and browser-local editing. The signed-in `/dashboard` uses the same workspace UI with the existing GitHub authentication flow.

Documents and tasks are prototype data saved in local storage, scoped separately for the public preview and each signed-in account. They are not shared between users or synchronized with Django. Team invitations are a visible placeholder. The document editor currently supports plain text. No AppFlowy source code or assets were incorporated.

Validation: `npm run build`, `npm run lint`, and `npm run cy:run -- --spec cypress/e2e/workspace/preview.cy.js` (with the Vite server running). If your shell sets `ELECTRON_RUN_AS_NODE`, unset it for the Cypress invocation.

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
