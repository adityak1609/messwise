# MessWise

**Team:** crypto_knights (solo entrant)

**Track:** Waste and Energy

**Repository:** https://github.com/adityak1609/messwise

**Application:** https://pilot.d3b3z2kcn310jh.amplifyapp.com

**YouTube demo:** Pending; add the public or unlisted video URL before submitting.

## Problem and build

Our campus mess publishes food-waste weights, but daily numbers are hard to connect to menus, supporting observations and follow-up actions. MessWise keeps that information together so staff can review records and track changes they choose to try.

During Environmental Hacks, 8-11 October 2026, we built a React and TypeScript app with a daily waste log, dashboard, dated menus, photo journal, action/status/follow-up tracker and JSON exports. Separate sample, device-local and private AWS workspaces support exploration and actual recordkeeping. The Food Court 2 menu for 5-11 October is a dated [TikMenu snapshot](https://tikmit.com/week/full?id=2026-10-05_to_2026-10-11), with source credit retained.

## AWS

Amplify hosts the frontend. Cognito authenticates the private workspace; API Gateway calls Lambda; DynamoDB stores records; and private S3 storage serves photos through signed access. The deployment uses us-east-1.

Thirteen live API checks passed on 11 October, covering authentication, save/reload, private photos, user isolation and paired-photo reviews. Disposable technical test data was removed. The real records were saved and reloaded, and both real image files were retrieved unchanged from AWS.

Optional paired-photo review and Bedrock scoring are implemented, but Nova Lite inference is blocked on this account with NOT_AUTHORIZED / Operation not allowed. No successful AI analysis or model accuracy is claimed. The daily tracker and photo journal are the working core.

## Evidence and limits

The private workspace contains seven participant-confirmed measured daily weights for 5-11 October: **603 kg total**, **86.1 kg/day**. The source is a participant-supplied weekly table; the original mess notice/register has not been attached. Waste composition and covered meals remain unconfirmed.

Two after-eating photos from different students' Thursday lunch plates are attached to the 8 October record. Its **87 kg** is a separately reported daily total. The photos provide context; original servings and plate weights were not supplied, so no percentage-left scores or mass estimates are assigned.

Distinct-student counts and source percentages remain notes rather than verified meal-serving or cooked-food metrics. No paired-photo field evaluation, staff adoption, agreed intervention or measured waste reduction has been established.

## Credits

AI tools used: **OpenAI Codex** for planning, implementation, documentation and verification; **Claude** for idea comparison and scope planning; **Amazon Q Developer** for AWS setup/troubleshooting advice.

Dependencies and licences are credited in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Menu credit: Aadit Agrawal's TikMenu/fc-menu project. Daily weights and student photos were supplied by the mess participant. Original photo files remain private and are not in the public repository.

---

Before submitting: add the YouTube URL, confirm the photo providers' permission if showing their images publicly, and keep this writeup aligned with the recorded demo. Submit the repository, video and writeup through the [event form](https://www.wemakedevs.org/aws/env/submit) before its displayed deadline. The video must be under three minutes, public or unlisted, open signed out, and show AWS performing a real operation.
