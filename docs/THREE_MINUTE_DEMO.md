# MessWise demo - target 2 minutes 40 seconds

Team: **crypto_knights**. Demonstrate the working AWS tracker and the available field observations. Bedrock troubleshooting is outside this final demo; no successful inference or AI evaluation has been verified.

## Prepare before recording

- Open [MessWise](https://pilot.d3b3z2kcn310jh.amplifyapp.com), complete sign-in in **Data & AWS**, and open the private AWS workspace. Complete any first-login password change before recording. Use the administrator-provided login; credentials are not in the repository.
- Check the dashboard shows seven daily records totalling 603 kg and that Thursday's record contains the two post-meal photos. Sample mode contains fictional examples and must not be presented as field evidence.
- Obtain the photo providers' permission if showing the images publicly. If permission is unavailable, demonstrate the workflow without displaying their images and revise the narration accordingly.
- Open these tabs **before recording**, in this order. Use **N. Virginia (`us-east-1`)** for the AWS console. During the demo, switch to the prepared tabs at the times below instead of navigating through the console.
  1. **MessWise**, signed in to the AWS workspace, on Overview.
  2. **DynamoDB**: [open the console](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1) → Tables → `messwise-pilot-RecordsTable-KLUR6OG9140K` → Explore table items. Open the item whose `sk` is `RECORD#ca2110a1-7307-49c7-af4e-da1f2652e0eb` and expand `record`. Have `date: 2026-10-08`, `wasteKg: 87` and the two photo references visible.
  3. **S3**: [open the photos bucket](https://s3.console.aws.amazon.com/s3/buckets/messwise-pilot-photosbucket-pnc9fj65f6qr?region=us-east-1&tab=objects) → Objects → `users/` → `b478e488-b0d1-704b-3dc9-07ab4509c297/` → `430fd595-6e57-43ed-84ed-4b4bbe42e596.jpg`. Leave its object properties open; this key matches a photo reference in Thursday's DynamoDB record.
  4. **CloudWatch logs**: [open Lambda](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1) → `messwise-pilot-api` → Monitor → View CloudWatch logs. Open a recent log stream in `/aws/lambda/messwise-pilot-api`, with an invocation timestamp visible.
  5. **Public repository**: [github.com/adityak1609/messwise](https://github.com/adityak1609/messwise).
- Complete authentication beforehand and keep credentials and API keys outside the recording.

## Record

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00-0:35 | Dashboard in AWS workspace | "When food is wasted in a college mess, we also waste money, water and energy. I'm presenting MessWise from crypto_knights. It brings daily reported waste weights, menus and photo observations together, so staff can choose small changes, record actions and follow up on results. Our pilot covers one mess; other colleges could reuse this approach with their own menus and private AWS workspaces." |
| 0:35-1:00 | Open Thursday in Daily log, save without changing its reported weight, then refresh | "This workspace contains seven participant-confirmed measured daily weights, totalling 603 kilograms. Thursday's separately reported 87 kilograms has its matching menu. Waste type and meal coverage remain unconfirmed, and the app preserves that uncertainty." |
| 1:00-1:25 | Photo journal; open the two Thursday lunch images if permission is confirmed | "These are two different students' plates after lunch. They are real observations stored with the daily record. We have no original serving photos or weighed leftovers, so these images have no percentage-left scores or waste mass." |
| 1:25-1:45 | Daily record's action fields or Action plan | "The action tracker can record a change, its status and a follow-up note. Staff feedback and an intervention are the next field test; we haven't established waste reduction yet." |
| **1:45-2:00** | Switch to the prepared **DynamoDB tab**. Point to Thursday's date, 87 kg and two photo references. | "Amplify hosts the app. Cognito signs users in; API Gateway and Lambda save records in DynamoDB. Here is Thursday's saved record: 87 kilograms and two photo references." |
| **2:00-2:10** | Switch to the prepared **S3 tab**. Point to the matching photo object's key. | "The matching photo is stored privately in S3 and accessed through a signed link." |
| **2:10-2:20** | Switch to the prepared **CloudWatch logs tab**. Point to the Lambda invocation timestamp. | "Lambda handles requests. This log shows an invocation timestamp. Thirteen live API checks passed during deployment verification." |
| **2:20-2:35** | Switch back to **MessWise**. | "The core tracker is deployed and working. Optional Bedrock scoring is implemented, but account access is blocked and no AI result is claimed. Our next step is a staff-backed trial with comparable follow-up measurements." |
| **2:35-2:40** | Switch to the **public repository tab**. | "The source and credits are public. Thank you." |

Show the actual AWS save and reload. Keep the 87 kg daily figure separate from the two lunch observations. Do not enter a fictional staff agreement or completed action into the real workspace for the recording.

## Finish

Upload to YouTube as public or unlisted. Confirm the final duration is under three minutes and that its link opens in a signed-out browser. Add the link to [SUBMISSION.md](SUBMISSION.md), then submit the repository, video and writeup through the [event form](https://www.wemakedevs.org/aws/env/submit) before its displayed deadline.
