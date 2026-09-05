import { createFileRoute } from "@tanstack/react-router";
import { DraftApp } from "@/components/DraftApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DraftApp />;
}
