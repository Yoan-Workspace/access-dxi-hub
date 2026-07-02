import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { applyGoogleTranslateDomPatch } from "@/lib/googleTranslateDomPatch";
import { getRouter, queryClient } from "./router";
import "./styles.css";

applyGoogleTranslateDomPatch();

const router = getRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
