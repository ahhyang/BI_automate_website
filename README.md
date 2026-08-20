# Siteform

Turn a company document into a live website in minutes.

One Next.js app on Vercel. One Neon (or local) Postgres database. Every customer site is a row, served on a wildcard subdomain. This is **not** one Vercel project or Neon project per customer — that hits plan limits and conflicts with Vercel Hobby terms.

## Product decisions (locked for MVP)

| Question | Decision |
| --- | --- |
| Pricing | **Free** $0 · **Pro** $29/mo or $290/year |
| Free limits | 1 site, Quick Template, 1 AI Custom trial, subdomain, 3 regenerations/month, Siteform badge, no custom domain, no analytics |
| Pro | 10 sites, AI Custom, custom domain, analytics, 50 regenerations/month, no badge |
| Templates | 4 hand-built React templates (`classic`, `modern`, `bold`, `editorial`) sharing one `site_content` schema |
| Admin/CMS | The dashboard + preview/edit screens **are** the owner CMS. Visitors never see them |

Downgrade never deletes content. Extra sites go to draft, custom domains disconnect, the badge returns.

## Local setup

```bash
copy .env.example .env.local
docker compose up -d
npm install
npm run db:push
npm run dev
```

Open http://localhost:3000

- Marketing + portal: `localhost:3000`
- Example sites: `/examples/hale-whitmore`, `/examples/oak-ember`, `/examples/northline`
- Tenant hosts locally: `http://your-slug.localhost:3000`

Without `ANTHROPIC_API_KEY`, extraction and generation use deterministic fallbacks so the flow still works. Without `BLOB_READ_WRITE_TOKEN`, uploads land in `.data/uploads`. Without Stripe keys, billing UI is visible and checkout is paused.

## Production

1. One Vercel project (Pro) for this app.
2. One Neon project (Launch/Scale). `tenant_id` is on every table.
3. Add a wildcard domain `*.yourdomain.com` to **this** Vercel project.
4. Set `NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com`.
5. Optional: `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` so Pro customers can attach custom domains to the same project via the Vercel Domains API.

## Flow

Upload → extraction review → Quick Template or AI Custom → streamed generation → preview/edit (per-section regenerate) → publish on `{slug}.yourdomain.com`. Sign-up is required to publish, not to preview.
