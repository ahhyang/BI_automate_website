import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <h1 className="font-display text-4xl">We can’t find that page.</h1>
      <p className="mt-3 text-ink-soft">It may be a draft site that hasn’t been published, or a mistyped link.</p>
      <div className="mt-6">
        <ButtonLink href="/">Back to Siteform</ButtonLink>
      </div>
    </div>
  );
}
