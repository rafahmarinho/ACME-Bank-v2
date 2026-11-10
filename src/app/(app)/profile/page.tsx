import type { Metadata } from "next";
import { requireSession } from "@/services/session";
import { avatarUrl } from "@/services/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionList, PageHeader, StatusBadge } from "@/components/common/display";
import { ProfileForm } from "@/components/account/profile-forms";
import { formatDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { profile } = await requireSession();
  return (
    <div>
      <PageHeader title="Profile" description="Your personal and contact information." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>We use these details for statements and to contact you about your accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} avatar={avatarUrl(profile)} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Membership</CardTitle>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                ["Customer number", profile.customer_number ?? "—"],
                ["Role", titleCase(profile.role)],
                ["Identity", <StatusBadge key="k" status={profile.kyc_status} />],
                ["Date of birth", profile.date_of_birth ? formatDate(`${profile.date_of_birth}T12:00:00Z`) : "—"],
                ["Member since", formatDate(profile.created_at)],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
