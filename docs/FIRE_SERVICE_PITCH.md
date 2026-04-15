# Watch Commander Ops Hub

## Fire Service Go-to-Market Strategy

*Prepared for internal use — a working document for pitching the Ops Hub to UK Fire & Rescue Services.*

---

## Executive Summary

Watch Commander Ops Hub is an operational management platform built by a serving Watch Commander for UK fire stations. It replaces the paper, spreadsheets, and WhatsApp workflows that currently run daily watch operations — crewing boards, handover notes, sickness tracking, certification monitoring, and audit trails.

**Tagline:** *"Stop managing your watch from a clipboard."*

**Core value proposition:** A single source of truth for everything a watch needs to run safely, with a full audit trail for HMICFRS compliance and zero on-premises infrastructure.

---

## 1. Who to Target

Approach bottom-up, not top-down. Get serving staff using it informally, then escalate with evidence.

| Audience | Why Them | How to Reach |
|---|---|---|
| **Watch Commanders (peers)** | Peer validation matters more than slick decks. Your credibility as a serving WC is the biggest asset. | Coffee on station, WhatsApp groups, brigade conferences |
| **Station/Group Managers** | They feel the pain of chasing paper crewing boards, sickness cover, and handover gaps | Informal demo — "Boss, look what I built" |
| **Area Managers / Heads of Service Support** | Own the digital transformation budget and HMICFRS readiness | Formal proposal once you have SM/GM buy-in |
| **ICT / Digital / InfoSec** | Gatekeepers for any tool touching personnel data | Security architecture doc, DPIA |

**First move:** Get one more watch on your own station using it before approaching anyone above you.

---

## 2. The Hook — Problems You're Solving

Lead with pain points already complained about daily:

- **"Who's on OIC B10P1 on the 15th?"** — currently requires ringing around or digging through emails
- **"Prove to HMICFRS who signed off that crewing board"** — currently impossible or very slow
- **"Find me everyone with a BA re-qualification expiring in 30 days"** — currently a manual audit
- **"What did Red Watch hand over to White Watch last shift?"** — currently a whiteboard photo on WhatsApp
- **"We had a sickness gap on 1st pump and nobody spotted it until the bells went"** — genuine operational risk

If a decision-maker recognises any of those problems, you have their attention.

---

## 3. Unfair Advantages

Lead with these. They're what makes this product different from generic HR or rota tools.

1. **Built by a serving Watch Commander.** Not a consultant who "interviewed firefighters" — someone who actually drives a pump and fills in the book. Worth more than any feature list.
2. **Designed around the real workflow.** Day/night shift types, change of shift, detached duties, rest days, leave — all the messy reality generic rota tools ignore.
3. **HMICFRS-ready audit trail.** Every crewing decision logged with actor, timestamp, and full context. Inspectors love this.
4. **GDPR-compliant by design.** Role-based access control (WC/CC/FF), encrypted in transit (HSTS), rate-limited auth, strict content security policy. All documented.
5. **No on-prem headache.** Cloud-hosted. No server in the back office to maintain.
6. **Works on a phone.** PWA (Progressive Web App) — station iPad, WC's phone, office desktop — all the same app.

---

## 4. Proof Points

Evidence beats rhetoric every time. Build up a library of:

- **Live demo on real watch data** (anonymised if needed) — people buy what they can see working
- **Audit log screenshots** — "Here's every decision on yellow watch for the last 30 days, one click"
- **Sickness gap detection example** — "This alert fired at 06:00 today before parade because a sick entry crossed today's crewing board"
- **Before/after metrics from your own watch:**
  - Hours saved per week on admin
  - Reduction in crewing errors
  - Faster handover completion
  - Certifications flagged before expiry

**Start collecting these numbers now.** "Time spent on crewing before and after" is the killer stat.

---

## 5. Commercial Model

Three realistic options, easiest to hardest to land:

| Model | Pros | Cons |
|---|---|---|
| **Per-station SaaS (e.g. £50–£200/month)** | Predictable revenue, scales, low barrier to entry | Procurement cycles can be 12+ months |
| **Per-brigade licence (£20k–£80k/year)** | Big ticket, brigade-wide adoption | Requires FBU/union conversation, long procurement |
| **Free + consulting for deployment/customisation** | Frictionless adoption, trust-building | You do the work, harder to scale |

**Recommended starting point:** Offer free or heavily discounted pilots (£50/month per station) for the first 2–3 stations. Gather adoption evidence and ROI metrics. Then approach brigade HQ with *proof of adoption*, not just a pitch.

Retrofit a proper per-brigade deal once you're embedded.

---

## 6. Objections and Responses

Pre-empt the questions you'll hear in every meeting.

| Objection | Your Answer |
|---|---|
| *"We already have FireWatch / GRS / Pulsar"* | "Those are MIS systems — they hold the records. This is the daily operational layer — crewing, handover, real-time alerts. It sits between the MIS and the watch." |
| *"What about data security?"* | Show CSP, HSTS, rate-limiting, RBAC. Offer a pen-test report once you have one commissioned. |
| *"Who supports it at 3am?"* | "Cloud-hosted, monitored with Sentry error tracking, automatic failover. Better uptime than most current MIS systems." |
| *"This is a single point of failure"* | "The paper clipboard is also a single point of failure — one spilt coffee and it's gone. This has backups and a full audit trail." |
| *"It's not on our approved supplier list"* | "Happy to fill out your InfoSec questionnaire and DPIA. Let's find out what's needed to get on the list." |
| *"Will the FBU have concerns?"* | "It's an operational tool, not a performance-monitoring tool. The audit log shows *decisions*, not individual productivity." |
| *"What about integration with [existing system]?"* | "Read-only integrations possible via API. We're not asking to replace your system of record — we're the operational layer above it." |

---

## 7. First 30 Days Plan

| Week | Goal | Actions |
|---|---|---|
| **Week 1** | Prove it on your own watch | Full pilot with your own watch. Collect baseline metrics. Note specific time savings. |
| **Week 2** | Get one more watch on board | Show it to the other watches at your station. Offer to help set them up. Get at least one more using it daily. |
| **Week 3** | Your Station Manager | 20-minute demo. Come armed with data ("two watches now, X hours saved/week, here's the audit log"). |
| **Week 4** | Escalation path | Ask SM who at GM/AM level is interested in digital tools. Get introduced — don't cold-email. |

**Don't do this:** Email AMs/DCFOs cold with a pitch deck. It'll die in their inbox.
**Do this:** Walk in with a serving WC and say "Boss, look at this, we've been using it for a month."

---

## 8. Supporting Documents to Prepare

Before you approach anyone at brigade HQ, have these ready:

1. **One-page summary** — decision-makers read one page, not ten
2. **2-minute demo video** — for sharing in WhatsApp groups, emails, pre-meeting links
3. **Security & data protection overview** — for ICT/InfoSec (most of this already exists in the codebase)
4. **DPIA (Data Protection Impact Assessment) template** — fire services will require this for personnel data
5. **HMICFRS mapping document** — map features to HMICFRS inspection criteria:
   - Efficient use of resources
   - Promoting workforce planning
   - Ensuring fairness and promoting diversity
   - Leading and developing staff

---

## 9. Risks to Flag Internally

Be honest about these rather than letting them be discovered later.

- **Single developer key-person risk** — need a plan for handover or backup support
- **Scaling beyond one brigade** — current infrastructure supports it, but SLAs and support hours would need to scale too
- **Union/FBU engagement** — best to engage early rather than have it raised as a blocker late
- **Integration expectations** — brigades may expect more integration than initially offered; set expectations clearly
- **Procurement timeline mismatch** — brigade procurement can take 12–18 months; don't promise faster

---

## 10. Immediate Next Steps

1. Continue building up metrics on your own watch (time saved, errors avoided, audit log events)
2. Create the one-page summary and 2-minute demo video
3. Identify your first peer WC to pilot with
4. Prepare the security/DPIA documentation
5. Approach your SM informally with a demo (not a pitch)

---

*Document version: 1.0 — initial draft*
*Owner: John Cooper, Watch Commander*
*Last updated: April 2026*
