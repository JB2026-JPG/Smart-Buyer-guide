# Smart Buyer Guide — €0 static production package

## Publish first, automate, monetize later
1. Create a **public** GitHub repository (for example `smart-buyer-guide`).
2. Upload the ZIP contents to the repository, including `.github/workflows/demand-finder.yml` and `scripts/fetch-demand.mjs`.
3. Open `site-config.js` and set `demandDataUrl` to the raw URL of `data/opportunities.json` in that repository, for example `https://raw.githubusercontent.com/YOUR-USERNAME/smart-buyer-guide/main/data/opportunities.json`.
4. In GitHub, open **Actions** and run **Demand Finder** once with **Run workflow** to verify it can fetch and publish data. It then runs automatically every 30 minutes (GitHub may delay scheduled jobs during high load).
5. Deploy the website folder once to a free static host such as Cloudflare Pages. The website can be visited without an affiliate link.
6. After an affiliate program approves you, open `affiliate-config.js` and paste the exact approved HTTPS tracking URL into `defaultAffiliateLink` (or a category-specific field).

## How the machine works
- Public website: static HTML/CSS/JavaScript.
- Demand Finder: reads public Software Recommendations questions from the Stack Exchange API in the browser.
- Intent scoring: DROP / RESEARCH / TEST NOW.
- Topic routing: CRM / hosting / business software.
- Affiliate CTA: appears only when an approved HTTPS URL is configured.
- The system never contacts question authors, collects their contact details, or claims a signal is a confirmed buyer.

## Zero-cost safety
- No database, KV, Worker, paid API, API key, subscription or paid runtime is required.
- The browser Demand Finder uses a 30-minute cache and a hard maximum of 4 source refreshes per browser per rolling 24 hours.
- API `backoff` instructions are respected.
- If the free safety limit is reached or the source is unavailable, the site does not spend money; it keeps cached results and waits.
- Hosting is subject to the host's current free-plan terms. A free plan cannot guarantee unlimited traffic or permanent uptime.

## Background automation
The website is static, but the Demand Finder is not limited to browser visits. GitHub Actions runs `scripts/fetch-demand.mjs` automatically every 30 minutes, reads public Software Recommendations questions, scores them and updates `data/opportunities.json`. The public website reads that published data URL. No person is contacted and no private data is collected. Scheduled GitHub Actions can be delayed by GitHub; they are not a guaranteed real-time clock.

## Zero-cost safety
Use a **public** repository so standard GitHub-hosted Actions are free under GitHub's current policy. Do not add a paid runner, private-repository billing, paid API, or payment method for this project. The workflow uses one short standard runner job and no secrets. The site host is separate and should remain on its Free plan with auto-recharge disabled. Cloudflare Pages's current Free plan has a hard monthly credit limit and pauses sites rather than charging for extra credits.

Affiliate commissions still require an approved affiliate program, a valid tracking link, a visitor click, and a qualifying conversion.
