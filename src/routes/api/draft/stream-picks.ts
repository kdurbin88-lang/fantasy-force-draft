import { createFileRoute } from "@tanstack/react-router";
import { getStreamPicks, setStreamPicks } from "@/lib/draftStream";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/draft/stream-picks")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => json({ ok: true, ...getStreamPicks() }),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          names?: string[];
          takenPlayerIds?: string[];
          picks?: Array<{ name?: string; fullName?: string }>;
        };
        const names = [
          ...(body.names ?? []),
          ...(body.picks ?? []).map((p) => p.name || p.fullName || ""),
        ].filter(Boolean);
        if (names.length === 0 && (body.takenPlayerIds?.length ?? 0) > 0) {
          return json(
            {
              ok: false,
              error:
                "Send player names, not ESPN ids. The sniffer should post { names: string[] }.",
            },
            400,
          );
        }
        const saved = setStreamPicks(names);
        return json({ ok: true, count: saved.length, names: saved });
      },
    },
  },
});
