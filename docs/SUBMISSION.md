# MessWise submission draft

Replace every bracketed field with a verified fact before submitting. Keep the writeup aligned with the recorded demo.

**Track:** Waste and Energy

**Team:** [team name; solo entrant name]

**Public repository:** [adityak1609/messwise](https://github.com/adityak1609/messwise)

**YouTube demo, under three minutes:** [URL]

**Hosted application:** [MessWise on AWS Amplify](https://pilot.d3b3z2kcn310jh.amplifyapp.com)

## Problem

Our campus mess publishes daily food-waste figures, but a number on a board is hard to connect to menus, supporting observations, and a specific follow-up action. MessWise helps staff keep that evidence together without requiring sensors or individual plate weighing.

## What I built during the event

A React and TypeScript app to record the date, published waste weight, menu, scope and meal coverage; attach source and supporting photos; review daily records; and track an action and follow-up. Attendance is optional and its denominator is explicit. The app includes a browser-only mode for trying the workflow and an AWS integration for authenticated storage.

An optional plate pilot stores paired photos and a dish list. Two people save independent ratings before Amazon Nova Lite scores visual leftovers in quarter steps, with a "cannot assess" option. A second model run checks repeatability. The table reports exact/within-step agreement, excluded cases, and separate plate/dish counts. [Fill in real counts and results only after collecting and evaluating the pilot.]

[Confirm the features above against the final video. Add event dates and link relevant commits. Describe any starter code or pre-event material actually used.]

## Where AWS fits

Hosting, first-login/password setup, record save/reload, private photo upload/retrieval, user isolation, and paired-photo human reviews were verified with disposable technical data on 8 October 2026. Those test records were removed and are not field evidence. Bedrock still reports pending AWS account verification; do not claim a successful inference until it is verified and shown in the demo.

The frontend is hosted on AWS Amplify. Cognito authenticates the pilot login. API Gateway sends record requests to a Node.js Lambda function, which stores records in DynamoDB. Source and plate photos are held in a private S3 bucket using signed upload/download access. The video shows [timestamp] saving and reloading a record, that record in DynamoDB, and a Lambda invocation in CloudWatch.

[Include only if demonstrated:] The paired-photo endpoint calls Amazon Bedrock's Nova Lite model in [model region], withholding human ratings and feedback. The video shows [timestamp] a real inference result and its CloudWatch request metadata. Pilot model/prompt version: [actual values from the exported evaluation].

**Deployment region:** `us-east-1`

**Verified on:** 8 October 2026 (technical deployment checks; real pilot results still pending)

**AWS evidence in video:** [timestamp]

Do not claim AWS deployment from local storage mode or from the presence of infrastructure files alone.

## Pilot evidence and limits

- Source of published measurements: [mess notice/register; permission if applicable].
- Dates and count of real daily records: [dates; n].
- Weight scope and covered meals: [confirmed scope, or scope unconfirmed].
- Attendance source and denominator, if used: [source; meals served for the same coverage].
- Supporting plate photos: [n], provided with permission; these are a convenience sample.
- Paired-photo evaluation: [n plates], [m dish observations], [collection dates]; repeated volunteers and dishes on one plate are related observations.
- Model vs each human, exact/within-25-point agreement: [counts/denominators]; cannot-assess cases: [counts]. Human-to-human agreement and model repeatability: [counts/denominators].
- Staff feedback or proposed action: [actual feedback/action, or “not yet collected”].
- Follow-up observation: [actual result with comparable scope, or “not yet collected”].

Photos supply context; the app does not estimate food mass from images. Daily totals cannot identify a particular dish as the cause. Sample data is labelled and excluded from claims about field results. A short pilot does not establish sustained waste reduction or causality. No forecast, emissions savings, or monetary savings are claimed.

## Tools and credits

AI assistance used: **OpenAI Codex** for implementation and documentation, and **Claude** for the earlier idea and scope discussion. [Add any other AI tools actually used and revise descriptions as needed.]

The build uses open-source dependencies credited in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), including React, Vite, TypeScript, Lucide, and the AWS SDK. Photos and menu/notice content: [name the source and confirm permission; anonymise if appropriate]. Original project code licence: [owner's selected licence; add the licence file if choosing one].

## Final submission check

- Public repository opens without signing in, and its history reflects the event work.
- Source code, third-party credits, and an appropriate original-code licence decision are included.
- YouTube video is under three minutes and opens signed out.
- AWS is shown performing a real operation in the video.
- All placeholders are replaced; measured outcomes are backed by the recorded data.
- Submit once for the team through the hackathon's own form before its displayed deadline.
