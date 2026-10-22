# Myanmar (Yangon) context for the Oern parcel-delivery web app

Scope note: research budget was ~16 searches/fetches. Search quality for Myanmar was thin; many questions end in Gaps. Date of research: Oct 2026. Items marked "(background, unsourced)" in Inferences come from general knowledge, not from a fetched source, and need verification before being treated as fact.

## Oern's current setup (verified in repo)

### Takeaway
Oern already self-hosts Noto Sans Myanmar (400/600/700) behind Inter, but the document is `lang="en"`, there is no Burmese language-specific CSS, and DESIGN.md's 20px body line-height / 16px label line-height are Latin-tuned and will clip Burmese.

### Cited Findings
- DESIGN.md: stack is "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"; body 14px/20px, body-large 15px/22.5px, label 12px/16px (12px "is the floor"), figure 14px weight 650 tabular-nums, display 30/33px, headline 20/26, title 16/22, input 16/22, button 16/24; "Burmese Fallback Rule" requires `var(--font-myanmar)` directly after Inter; sentence case; light theme only; layouts tested at 320/360/390/430px; 48px min targets. — /Users/happer/Projects/oern/DESIGN.md
- src/app/layout.tsx: Inter loaded via `next/font/local` as latin-only woff2 at 400/500/600/700 (`--font-inter`); Noto Sans Myanmar woff2 files named `noto-sans-myanmar-myanmar-{400,600,700}-normal.woff2` (`--font-myanmar`); `<html lang="en">`. — /Users/happer/Projects/oern/src/app/layout.tsx
- src/app/globals.css: body stacks use `var(--font-inter), var(--font-myanmar), Inter, "Noto Sans Myanmar", ...`; many hard-coded line-heights, including 1.08, 1.1, 1, 16px, 17px, 18px, and 20px on small text (e.g. lines 768, 2391, 2444, 3947, 4194, 4210, 4343, 4471, 4824). No `:lang(my)` rule and no `overflow-wrap`/`word-break` handling found for Burmese. — /Users/happer/Projects/oern/src/app/globals.css
- PRODUCT.md: rider GPS only while app is open, "background tracking is not guaranteed"; tracking begins at pickup; push/SMS notifications "remain planned"; Supabase RLS. — /Users/happer/Projects/oern/PRODUCT.md

### Inferences
- Weight mismatch: Oern uses 500, 650, 750 in places; the Burmese font ships only 400/600/700, so the browser will pick the nearest face (500 -> 400 or 600; 650/750 -> 600/700). Label (500) Burmese will render at 400, likely thin at 12px. (Inference from font-matching rules.)
- Because the whole page is `lang="en"`, browsers choose Latin-oriented line-breaking and hyphenation and may select a different system font for Burmese glyphs if the self-hosted font fails to load; set `lang="my"` on Burmese text nodes (or the root when the locale is Burmese).

### Gaps
- Did not inspect the Noto Sans Myanmar woff2 for unicode-range coverage (e.g. Myanmar Extended-A/B for Shan/Karen letters) or file size.

## 1. Burmese script and Unicode

### Takeaway
No reliable 2024-2026 Zawgyi usage share was found; the last numbers are 2019 (roughly 85-90% Zawgyi). Unicode is the official standard and large platforms auto-convert, but legacy Zawgyi users and Zawgyi-encoded data (names, addresses, free-text notes) should be expected, so detect-and-convert at input is prudent. Line-height must be roughly 1.5-1.6x for Burmese.

### Cited Findings
- Zawgyi was the most popular font on Burmese websites before 2019; the government designated 1 October 2019 as "U-Day" to switch officially to Unicode, expected to take about two years, and the 2021 coup complicated it (Wikipedia page itself is tagged "needs update"). — [Wikipedia: Zawgyi font](https://en.wikipedia.org/wiki/Zawgyi_font)
- Bagan Keyboard user data (Oct 2019) was reported as about 15% Unicode vs 85% Zawgyi; other outlets cite ~90% Zawgyi around the switch. — [Burma Library / Frontier summary via search](https://www.burmalibrary.org/en/myanmar-switch-to-unicode-to-take-two-years-app-developer); [Frontier Myanmar](https://www.frontiermyanmar.net/en/zawgyi-to-unicode-the-big-switch). Undated claims that ">90% of devices still use Zawgyi" exist but were unverified.
- Facebook removed Zawgyi as an interface language for new users and built Zawgyi-to-Unicode auto-converters into Facebook and Messenger so people can read mixed content. — [Meta Engineering: Facebook's path from Zawgyi to Unicode](https://engineering.fb.com/android/unicode-font-converter/)
- Conversion tooling: ICU has a `Zawgyi-my` transliterator and Google publishes Python "Myanmar Tools" (Zawgyi detector/converter). — [Wikipedia: Zawgyi font](https://en.wikipedia.org/wiki/Zawgyi_font)
- Pre-2019 vendor practice: Samsung and Huawei shipped Zawgyi-based system fonts in place of Unicode. — [Wikipedia: Zawgyi font](https://en.wikipedia.org/wiki/Zawgyi_font) (pre-2019; current behaviour not verified)
- Line-height: an informal SuttaCentral test of tall scripts found clipping at line-height 1.1 and recommended at least 1.6; even Noto Sans clipped Roman descenders at 1.1. — [SuttaCentral forum](https://discourse.suttacentral.net/t/testing-for-line-height-with-tall-scripts/6196)
- Real-world bug: Tor Browser Burmese UI text cut off at the top with shipped Noto Sans Myanmar. — [Tor Browser issue 41051](https://gitlab.torproject.org/tpo/applications/tor-browser/-/issues/41051); related oversize line-height report [issue 41932](https://gitlab.torproject.org/tpo/applications/tor-browser/-/issues/41932)
- Noto Sans Myanmar is an unmodulated sans design for the Myanmar script requiring complex-text shaping; stacked marks depend on the shaping engine. — [Noto Sans Myanmar article](https://secret.blahaj.dedyn.io/misc/Fonts/fonts-main/ofl/notosansmyanmar/article/ARTICLE.en_us.html); [Fontsource](https://fontsource.org/fonts/noto-sans-myanmar/about)
- Line breaking: ICU4X provides Burmese/Khmer/Lao/Thai dictionary- or LSTM-based line segmentation; Burmese has no inter-word spaces and writers have used ZWSP for break points. — [ICU4X LineSegmenter docs](https://icu4x.unicode.org/2_3/tsdoc/classes/LineSegmenter.html); [Unicode list 2007](https://unicode.org/mail-arch/unicode-ml/y2007-m08/0122.html)

### Inferences
- Treat Zawgyi as a minority-but-nonzero risk. Free-text typed by riders/customers (addresses, delivery notes, names) may arrive in Zawgyi; run Google Myanmar Tools (or the ICU transliterator) server-side on write, store Unicode, and keep the raw string. Zawgyi text rendered in a Unicode font shows broken stacks, which would look like an Oern font bug.
- Oern's 20px line-height at 14px (1.43) and 16px at 12px (1.33) are below the ~1.6 evidence; 22.5/15 (1.5) is borderline. Burmese-specific tokens (e.g. `:lang(my)` body 14px/24px, label 12px/20px, title 16px/26px, headline 20px/32px, display 30px/46px) would be needed; chips (28px) and list rows (64px) need min-height rather than fixed height, and `overflow:hidden; line-height:1` patterns (globals.css lines 1723, 2391, 2444) will clip.
- Minimum size: Burmese glyphs have small counters and stacked marks; 12px Burmese is likely hard to read at weight 400. Suggest 13-14px floor for Burmese labels (inference; no source found for a formal minimum).
- Word breaking: use `overflow-wrap:anywhere` or `word-break: normal` + `lang="my"` (browsers use ICU dictionaries for line breaking); use `Intl.Segmenter('my',{granularity:'word'})` for truncation/search tokenization and avoid ellipsis cutting mid-cluster (cut on grapheme boundaries, `granularity:'grapheme'`). Support in browsers was not verified in these searches.
- Numerals: Burmese digits (၀-၉) exist; many apps use Arabic digits in UI for amounts and times (background, unsourced). Keep Arabic digits for amounts/ETAs/tracking codes (consistent with the Tabular Figures Rule) and verify that Noto Sans Myanmar has tabular Arabic digits, otherwise Inter supplies them via fallback order (Inter first, so Latin digits come from Inter: fine).
- Padauk, Pyidaungsu, Myanmar Text are alternatives (background, unsourced); Noto Sans Myanmar is a reasonable single choice. Keeping 400/600/700 and mapping 500->400 should be a deliberate choice.

### Gaps
- No current (2024-2026) Zawgyi share; no data on how Samsung/Oppo/Vivo/Xiaomi default fonts now behave; no W3C Myanmar layout-requirements page was fetched; no source on Intl.Segmenter browser support for Burmese; no authoritative minimum-size guidance.

## 2. Localization conventions and competitor UI

### Takeaway
No documented UI teardown of Wave Money, KBZPay, foodpanda Myanmar, etc. was obtained. Only background-level inference is possible; this area needs a hands-on app review (Play Store/Mobbin).

### Cited Findings
- Foodpanda Myanmar has operated since December 2019; its riders were reported on strike (year not stated in snippet) demanding a rider hotline and ID cards. — [BNI Online](https://www.bnionline.net/en/node/91390)
- Wave Money reports ~60,000 agents and 200,000+ merchants (company claim). — [Wave Money press release](https://www.wavemoney.com.mm/blog/wp-content/uploads/2020/12/htd_ENG-Press-Release_Wave-Money-and-METRO-Partner-for-Fast-and-Secure-Digital-Payment.pdf)
- Myanmar Standard Time: UTC+6:30, no DST, and kyat code MMK (background, unsourced; not fetched).

### Inferences
- Common practice (background, unsourced): bilingual toggle in settings/first-run, Burmese default for consumer apps, English kept for brand names, codes and sometimes status terms; formal vs colloquial register (spoken-style Burmese in UI copy is increasingly common). Verify via app review.
- Currency display: "1,500 Ks" or "MMK 1,500" with comma thousand separators (background, unsourced); decide one and keep it in the `figure` style.
- 12-hour clock with AM/PM vs Burmese day-period words: unverified.

### Gaps
- Could not find UI documentation for Grab Myanmar, KBZPay, Wave Pay, Shop.com.mm, Burmese Pageant, Ninja Van Myanmar, Royal Express, Shwe Express. Need direct app inspection. Ninja Van/Royal Express Myanmar searches returned nothing.

## 3. Devices and networks

### Takeaway
Android dominates with a spread of versions (11-16 each 8-19%), Xiaomi/Oppo/Vivo lead Android vendors, mobile throughput collapsed to ~5 Mbps median in early 2025, and power cuts, tower damage, shutdowns and VPN restrictions make offline tolerance and light pages essential.

### Cited Findings
- Internet users: 33.4M (61.1%) early 2025; 39.8M (72.5%) end 2025. Mobile connections 63.3M early 2025; 62.5M (114% of population) late 2025; 96.8% of connections are 3G/4G/5G (GSMA Intelligence), not a proxy for actual usage. — [DataReportal 2025](https://datareportal.com/reports/digital-2025-myanmar); [DataReportal 2026](https://datareportal.com/reports/digital-2026-myanmar)
- Ookla median mobile download 5.09 Mbps at start of 2025, reported down 78.2% (18.22 Mbps) year on year; fixed median 25.83 Mbps (early 2025), 26.90 Mbps (end 2025). Mobile figure rests on a single secondary report (DataReportal citing Ookla). — [DataReportal 2025](https://datareportal.com/reports/digital-2025-myanmar)
- Facebook ad reach 13.7M and TikTok 21.0M adults (late 2025). — [DataReportal 2026](https://datareportal.com/reports/digital-2026-myanmar)
- StatCounter Android versions (June 2026, Myanmar): Android 13 ~18.7%, 15 ~14%, 12 ~13.9%, 11 ~13.1%, 14 ~12.2%, 16 ~8.8%. — [StatCounter](https://gs.statcounter.com/android-version-market-share/mobile/myanmar)
- StatCounter vendors (mid-2026): Xiaomi ~33-38%, Apple ~15-20%, Oppo ~10-11%, Vivo ~7%, Samsung ~6%, Unknown 6-32% depending on page; pages disagree. Infinix/Tecno not shown. — [StatCounter vendors](https://gs.statcounter.com/vendor-market-share/mobile/myanmar). Note StatCounter measures web traffic, not installed base.
- 300+ shutdowns since Feb 2021 per Myanmar Internet Project; partial shutdowns/bandwidth limits in Sagaing, Kachin, Shan; VPN ban from 30 May (2024 per article date) with Signal/WhatsApp blocked, Facebook/Instagram/X restricted; hundreds of towers damaged; hours-long power outages common; internet penetration 44% Jan 2024 per that article (conflicts with DataReportal's 61% early 2025 figure, different methodology). — [Rest of World, Oct 2024](https://restofworld.org/2024/myanmar-internet-blackouts-app-vpn-bans-starlink/)
- Access Now: 85 shutdowns in Myanmar in 2024 (76 military-ordered); 2025 Myanmar-specific count not retrieved. — [Internet in Myanmar digest](https://www.internetinmyanmar.com/digest/2026-03-31-record-internet-blackouts-myanmars-digital-repression-in-202/)
- Power: Jan 2025 Yangon rotation reported as 4h on / 8h off, residents reported less; after the March 2025 earthquake Yangon reportedly 4h/day; towers lose power. — [Myanmar Now](https://myanmar-now.org/en/news/myanmar-suffers-worsening-power-cuts-as-junta-prioritizes-military-zones/); [Strat News](https://stratnewsglobal.com/myanmar/myanmars-power-crisis-worsens-amid-rebel-strikes-gas-shortages/); [MIP via Progressive Voice](https://progressivevoicemyanmar.org/2025/03/29/status-regarding-current-communication-outages-and-blackouts-after-myanmar-earthquake-by-myanmar-internet-project-mip/). No post-2025 figure found.

### Inferences
- Page weight: with ~5 Mbps median (and many users below that), budget the rider/customer shell to a small JS payload and aim for <150-200 KB critical transfer (engineering judgement, not sourced). Three Burmese woff2 weights plus Inter weights add transfer; subset Burmese, use `font-display: swap`, preload only the 400/600 Burmese if the locale is Burmese.
- Offline tolerance: queue rider status updates and COD records locally and retry (Service Worker/IndexedDB), show "saved, will send" states; PRODUCT.md already says tracking works only while app open - tell riders explicitly and keep screen-awake affordances.
- Map weight: vector Mapbox tiles are heavier than raster OSM at low zoom; cache the Yangon bounding box; offer low-data map mode (static list + text route), consistent with Oern's "Map Earns Its Space" rule.
- Device spread: test on Android 11-16 Chrome and low-RAM Xiaomi/Oppo/Vivo; Apple share is non-trivial in StatCounter (web traffic skews wealthier), so Safari iOS also matters. Aggressive OEM battery management on Xiaomi/Oppo/Vivo (background, unsourced) further breaks browser background GPS.
- Data-pack costs, typical RAM, DPI, operator mix (Telenor sold to M1/ATOM, Ooredoo exit, MPT, Mytel) were not sourced.

### Gaps
- No Opensignal/GSMA/ITU data retrieved; no per-operator speeds; no data-pack prices; no RAM/DPI stats; no 2025-26 Yangon shutdown specifics; Ookla Global Index not accessed directly.

## 4. Addressing and maps

### Takeaway
Little documented; Myanmar uses a 7-digit postal code and township/ward structure, but evidence on geocoding quality and street-name practice was not found. Design for pin-first, landmark-text, and call-the-recipient.

### Cited Findings
- Myanmar postal codes have 7 digits; typical vendor-recommended order: recipient, house/building number and street, ward, township, city, region, postal code; Yangon example "Ward 5, Kyauktada Township". — [GeoPostcodes](https://www.geopostcodes.com/country/myanmar/address-validation/)
- Many central Yangon streets were renamed after 1948 so old and new names both appear. — [Wikipedia: List of name changes in Yangon](https://en.wikipedia.org/wiki/List_of_name_changes_in_Yangon)
- MIMU publishes place-name P-code data in Myanmar Unicode with roman transliteration. — [HDX MIMU Yangon village points](https://data.humdata.org/showcase/mimu-geonode-village-points-yangon-region-pcode-showcase)

### Inferences
- Address text should be free-form plus structured township (from MIMU P-code list) plus a mandatory map pin; store both Burmese and roman township names; search must match transliteration variants (background, unsourced: romanization is inconsistent).
- Courier practice of phoning the recipient (background, unsourced) implies one-tap call and copy-number from rider stop sheet; masking numbers is a privacy option.
- Plus Codes/what3words: no Myanmar adoption evidence found.

### Gaps
- Geocoding accuracy for Google/Mapbox/OSM/Nominatim in Yangon; landmark conventions; Plus Code/what3words use; pin accuracy studies.

## 5. Payments and COD

### Takeaway
Cash/COD remains central. Exact COD share is unverified; wallets (KBZPay, Wave Money) are widespread.

### Cited Findings
- 2020: "Most purchases made on Facebook are paid for by cash on delivery"; ~30% had a bank account; Wave Money customers ~30% of adults; "cash remains king". — [ISEAS Fulcrum, 2 Jun 2020](https://fulcrum.sg/the-advent-of-cashless-transactions-in-myanmar-cash-is-still-king/) (older than 2023)
- A Shopify-vendor guide gives COD ~35%, wallets ~40%, bank transfer 12%, cards 8% with no primary dataset; KBZPay claimed 20M+ users. — [EasySell guide 2026](https://easysellapp.com/blogs/wiki/myanmar-ecommerce-cod-shopify-market-guide-2026) (low confidence)
- 2023: highest denomination 10,000 kyat; a limited 20,000-kyat note was issued, with currency falling on announcement and inflation ~14%. — [Thai PBS World](https://www.thaipbsworld.com/?p=316232) (approximate)

### Inferences
- COD recording UI needs: amount due, amount tendered, change owed (since small-note change is a known pain point, background unsourced), and a separate wallet-paid state (already consistent with Oern's "two separate signals" principle). Show amounts in whole kyat, no decimals.
- Rider remittance practices were not found; keep an auditable per-rider cash ledger and end-of-shift reconciliation.

### Gaps
- Primary COD share; AYA Pay/CB Pay data; wallet transaction limits; rider remittance norms; current exchange rate.

## 6. Local competitors and conventions

### Takeaway
Only foodpanda Myanmar was confirmed. Viber/Facebook Messenger/Telegram usage is plausible but not sourced beyond platform reach figures.

### Cited Findings
- foodpanda Myanmar since Dec 2019 (rider strike report). — [BNI Online](https://www.bnionline.net/en/node/91390)
- Facebook ad reach 13.7M; TikTok 21.0M adults. — [DataReportal 2026](https://datareportal.com/reports/digital-2026-myanmar)
- Per Rest of World (2024), Signal and WhatsApp banned; Telegram and TikTok remain accessible; Facebook restricted. — [Rest of World](https://restofworld.org/2024/myanmar-internet-blackouts-app-vpn-bans-starlink/)

### Inferences
- Because messaging platforms are partly restricted/unstable, in-app call (tel:) and SMS fallback are more reliable than relying on one messenger; offer optional Viber/Telegram deep links rather than a single chat channel (Viber status not verified).

### Gaps
- Ninja Van, Royal Express, Shwe Express, Gold Mini, Dolphin, Bobo, motorbike couriers: no sources found; their current activity is unconfirmed.

## 7. Political and safety context

### Takeaway
Documented: shutdowns, VPN/app restrictions, a 2025 Cybersecurity Law with three-year data retention, and reports of phone inspections and registration. Location data about riders and customers is sensitive; minimise and shorten retention.

### Cited Findings
- Cybersecurity Law took effect 30 July 2025 (Notification 113/2025); RFA reports penalties for unauthorized VPN installation or service (six months, fine) while law-firm summaries say it regulates VPN providers, not users - sources conflict; user data retention of three years reported. — [Allen & Gledhill](https://www.allenandgledhill.com/mm/publication/articles/31053/cybersecurity-law-in-force-30-july-2025); [RFA](https://rfa.org/english/myanmar/2025/01/02/cybersecurity-law-vpn/); [Mondaq](https://www.mondaq.com/security/1661506/myanmar-cybersecurity-law-takes-effect)
- Reports of patrols checking phones for VPN apps and a "Person Scrutinization and Monitoring System" cross-checking IDs; suspension of privacy-law protections - single-analysis claims. — [USA-ASEAN](https://usasean.org/article/recent-developments-myanmars-cybersecurity-and-citizens-privacy-law)
- Mandatory phone IMEI registration reported (date uncertain, ~2026); checkpoint phone searches reported by one outlet only. — [AsiaNews](https://www.asianews.it/en/south-east-asia/myanmar/myanmar-military-imposes-mandatory-registration-for-all-mobile-phones)
- SIM registration requires full name and NRC photos (2022 notice). — [MPT](https://mpt.com.mm/en/telecom-operators-announce-importance-of-sim-re-registration/)
- Freedom House ranked Myanmar tied with China for worst internet freedom environment (per Rest of World). — [Rest of World](https://restofworld.org/2024/myanmar-internet-blackouts-app-vpn-bans-starlink/)

### Inferences
- Design implications: collect rider location only between pickup and delivery (already in PRODUCT.md), delete or coarsen breadcrumbs soon after delivery close, avoid showing customer exact home pins to riders before acceptance, avoid retaining full address-to-phone linkages longer than needed, don't ship third-party analytics SDKs, and let users see/erase data. Avoid VPN-dependent assumptions; Mapbox/Supabase endpoints may be intermittently blocked, so add retry and fallback messaging (reachability of those hosts in Myanmar not verified).
- Curfews/checkpoints: no sourced current information; allow riders to mark "road blocked" (already in Oern's red state) with neutral wording.

### Gaps
- Official text of the law; curfew/checkpoint specifics for Yangon; whether location data has been requested from delivery apps.

## Comparison summary vs Oern rules (concise)
- 14/20 body and 12/16 label: too tight for Burmese; add `:lang(my)` tokens (~1.6-1.7 ratio) and keep 12px only for Latin/digits.
- Font weights 500/650/750 not shipped for Burmese; align to 400/600/700.
- `lang="en"` root: add per-text `lang`.
- Fixed-height chips (28px), rows (64px), buttons (56px): switch to min-height so Burmese does not clip.
- Tabular figures: keep Arabic digits.
- Light-only, flat design: no conflict. Self-hosted fonts: aligned with network unreliability.
