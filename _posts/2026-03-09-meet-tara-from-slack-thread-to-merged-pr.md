---
layout: post
title: 'Meet Tara: From Slack Thread to Merged PR'
date: '2026-03-09 8:00:00 +0530'
categories:
  - AI
  - Engineering
tags:
  - tara
  - coding-agent
  - slack
  - ai-engineering
  - developer-tools
author: neurolink
description: >-
  Two engineers built a coding agent in their spare time. It doubled PR throughput.
  Meet Tara — the AI that lives in Slack and ships code from a thread.
toc: true
mermaid: true
pin: true
image:
  path: /assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/hero.png
  alt: 'Meet Tara: From Slack Thread to Merged PR'
---

Two engineers built a coding agent in their spare time. It doubled our PR throughput. Here is the story of TARA — Threaded AI Resource Agent — and how she changed the way we build software.

## The 13-Minute Bug Fix

Last week, Sarthak from Marketing dropped a screenshot into a Slack thread — a typo in the UI. Sachin tagged @TARA. Thirteen minutes later: bug identified at the exact file and line (`src/routes/(app)/ai/v2/+page.svelte`, line 849, two issues — missing space in "amatter", missing period), JIRA ticket BZ-47215 created, fix implemented, pull request #3847 created. Released to production the same day. No IDE opened. No ticket reassigned.

![Sarthak reports a typo bug in Slack](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/bug-fix-sarthak-report.png)

![Tara identifies the exact file, line, and two issues — then creates JIRA ticket and fix plan](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/bug-fix-tara-response.png)

That is not a demo. That happened at 8:55 on a Tuesday morning.

| Metric | Result |
|--------|--------|
| Collaborative threads | 400+ |
| PR throughput | 2x (from ~25/week to ~50) |
| Go-live timelines | 40–60% faster |

## One Year Ago

One year ago, we sat in a room with multiple engineering teams and asked a question: what if engineering was less about typing code, and more about the creative pursuit of solving problems?

We created a playbook. We shared it across teams. We made a YouTube video. The thesis was simple: discussions, debates, and planning become the primary work. Implementation gets offloaded.

Today, that thesis has a name.

**TARA** — Threaded AI Resource Agent. The name means "Star" in Hindi (तारा) — a guiding light that helps navigate through darkness. She lives in Slack, where work already happens. No new tools. No context-switching. 50+ integrated tools across JIRA, Bitbucket, GitHub, Figma, and Slack. 16+ file types understood — PDFs, images, code, spreadsheets, docs.

![Tara introduces herself and answers JIRA ticket queries](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/tara-intro-jira-tickets.png)

## Coder, Engineer, Builder

There is a difference between writing a function and deciding which function to write. Between debugging a race condition and understanding why the architecture allows it. Between implementing a feature and knowing which feature matters.

That progression — Coder to Engineer to Builder — is the shift we are living through. The value moves upstream: to thinking, designing, deciding. Tara handles the rest.

```mermaid
flowchart LR
    A["Coder<br/>Write functions"] --> B["Engineer<br/>Design systems"]
    B --> C["Builder<br/>Decide what matters"]
    style A fill:#546e7a,stroke:#37474f,color:#fff
    style B fill:#1565c0,stroke:#0d47a1,color:#fff
    style C fill:#2e7d32,stroke:#1b5e20,color:#fff
```

## The Stories

Those are the capabilities. Here is what they look like at 8:55 on a Tuesday morning.

### The Async Planning Loop

Sai needed Google Ads campaign creation for the Lighthouse repo. He tagged Tara. She reviewed the codebase, found 13 existing tools but no campaign creation capability, and built a plan.

![Sai asks Tara to plan Google Ads campaign creation — 87 replies deep](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/async-loop-sai-plan.png)

Yaswanth reviewed it. Spotted an issue: "Why is this in the multi modal server?" Tara corrected.

Yaswanth came back: "Update the existing PR. Remove placeholders. Do actual implementation. Ping me when done."

![Yaswanth reviews, catches architectural issue, Tara corrects and ships — Task Complete](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/async-loop-yaswanth-review.png)

Task Complete. PR #4477 created. Eighty-seven messages. Multiple people. Fully asynchronous. Nobody waited for anybody.

This is how building works now. A PM starts a conversation. An engineer reviews. Another engineer directs. Tara implements. The thread is the workspace.

### The 13-Minute Bug Fix (Expanded)

Back to Sarthak's screenshot. Tara did not just find a typo. She extracted the bug from an image, identified the exact file and line in a codebase she had never seen in that thread before, created a JIRA ticket with full context, and shipped a fix — all in 13 minutes.

Not a suggestion. A diagnosis. With receipts.

### Race Condition Detective

Nayni suspected a race condition between the frontend Nimble service (`/analytics/tracker`) and Vayu's `checkOrderStatusAndTriggerExternalTracker`. She described the symptoms in a Slack thread.

Tara came back: **"CRITICAL RACE CONDITION CONFIRMED."**

![Nayni describes the race condition — Tara confirms with exact root cause analysis](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/race-condition-confirmed.png)

The root cause: a Redis check-then-set deduplication gap — the window between checking if an event was already sent and marking it as sent was wide enough for duplicate Facebook CAPI events to slip through. Tara named the specific functions, traced the execution flow, and generated a full root cause analysis PDF: "Race Condition Analysis: Duplicate Facebook CAPI Events."

Not a suggestion. A diagnosis. With receipts.

### Instant Expertise

Vinay asked what `enablePartialPaymentSurchargeDisplay` and `addSurchargeToPartialPaymentRemainder` actually do. Sixty seconds later: a PDF report with full context, code references, and business logic explained.

![Vinay asks about backend configs — Tara responds in 60 seconds with full PDF report](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/vinay-backend-configs.png)

Sai asked about UTM parameter extraction for Breeze orders. Twenty-six replies deep — an ongoing technical collaboration that ended in a comprehensive analysis PDF.

![Sai asks about UTM extraction — 26 replies deep, full analysis PDF generated](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/sai-utm-extraction.png)

## The Coding Agent

When you say "implement this," here is what happens:

She clones the repo. She studies your team's coding patterns from recent PRs — not generic code, but code that looks like your team wrote it. She reads JIRA tickets for context. She implements, verifies, commits, pushes, and creates a pull request. You get real-time progress updates right in Slack.

![Coding agent queued — preparing execution](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/coding-agent-queued.png)

![Coding agent in progress — context gathered, repo cloned, branch configured, code analyzed](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/coding-agent-progress.png)

![Coding agent implementing changes — real-time progress in Slack](/assets/img/posts/meet-tara-from-slack-thread-to-merged-pr/coding-agent-implementing.png)

You move on to the next problem. She pings you when it is done.

```mermaid
flowchart TD
    A["@TARA implement this"] --> B["Context gathered"]
    B --> C["Repository cloned"]
    C --> D["Branch configured"]
    D --> E["Code analyzed"]
    E --> F["Implementing changes"]
    F --> G["Commit & Push"]
    G --> H["PR created"]
    style A fill:#0f3460,stroke:#1a1a2e,color:#fff
    style H fill:#2e7d32,stroke:#1b5e20,color:#fff
```

## Those Numbers Come From a Tool That Did Not Exist Six Months Ago

Built by Sachin Sharma and Parth Dogra. In their spare time. Sachin works with diverse engineering groups — freshers, interns, experienced engineers — and saw firsthand how much time went to repetitive implementation. Parth was simultaneously building new features for the Euler dashboard. They built Tara in pockets of time: first version in September 2025, the coding agent in December, the remaining capabilities in January and February 2026.

This is Phase 0. Multiple capabilities are already in the pipeline. Some are further along than you would think.

And there is one more thing about how Tara was built that we are not ready to share yet.

## Get Started

Tag **@TARA** in any Slack channel or thread. That is it. Share a screenshot, paste a JIRA link, describe what you need. She will take it from there.

Questions? Head to **#tara-dev** or experiment in **#tara-playground**. Or reach out to Sachin or Parth directly.

> **Build what matters.**
{: .prompt-tip }

---

**Related posts:**

- [Welcome to the NeuroLink Blog](/posts/welcome-to-neurolink-blog/)
