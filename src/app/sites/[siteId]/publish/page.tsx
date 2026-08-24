import { redirect } from "next/navigation";
import type { Params } from "@/lib/page-props";

/** Legacy launch URL — Project console is the control center. */
export default async function PublishRedirect({ params }: Params<{ siteId: string }>) {
  const { siteId } = await params;
  redirect(`/sites/${siteId}/project`);
}
