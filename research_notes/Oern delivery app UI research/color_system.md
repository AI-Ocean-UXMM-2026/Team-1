# Color systems for delivery and logistics mobile apps (Oern, Yangon; light theme only)

Method notes: "Computed" = my own Python (WCAG 2.x relative-luminance ratio; APCA-W3 0.0.98G-4g, Lc negative = light text on dark bg; CVD via Machado 2009 severity-1.0 matrices applied in linear RGB; dE76 in CIELAB D65). Search tooling was weak: several primary design-system pages (Grab, Uber Base, Material 3, Apple HIG, Mapbox nav docs, Gojek Asphalt, Lalamove, Bolt, Wolt) could not be fetched or returned no body, so competitor claims are thin and flagged. OSM tile colors in the map section are from my memory of the OSM Carto style and NOT verified in this session.

## Q1. How do leading delivery/ride apps assign color to action, status, live tracking and routes?

### Takeaway
Published, verifiable detail is scarce. What is documented: most delivery brands pick one saturated brand hue (Grab green, Gojek green, foodpanda pink, DoorDash red-orange, Lalamove orange, Deliveroo teal, Uber blue accent) and keep it distinct from a separate semantic set; mapping products reserve blue/gray for the route and green/orange/red for traffic. Oern's split (brand orange vs. darker action orange vs. blue for live) is consistent with this.

### Cited Findings
- Grab's own brand centre specifies the logo green by Pantone 355C, not hex; green logo on light backgrounds, white logo on dark. #00B14F is a third-party screen approximation. — [Grab brand centre](https://merchant.grab.com/en-my/brand-centre/grab); [logotyp.us](https://logotyp.us/logo/grab/)
- Gojek green listed as #00AA13 (aggregator, says checked against brand guidelines); Lalamove orange estimated #FF671D / #FFA300 (aggregator states these are estimates, not official); DoorDash red #EB1700 (logo.dev) or red-orange #FF3008 (third-party analysis); Deliveroo teal #00CCBC (third-party). Low confidence, non-primary. — [Gojek](https://www.brandcolorcode.com/gojek); [Lalamove](https://www.brandcolorcode.com/lalamove); [logo.dev DoorDash](https://www.logo.dev/search/brands/doordash.com); [Deliveroo guide](https://www.webdesignhot.com/design.md/deliveroo/)
- foodpanda: signature "fun pink" kept for recognition across Asia and extended with complementary colors for rider and partner branding (2021 refresh coverage). No hex/token documentation found. — [Marketing Magazine MY](https://archive.marketingmagazine.com.my/?p=105224)
- Uber accent blue is widely reported as #276EF1 (accent400). Semantic values conflict between third-party sources (success #05A357 / warning #FFC043 / error #E11900 vs. a generated-looking set), so not authoritative; source is the open-source Base Web repo, which I could not fetch. — [oppadu gallery](https://www.oppadu.com/tools/design-systems-site/brand/uber-base-web.html); [motiff](https://motiff.com/design-system-wiki/design-systems-overview/uber-base-design-system); [open-design.ai](https://open-design.ai/plugins/design-system-uber/)
- Lalamove driver app encodes order timing with color: red-orange = current/immediate order, orange = scheduled later same day, blue = scheduled next day or later. This is a documented example of orange family used for urgency in a driver app, with blue for "not yet". — [Lalamove SG blog](https://www.lalamove.com/en-sg/blog/driving-with-lalamove-what-do-all-those-colours-mean-and-when-do-i-actually-pick-up-the-orders)
- Google Maps: traffic layer green = no delays, orange = moderately heavy, red = delayed (darker red = slower); gray or blue lines are the user's route; closed roads dotted red. — [Google Maps Help](https://support.google.com/maps/answer/3092439?hl=en)
- Mapbox Navigation SDK exposes separate colors for route default, low, moderate, heavy, severe, unknown congestion and closures; default route color equals low/unknown congestion color; congestion bands by numeric range (low 0-39, moderate 40-59, heavy 60-79, severe 80-100). Hex defaults not retrieved. — [Mapbox Android RouteLineColorResources](https://docs.mapbox.com/android/navigation/v2/api/2.14.0/libnavui-maps/com.mapbox.navigation.ui.maps.route.line.model/-route-line-color-resources/index.html)
- Material 3, Apple HIG, Grab Design System, Gojek Asphalt, Shopify Polaris, Wolt, Bolt, Just Eat: pages did not load or no public color documentation surfaced in this session. Not reported.

### Inferences
- Brand hue and semantic hues are generally kept separate in mature systems; Oern's "Signal Orange brand-only / Kiln Orange action" mirrors the common pattern of a brand color that fails text contrast being paired with a darker action tone (inference, not documented for these apps).
- Using blue for "live/in-transit" matches Google/Mapbox route-blue convention, so users already read blue line = my route.

### Gaps
- No primary design-system documentation obtained for Grab, Uber (tokens), Gojek, Polaris, Wolt, Bolt, Just Eat, DoorDash, or Myanmar apps (e.g. Royal Express, Grab/foodpanda MM before exit, Ninja Van MM, Shopee Express MM). No Myanmar-specific app color documentation found.

## Q2. WCAG 2.2 and APCA requirements and Oern's pairs (computed)

### Takeaway
All Oern text pairs meet WCAG AA 4.5:1 except #64748b on #f1f5f9 (4.34) and the brand-only Signal Orange on white (2.80, correctly restricted). APCA is stricter for small/regular text: nothing Oern uses reaches the Lc 90 "preferred" body level except navy; several 14px/400 pairs sit around Lc 67-78, below the Lc 75 minimum for 14px/700 only when below 75.

### Cited Findings
- 1.4.3: 4.5:1 normal text, 3:1 large (18pt, or 14pt bold, ~24px / ~18.5px); ratios are not rounded (4.499 fails). — [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- 1.4.11: 3:1 against adjacent colors for UI component identifiers, state indicators and graphical objects needed to understand content; strict (2.999 fails); inactive controls exempt; control with identifying text need not have a border; maps are not specifically addressed. — [W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- 1.4.1 (Level A): color cannot be the only means to convey information; hue+lightness differences reaching 3:1 count as an extra visual distinction, but a difference depending on accurately perceiving a specific color still needs another indicator. — [W3C 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- 2.5.8 (AA): targets at least 24x24 CSS px, or spacing exception via 24px circle; page points to stricter 2.5.5 for important controls (44px figure not confirmed on that page). — [W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- APCA: Lc 90 preferred for body (14px/400, 18px/300); Lc 75 minimum body (18px/400, 16px/500, 14px/700); Lc 60 for non-body text lookup (24px/400, 18px/600, 16px/700); Lc 45 large headlines and fine icons; Lc 30 absolute minimum for large solid icons/"spot" text; Lc 15 for dividers/thick focus outlines, below that treat as invisible. APCA is the candidate method for WCAG 3, still draft, with the APCA Readability Criterion independently maintained; WCAG 2.x overstates contrast for dark colors. — [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)

Computed table (WCAG ratio / APCA Lc; Lc sign = polarity):

| Pair (fg on bg) | WCAG | APCA Lc | WCAG verdict |
|---|---|---|---|
| white on Kiln #c2410c | 5.18 | -79.9 | AA pass, AAA no |
| white on Kiln pressed #9a3412 | 7.31 | -89.4 | AAA |
| white on Signal #f97316 | 2.80 | -58.4 | fail (<3) |
| navy #172b4d on Signal #f97316 | 5.03 | 45.5 | AA pass, APCA only Lc 45 (large text level) |
| navy on Kiln | 2.72 | 24.1 | fail |
| Kiln on white / on orange-wash #fff7ed / on canvas | 5.18 / 4.88 / 4.95 | 74.5 / 70.4 / 71.4 | pass AA |
| Signal on white (as text/icon) | 2.80 | 53.2 | fails 3:1 as icon/outline |
| navy on canvas #f8fafc | 13.48 | 97.5 | AAA |
| #475569 on white / on #f1f5f9 | 7.58 / 6.92 | 86.3 / 80.0 | AAA |
| #64748b on white | 4.76 | 73.0 | AA pass (thin) |
| #64748b on canvas #f8fafc | 4.55 | 69.9 | AA pass (0.05 margin) |
| #64748b on #f1f5f9 | 4.34 | 66.7 | FAIL for text; pass 3:1 as border/icon |
| white on Live Blue #2563eb | 5.17 | -80.2 | pass |
| live-blue-text #1d4ed8 on #dbeafe | 5.49 | 68.8 | pass |
| green-text #166534 on #dcfce7 | 6.49 | 77.9 | pass |
| amber-text #92400e on #fef3c7 | 6.37 | 76.6 | pass |
| red-text #b91c1c on #fee2e2 | 5.30 | 66.8 | pass; APCA lowest of the washes |
| green #16a34a on white / white on green | 3.30 | 59.7 / -65.2 | fails text; ok as 3:1 icon only |
| amber #d97706 on white / white on amber | 3.19 | 58.5 / -63.9 | fails text; ok as icon/bar |
| red #dc2626 on white / white on red | 4.83 | 71.6 / -77.0 | pass |
| hairline #e2e8f0 on white | 1.23 | 11.5 | decorative only (below Lc 15 "invisible") |
| focus apricot #fdba74 on white | 1.69 | 29.8 | fails 1.4.11 as sole focus indicator |
| route #2563eb vs white casing | 5.17 | 74.9 | pass |
| driver marker navy vs white | 14.10 | 100.6 | pass |
| Signal vs adjacent washes (orange-wash vs amber-wash) | 1.05 | 0 | indistinguishable by lightness |

Candidate fixes (computed): #586579 on #f1f5f9 = 5.40 (Lc 73.3), #5b6b82 = 4.95; white on #15803d = 5.02; white on #b45309 = 5.02; white on #b91c1c = 6.47; white on #1d4ed8 = 6.70; navy on #fbbf24 = 8.45; navy on #fde68a = 11.32; navy on #fdba74 = 8.36.

### Inferences
- WCAG 2 and APCA disagree mostly on mid-tones: navy on Signal passes WCAG at 5.03 but APCA gives Lc 45, which APCA reserves for large/bold headlines, so using navy on Signal for 14px labels is defensible under WCAG 2.2 only. White on Kiln: WCAG 5.18 (AA) vs Lc -80 (OK for 16px/500+, short of Lc 90 preferred for 14px/400).
- Focus-apricot ring (1.69:1 on white) fails 1.4.11 unless paired with a darker ring/offset; confirm the actual focus style in code.
- The slate #64748b is fine for borders (3:1, WCAG 4.76) but not for text on subtle fills.

### Gaps
- WCAG 3 conformance thresholds are draft; APCA polarity-specific guidance for light-on-dark vs dark-on-light not detailed in the source page.

## Q3. Outdoor and sunlight legibility

### Takeaway
Ambient light adds a luminance term to both light and dark display states, collapsing contrast, so WCAG ratios measured indoors overstate real contrast; research recommends well above AA for outdoor use. Strong evidence on pastel washes and weight specifically is lacking.

### Cited Findings
- Ambient contrast ratio (ACR) adds ambient reflected luminance to bright and dark states; typical illuminance cited ~1,000-4,000 lux overcast, ~8,000-30,000 lux full daylight (patent text). — [USPTO application](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12397623)
- 2024 Photonics paper (phone panel tone mapping): high luminance with optimized gamma improves sunlight readability of low grayscale; cites ACR above 5:1 as a useful target. — [DOAJ record](https://doaj.org/article/bd8af37406d344db817bc71d5cd1f2cc) (summary via search; full text 403)
- DisplayMate shoot-outs (0 to ~40,000 lux) found manufacturers did little beyond raising brightness to improve outdoor readability (dated consumer devices). — [DisplayMate](https://displaymate.com/Smartphone_Brightness_ShootOut_1.htm)
- NTNU 2018 thesis "Effects of ambient illumination on text recognition for UI development" reportedly concludes W3C 7:1 is not sufficient outdoors and suggests 18:1 under high illumination; only seen through a search summary, not read directly. Treat as low-confidence. — [NTNU Open](https://ntnuopen.ntnu.no/ntnu-xmlui/handle/11250/2588645)
- Standards for display visibility: ISO 9241-303, SAE J1757-1. — [Grayhill](https://grayhill.com/blog/how-sunlight-readability-testing-ensures-clear-reliable-visual-interfaces/)
- Practitioner guidance (weak sources): light gray on white is most affected; aim 7:1+ for key elements; CTA 5:1+. — [mobile color reference](https://cdn.jsdelivr.net/npm/opencode-agent-config@1.1.3/skills/mobile-design/mobile-color-system.md); [growthsuite](https://www.growthsuite.net/questions/is-color-contrast-sufficient-on-ctas-for-mobile-outdoors-use)

### Inferences
- Pale washes (#dcfce7 etc.) differ from white by only ~1.1:1 in luminance, so under glare they wash to white; the wash should be treated as decoration and meaning carried by text/icon/border (supports redundancy). The computed wash-vs-wash dE of 15-24 mostly survives indoors but is lightness-poor.
- Aim for text ≥7:1 for critical COD amounts, status labels and primary buttons (Kiln pressed #9a3412 gives 7.31 with white); heavier weight (500-600+) is consistent with APCA's weight tables but no outdoor study on weight was found.
- Matte vs glossy screens and polarizing sunglasses (can blank LCD) were not researched.

### Gaps
- No peer-reviewed study found directly comparing saturated vs pastel fills or text weight in sunlight; 18:1 figure not independently verified.

## Q4. Color-vision deficiency (computed)

### Takeaway
Red/green/amber collapse badly for protan/deutan users: text-tone green vs red text has dE 8.5 (protan) and amber vs red text 4.8 (deutan). Blue vs green/red survives protan/deutan but green/blue collapse under tritanopia. Never rely on hue; keep icon + label.

### Cited Findings
- About 1 in 12 men (8%) and 1 in 200 women are colour blind; red/green types are most common. — [Colour Blind Awareness](https://www.colourblindawareness.org/colour-blindness/)
- WCAG 1.4.1: add text/icon/pattern; hue-only differences are insufficient. — [W3C 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- Okabe-Ito (8 colors, 2008) and Paul Tol (bright 7, muted 10, high-contrast 3; SRON 2021) are the standard CVD-safe qualitative palettes. — [khroma README](https://packages.oit.ncsu.edu/cran/web/packages/khroma/readme/README.html)

Computed dE76 (normal / protan / deutan / tritan) for solid families:
- green #16a34a vs red #dc2626: 122 / 27 / 21 / 128
- green vs amber #d97706: 92 / 16 / 35 / 98 (worst under protan)
- amber vs red: 41 / 32 / 17 / 34
- Kiln #c2410c vs red: 19 / 14 / 5 / 18 (near-identical under deutan; also close normally)
- Kiln vs amber: 25 / 21 / 16 / 21
- blue #2563eb vs green: 140 / 116 / 110 / 27 (collapses under tritan)
- text tones green-text #166534 vs red-text #b91c1c: 97 / 8.5 / 29 / 106
- green-text vs amber-text: 71 / 15 / 27 / 79
- amber-text vs red-text: 27 / 11 / 5 / 31
Wash fills: green vs red wash 24 / 9.5 / 3.4 / 24 (indistinguishable under deutan); green vs orange-wash 15 / 3 / 2 / 16; amber vs red wash 23 / 22 / 19 / 6; amber vs orange 17 / 17 / 17 / 5. Simulated protan colors: green #a49442, amber #958200, red #635923; deutan: green #958951, amber #ac9905, red #8f801b, so all three become olive/yellow.
Luminance Y: green 0.269, amber 0.280, red 0.167, blue 0.153, Kiln 0.153. Green and amber have almost identical lightness, so no lightness cue either.

### Inferences
- The success/failed pair and success/caution pair rely on hue; need icon (check / alert triangle / x), words ("Delivered", "Failed", "Attempted"), and ideally different shape of chip. Make red noticeably darker than amber (red-text vs amber-text currently Y 0.112 vs 0.098, no lightness separation).
- Kiln action vs failed-red are adjacent in hue; avoid placing destructive and primary buttons side by side distinguished only by color; use label and fill vs outline style.
- Tritan prevalence is rare; protan/deutan is the priority.

### Gaps
- No CVD simulation of the actual shipped screens; matrix choice (Machado vs Brettel) affects exact numbers slightly.

## Q5. Map route and marker colors

### Takeaway
Blue route + white casing is the near-universal convention (Google, Mapbox default) and Oern's choice holds up on contrast; main conflicts are blue vs water and orange pin vs orange/yellow roads; fix with casing, halo and shape.

### Cited Findings
- Google: gray or blue lines show your route; traffic uses green/orange/red; closed roads dotted red. — [Google Maps Help](https://support.google.com/maps/answer/3092439?hl=en); darker blue = selected, lighter = alternatives — [BGR](https://www.bgr.com/2226212/what-each-google-maps-traffic-color-means/)
- Mapbox Navigation layers a traffic line atop the main route line, with distinct congestion colors and closure color. — [Mapbox docs](https://docs.mapbox.com/android/navigation/v2/api/2.14.0/libnavui-maps/com.mapbox.navigation.ui.maps.route.line.model/-route-line-color-resources/index.html)
- WCAG 1.4.11: graphical objects needed to understand content need 3:1 against adjacent colors; line graphs need 3:1 vs background. — [W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)

Computed against OSM Carto-style colors (UNVERIFIED hex from memory: water #aad3df, park #c8facc, primary road #fcd6a4, secondary #f7fabf, motorway #e892a2): Live Blue #2563eb vs water 3.22 (Lc 45); vs park 4.43; vs white road 5.17. Kiln #c2410c vs primary road 3.77, park 4.44, motorway pink 2.24 (fails 3:1). Signal #f97316 vs secondary road 2.59 (fails). Navy marker vs park 12.09. Water vs white 1.60 (water barely separates from roads, but roads are casing-defined).

### Inferences
- Blue route over water is only 3.22:1 (borderline), which is why the white casing matters; keep casing ≥2px each side and consider a thin navy outer stroke for tile contrast.
- Destination pin: Kiln orange fine on most tiles but fails vs pink motorways and orange/yellow primary roads on some styles; use a white ring/halo plus a distinct glyph (flag/box) rather than hue alone. Signal Orange pins on yellow roads (2.6:1) should be avoided.
- Traffic colors green/orange/red overlap with Oern's status colors and with orange destination; if traffic is shown, thin segments with a pattern or confine to a toggle, or use darker value steps (Google's darker-red severity convention).
- Navy driver marker with white ring is the highest-contrast element and correct for the live entity; add heading arrow shape for non-color cue.

### Gaps
- Actual Mapbox Streets/Navigation style hex values and Oern's chosen map style were not checked; OSM colors need verification.

## Q6. Is orange a good primary action color for delivery? Cultural meaning in Myanmar

### Takeaway
Orange is common in logistics (Lalamove) and is a good attention color, but its action tone is close to amber (caution) and red (failed) so semantic separation depends on shade and redundant cues; in Myanmar the Buddhist-associated color is typically maroon/dark red in robes, with national-flag yellow/green/red meanings, so orange carries no strongly negative association but evidence is thin.

### Cited Findings
- Lalamove uses orange/red-orange for current driver orders and orange brand color (estimated hex). — [Lalamove SG](https://www.lalamove.com/en-sg/blog/driving-with-lalamove-what-do-all-those-colours-mean-and-when-do-i-actually-pick-up-the-orders); [brandcolorcode](https://www.brandcolorcode.com/lalamove)
- Myanmar flag (2010): yellow = unity, solidarity, wisdom/happiness; green = fertility, peace; red = bravery, decisiveness; white star. Shan State flag: yellow = Buddhism. — [Wikipedia Flag of Myanmar](https://en.wikipedia.org/wiki/Flag_of_Myanmar); [Flag of Shan State](https://en.wikipedia.org/wiki/Flag_of_Shan_State)
- Burmese monks mostly wear maroon/burgundy robes (sometimes ochre), unlike saffron in Thailand, Laos, Cambodia, Sri Lanka; saffron-robed monks led the 1988 and 2007 protests (CSMonitor framing "saffron color of power"; the 2007 uprising is commonly called the Saffron Revolution). — [exotravel](https://www.exotravel.com/blog/en/buddhist-monk/) (weak source); [CS Monitor](https://www.csmonitor.com/Commentary/the-monitors-view/2021/0217/The-saffron-color-of-power-in-Myanmar)
- Material and WCAG pairing: dark orange (#c2410c-like) with white text computes at 5.18:1. — computed above.

### Inferences
- Because Burmese robes read maroon/ochre rather than bright saffron, a bright orange brand is unlikely to evoke monastic dress, but Signal Orange near saffron could carry respect connotations; avoid orange for destructive or punitive states and avoid placing it on religious imagery. Needs local user check.
- The semantic collision problem is real: Kiln (action) vs amber (caution) dE 25 and vs red dE 19, collapsing under deutan (dE 5). Mitigation: keep amber-bearing UI as light wash + icon + dark brown text (not solid orange chips), reserve solid Kiln fill for buttons only, and give Failed a distinct icon plus label.
- Green's flag association with peace/fertility and red with bravery are not status-negative in Burmese contexts, but I found no documented local reading of red=error or green=success; assume international convention is learned from phones/banking.

### Gaps
- No authoritative source on orange or saffron meaning in Myanmar UI, no research on Burmese users' reading of traffic-light status colors, no Myanmar delivery-app color documentation.

## Recommendations vs. current palette (concise)
1. Keep Kiln #c2410c with white (5.18/Lc -80); use pressed #9a3412 (7.31/Lc -89) for hit-state and for the highest-stakes buttons (COD collect) given sunlight.
2. Fix #64748b on #f1f5f9 text (4.34): use #586579 (5.40) or #475569 for text; keep #64748b for borders/icons only (3:1 ok).
3. Raise the focus ring from apricot #fdba74 (1.69) to a darker ring or a double ring.
4. Treat all washes as decorative; every status chip needs icon + text; make red-text visibly darker than amber-text (no lightness gap currently).
5. Solid status icons: green #16a34a and amber #d97706 are 3.3/3.2 on white, ok for icons only; darker #15803d (5.02) and #b45309 (5.02) pass for text/white-on-fill.
6. Map: retain blue route + white casing; add halo to orange destination pin, navy outer stroke on route, shape differentiation for origin/destination/driver.
7. Do not use Signal #f97316 for text or white-on-orange labels (2.80).
