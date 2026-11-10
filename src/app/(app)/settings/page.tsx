import type { Metadata } from "next";
import { requireSession } from "@/services/session";
import { preferencesOf } from "@/services/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/display";
import { PasswordForm, PreferencesForm } from "@/components/account/profile-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await requireSession();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Notifications, alerts, appearance and security." />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Notifications & alerts</CardTitle>
            <CardDescription>Choose when ACME Bank should get your attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <PreferencesForm prefs={preferencesOf(profile)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Use a unique password you don&apos;t use on other sites.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
