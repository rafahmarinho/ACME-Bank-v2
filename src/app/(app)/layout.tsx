import { requireSession, getSimNow, isStaffRole } from "@/services/session";
import { listNotifications } from "@/services/notifications";
import { avatarUrl, preferencesOf } from "@/services/profile";
import { navFor } from "@/components/layout/nav-config";
import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { MobileBrand, NotificationsBell, SimClock, UserMenu } from "@/components/layout/topbar";
import { RealtimeSync } from "@/components/layout/realtime-sync";
import { ThemeSync } from "@/components/layout/providers";
import { Badge } from "@/components/ui/badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, userId } = await requireSession();
  const [notifications, now, { data: sim }] = await Promise.all([
    listNotifications(supabase, userId),
    getSimNow(),
    supabase.from("sim_state").select("scenario").eq("id", 1).maybeSingle(),
  ]);
  const staff = isStaffRole(profile);
  const sections = navFor(profile.role, profile.kyc_status === "verified");

  return (
    <div className="min-h-dvh">
      <Sidebar
        sections={sections}
        footer={
          <div className="rounded-lg bg-sidebar-accent/60 p-3 text-xs">
            <p className="font-medium text-white">{staff ? "Staff workspace" : "Need help?"}</p>
            <p className="mt-0.5 text-sidebar-foreground/70">
              {staff ? `Signed in as ${profile.role}` : "Our team replies to tickets within one business day."}
            </p>
          </div>
        }
      />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <MobileBrand />
          {staff && (
            <Badge className="hidden bg-brand text-brand-foreground sm:inline-flex">
              {profile.role === "admin" ? "Admin" : "Support"}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <SimClock now={now} scenario={sim?.scenario ?? "baseline"} />
            <NotificationsBell items={notifications.items} unread={notifications.unread} />
            <UserMenu name={profile.full_name} email={profile.email} role={profile.role} avatar={avatarUrl(profile)} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:pb-12">{children}</main>
      </div>
      <BottomNav sections={sections} />
      <RealtimeSync userId={userId} staff={staff} />
      <ThemeSync theme={preferencesOf(profile).theme} />
    </div>
  );
}
