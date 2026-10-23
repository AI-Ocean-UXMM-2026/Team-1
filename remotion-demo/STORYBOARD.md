# OERN hackathon demo — interaction cut

Target: 78 seconds, 1920×1080, 30 fps. Start inside the working product. No title card, outro card, market claims, or generic feature slides.

## Motion script

The pointer is the narrator. A dotted blue target appears on the real control, the cursor travels into it, one click ripple confirms the action, and the next shot begins on the resulting screen. Explanations stay attached to the active control and use one sentence.

| Time | Screen | Interaction | On-screen explanation |
|---|---|---|---|
| 00:00–00:06 | Customer home | Click the real **Track order** button. | Open one delivery from the authenticated home screen. |
| 00:06–00:14 | Customer tracking | Rider marker advances; live location is framed. | Location and ETA update while COD stays separate. |
| 00:14–00:21 | Rider jobs | Click the real **Open route** link. | Resume the job already in progress. |
| 00:21–00:32 | Rider active route | Click the real **Confirm arrival** button. | One clear action under the next stop and due time. |
| 00:32–00:42 | Manager overview | Click **Task Automation** in the real sidebar. | Open task automation. |
| 00:42–00:52 | Manager task automation | Click **Live track** in the real sidebar. | Switch from queue control to live operations. |
| 00:52–01:03 | Manager live tracking | Click **Vehicles** in the real sidebar. | Move from the live map to fleet readiness. |
| 01:03–01:10 | Manager vehicles | Frame the live availability summary. | Check availability before assignment. |
| 01:10–01:18 | Customer completion | Frame Delivered and COD Collected together. | End inside the completed delivery state. |

## Data rules

- Manager, rider, and customer-home shots are authenticated captures from the deployed app.
- Customer in-transit and delivered states are controlled presentation data and are never written to Supabase.
- Delivery and COD status remain separate.
- No fabricated performance metrics, testimonials, URLs, or contact details.
