import { Navigate, useLocation } from "react-router-dom";

export default function UserLoginPage() {
  const location = useLocation();
  return <Navigate replace to={{ pathname: "/login", search: location.search }} />;
}
