# MessWise demo: target 2 minutes 45 seconds

Use a deployed AWS workspace and real, permitted mess data. Prepare a pair with both human reviews already saved, and another pair with both model runs completed. Keep the sample labels and real n visible. Rehearse actual inference latency so the final video stays under three minutes.

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
