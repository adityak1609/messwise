# MessWise demo: target 2 minutes 45 seconds

Use a deployed AWS workspace and real, permitted mess data. Prepare a pair with both human reviews already saved, and another pair with both model runs completed. Keep the sample labels and real n visible. Rehearse actual inference latency so the final video stays under three minutes.

**Current access status, 11 October 2026:** AWS hosting, authenticated storage, photo retrieval, and human reviews passed the live checks. Bedrock inference is blocked with `ValidationException: Operation not allowed`. Use the scoring script below only after a successful real inference. If access remains blocked, use this 2:45 alternative:

| Time | Show | Suggested narration |
| --- | --- | --- |
| 0:00–0:15 | Mess waste notice and dashboard | The mess already measures waste. MessWise keeps that evidence beside the menu and a follow-up action. |
| 0:15–0:50 | Save a real entry in AWS mode and refresh | This is the published weight, its scope, meal coverage, and source photo. Attendance is optional. |
| 0:50–1:20 | Weekly menu and a real paired-photo observation | The dated menu helps record what was served. Photos add context without inventing waste kilograms. |
| 1:20–1:45 | Two saved independent human reviews | We score the visual fraction remaining in quarter steps and mark unclear dishes as cannot assess. AI scoring is implemented, but AWS account access is still blocked; no model result is claimed. |
| 1:45–2:20 | DynamoDB entry, private S3 object, and Lambda invocation in CloudWatch | The app authenticates with Cognito and stores records and photos on AWS. These are the real saved record and request log. |
| 2:20–2:45 | Action, follow-up status, and public repository | Record an action to try and compare later measurements. Any reduction claim still needs field evidence. |

Use only collected observations and genuine feedback in either script. If a feature has no real pilot evidence, demonstrate its workflow without claiming an outcome.

| Time | Show | Suggested narration |
| --- | --- | --- |
| 0:00–0:15 | Published waste notice and dashboard | Our mess already publishes daily waste kilograms. MessWise connects that number to its menu, evidence, and a follow-up action. |
| 0:15–0:40 | Save a real daily entry in AWS mode; refresh | We record the published weight and what it covers. Attendance stays optional. |
| 0:40–1:05 | Plate pilot: before/after images, dish list, two locked human reviews | Two people independently score the original serving left in quarter steps. Ratings are saved before the model; unclear dishes can be marked cannot assess. |
| 1:05–1:35 | Run Bedrock scoring on the prepared pair; show the returned result | Lambda sends the paired images and dish names to Nova Lite on Bedrock. Human scores and student feedback are withheld. Daily kilograms still come from the mess notice. |
| 1:35–2:00 | Pilot comparison table and the prepared repeated pair | Here are actual plate and dish-rating counts, exact agreement, agreement within one step, and excluded cases. The second run checks repeatability. Dishes on one plate are related observations. |
| 2:00–2:30 | DynamoDB saved entry/pair and CloudWatch scored request metadata | These records are persisted in DynamoDB. This log shows a real Bedrock request, its model and prompt version, and token usage. Photos are private in S3. |
| 2:30–2:45 | Action status and repository link | Students' comments help explain leftovers. Staff can record an action to try and review later measurements. Sustained waste reduction remains to be measured. |

Only show evaluation numbers collected from the real pilot. Resolve model access and deployment before recording. Show the actual returned result and scored CloudWatch log; a health check or architecture diagram does not demonstrate inference. Show saved human reviews and explain the collection order instead of typing both during the video.

Record the smallest console areas needed to show AWS working. Exclude credentials and identifying faces, verify readability on a phone, upload to YouTube as public or unlisted, and open the final link signed out. Submit the repository, video, and verified writeup through the event's own form before its displayed deadline.
