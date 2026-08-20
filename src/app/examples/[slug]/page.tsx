import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { getDemoSite } from "@/lib/demo-sites";
import type { Params } from "@/lib/page-props";

export default async function ExamplePage({ params }: Params<{ slug: string }>) {
  const { slug } = await params;
  const model = getDemoSite(slug);
  if (!model) notFound();
  return <SiteRenderer model={model} />;
}
