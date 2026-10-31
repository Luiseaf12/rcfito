import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BranchCatalog } from "./branch-catalog"
import { createMockBranchRepository } from "./mock-branch-repository"

export function BranchDemo({ portalContainer, canWrite = true }: { portalContainer: HTMLElement; canWrite?: boolean }) {
  const [client] = useState(() => new QueryClient())
  const [repository] = useState(() => createMockBranchRepository(canWrite))
  // Remount on a role/identity change: mock permission and cache belong to this demo.
  return <QueryClientProvider client={client}>
    <BranchCatalog repository={repository} canWrite={canWrite} scope="demo" portalContainer={portalContainer}
      confirmDiscard={() => window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?")} />
  </QueryClientProvider>
}
