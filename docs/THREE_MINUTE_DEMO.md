# MessWise demo - target 2 minutes 40 seconds

Team: **crypto_knights**. Demonstrate the working AWS tracker and the available field observations. Bedrock troubleshooting is outside this final demo; no successful inference or AI evaluation has been verified.

## Prepare before recording

- Open [MessWise](https://pilot.d3b3z2kcn310jh.amplifyapp.com), complete sign-in in **Data & AWS**, and open the private AWS workspace. Complete any first-login password change before recording. Use the administrator-provided login; credentials are not in the repository.
- Check the dashboard shows seven daily records totalling 603 kg and that Thursday's record contains the two post-meal photos. Sample mode contains fictional examples and must not be presented as field evidence.
- Obtain the photo providers' permission if showing the images publicly. If permission is unavailable, demonstrate the workflow without displaying their images and revise the narration accordingly.
- Prepare AWS console tabs for the application's DynamoDB table, a private S3 photo object and the Lambda log group /aws/lambda/messwise-pilot-api in us-east-1.
- Complete authentication beforehand and keep credentials and API keys outside the recording.

## Record

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00-0:20 | Dashboard in AWS workspace | "I'm crypto_knights, building MessWise for campus mess food waste. The app keeps reported waste weights, dated menus, supporting observations and follow-up tracking together." |
| 0:20-0:50 | Open Thursday in Daily log, save without changing its reported weight, then refresh | "This workspace contains seven participant-confirmed measured daily weights, totalling 603 kilograms. Thursday's separately reported 87 kilograms has its matching menu. Waste type and meal coverage remain unconfirmed, and the app preserves that uncertainty." |
| 0:50-1:20 | Photo journal; open the two Thursday lunch images if permission is confirmed | "These are two different students' plates after lunch. They are real observations stored with the daily record. We have no original serving photos or weighed leftovers, so these images have no percentage-left scores or waste mass." |
| 1:20-1:40 | Daily record's action fields or Action plan | "The action tracker can record a change, its status and a follow-up note. Staff feedback and an intervention are the next field test; we haven't established waste reduction yet." |
| 1:40-2:20 | Matching saved record in DynamoDB, private S3 object and Lambda invocation/log timestamp | "Amplify hosts the app. Cognito authenticates the workspace; API Gateway and Lambda save records in DynamoDB. Photos are private in S3 with signed access. Here is the saved record and its photo storage on AWS. Thirteen live API checks passed during deployment verification." |
| 2:20-2:40 | Return to app, then public repository | "The core tracker is deployed and working. Optional Bedrock scoring is implemented, but account access is blocked and no AI result is claimed. Our next step is a staff-backed trial with comparable follow-up measurements. The source and credits are public." |

Show the actual AWS save and reload. Keep the 87 kg daily figure separate from the two lunch observations. Do not enter a fictional staff agreement or completed action into the real workspace for the recording.

## Finish

Upload to YouTube as public or unlisted. Confirm the final duration is under three minutes and that its link opens in a signed-out browser. Add the link to [SUBMISSION.md](SUBMISSION.md), then submit the repository, video and writeup through the [event form](https://www.wemakedevs.org/aws/env/submit) before its displayed deadline.
