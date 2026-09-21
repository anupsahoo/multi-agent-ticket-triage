/**
 * Settings (`/settings`): the three gates, the hop limit, and which backends are in play.
 * Reads `/api/settings` (editable thresholds) and `/api/meta` (read-only provider names).
 * Renders `SettingsForm`, which saves back through the browser client.
 */
import { TopBar } from "@/components/shell/TopBar";
import { engineJson } from "@/lib/engine";
import { SettingsForm } from "@/components/settings/SettingsForm";
import type { Meta, Settings } from "@/lib/types";

export default async function SettingsPage() {
  const [settings, meta] = await Promise.all([engineJson<Settings>("/api/settings"), engineJson<Meta>("/api/meta")]);
  return (
    <>
      <TopBar title="Settings" crumbs={["Desk", "Settings"]} />
      <main className="px-4 py-6 md:px-6">
        <p className="mb-4 text-sm text-fg-muted">Thresholds and models. The three gates and the hop limit are the only knobs the orchestrator exposes; everything else is a connector or a provider.</p>
        <SettingsForm initial={settings} meta={meta} />
      </main>
    </>
  );
}
