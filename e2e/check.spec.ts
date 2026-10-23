import { test } from "./support/test";
import { signInAs } from "./support/supabase-mock";

function lum(c){const m=c.match(/\d+/g);if(!m)return 0;const [r,g,b]=m.map(Number);return (0.299*r+0.587*g+0.114*b);}
test('contrast', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T04:00:00Z"));
  await signInAs(context, "manager", {
    support_cases: [
      { id:"case-1", order_id:null, requester_id:"user-1", assigned_to:null, subject:"Late delivery", description:"Parcel arrived late", priority:"high", status:"open", resolution_notes:null, created_at:"2026-10-20T03:00:00Z", updated_at:"2026-10-20T03:00:00Z", resolved_at:null },
    ],
    delivery_orders: [],
  });
  await page.goto('http://localhost:3100/manager/complaints');
  await page.waitForTimeout(6000);
  const bad = await page.evaluate(() => {
    function lum(c){const m=c.match(/\d+/g);if(!m)return 0;const [r,g,b]=m.map(Number);return (0.299*r+0.587*g+0.114*b);}
    const results=[];
    const all=document.querySelectorAll('*');
    for (const el of all) {
      const cs=getComputedStyle(el);
      if (!el.textContent || !el.textContent.trim()) continue;
      if (el.children.length>0 && el.textContent.trim()===el.children[0]?.textContent?.trim()) continue;
      const bg=cs.backgroundColor;
      const color=cs.color;
      // only consider opaque-ish backgrounds
      if (bg==='rgba(0, 0, 0, 0)') continue;
      const cl=lum(color), bl=lum(bg);
      if (Math.abs(cl-bl)<80) {
        results.push({ tag:el.tagName, cls:el.className, text:el.textContent.trim().slice(0,40), color, bg });
      }
    }
    return results.slice(0,20);
  });
  console.log(JSON.stringify(bad, null, 2));
});
