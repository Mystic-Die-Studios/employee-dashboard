import { Outlet, useLoaderData } from "react-router-dom";
import { logout } from "./helpers/authHelpers";

export default function App() {
  const user = useLoaderData();
  return <Outlet context={{ user, logout }} />;
}
