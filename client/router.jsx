import { createBrowserRouter } from "react-router-dom";
import App from "./src/App";
import AuthPage from "./src/pages/AuthPage";
import userVerify from "./src/helpers/authHelpers";
import DashboardPage from "./src/pages/Dashboard";
import Workspace from "./src/components/Workspace";

const router = createBrowserRouter([
  { path: "/preview", element: <Workspace preview /> },
  {
    path: "/",
    element: <App />,
    loader: userVerify,
    children: [
      {
        index: true,
        element: <AuthPage />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
    ],
  },
]);

export default router;
