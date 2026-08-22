import { PortalNav } from "@/components/portal/PortalNav";
import { UploadFlow } from "@/components/portal/UploadFlow";
import { FlowStepper } from "@/components/portal/FlowStepper";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CreatePage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/guest?next=/create");
  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <FlowStepper current="create" />
      <UploadFlow />
    </div>
  );
}
