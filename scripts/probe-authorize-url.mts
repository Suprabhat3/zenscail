/** Read-only probe: what does Corsair's gmail/gcal OAuth authorize URL look like? */
import { createClient } from "@corsair-dev/app";

const apiKey = process.env.CORSAIR_DEV_KEY!;
const instanceId = process.env.CORSAIR_INSTANCE_ID!;
if (!apiKey || !instanceId) {
  console.error("Missing CORSAIR_DEV_KEY / CORSAIR_INSTANCE_ID");
  process.exit(1);
}

const corsair = createClient({ apiKey });
const inst = corsair.instance(instanceId);
const t = inst.tenant("scope-probe-tenant");

for (const plugin of ["gmail", "googlecalendar"] as const) {
  try {
    const { authorizeUrl } = await t.plugins.oauth.authorizeUrl(
      plugin,
      "https://example.com/after",
    );
    console.log(`\n=== ${plugin} ===`);
    console.log(authorizeUrl);
    try {
      const u = new URL(authorizeUrl);
      console.log("host:", u.host);
      console.log("scope param:", u.searchParams.get("scope"));
      // Mirror narrowScopes() in app/(app)/connect/actions.ts
      const verified = {
        gmail: ["https://www.googleapis.com/auth/gmail.modify"],
        googlecalendar: ["https://www.googleapis.com/auth/calendar"],
      }[plugin];
      u.searchParams.set("scope", verified.join(" "));
      console.log("AFTER narrowScopes:", u.searchParams.get("scope"));
    } catch {}
    // If it's a Corsair-hosted URL, follow redirects manually to see the Google URL.
    if (!authorizeUrl.includes("accounts.google.com")) {
      let url = authorizeUrl;
      for (let i = 0; i < 5; i++) {
        const res = await fetch(url, { redirect: "manual" });
        const loc = res.headers.get("location");
        console.log(`hop ${i}: status=${res.status} location=${loc ?? "(none)"}`);
        if (!loc) break;
        url = new URL(loc, url).toString();
        if (url.includes("accounts.google.com")) {
          const g = new URL(url);
          console.log("GOOGLE scope param:", g.searchParams.get("scope"));
          break;
        }
      }
    }
  } catch (err) {
    console.error(`${plugin} failed:`, err);
  }
}
