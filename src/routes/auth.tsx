import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout wrapper untuk semua route di bawah /auth/*
// Child routes: /auth/login, /auth/register
export const Route = createFileRoute("/auth")({
  component: () => <Outlet />,
});
