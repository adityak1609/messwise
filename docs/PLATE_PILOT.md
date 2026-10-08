# Paired-photo Bedrock pilot

This is a feasibility pilot for visual scoring, separate from the mess's daily weight log. Start with five plates and expand to the 12–30 pairs you can collect. No model training is involved. Model scores have not been validated on this mess until the real evaluation is completed.

## Collect a pair

In **Plate pilot**, choose **Add plate pair**. Record the date, meal, and 1–8 dishes actually served on that plate. Upload one photo before eating and one after eating: JPEG, PNG, or WebP, up to 3 MiB each. Use the same plate, angle, and lighting; keep each dish visible. Collect pairs without seconds, spills, or transfers when possible. If the original serving cannot be compared, use "cannot assess" during review. Notes record complications; they do not turn an incomparable pair into a measurement.

For 5–11 October 2026, the linked Tikmit Food Court 2 menu supplies dish choices by date and meal. Select only what the volunteer actually received; alternatives such as "Boiled Egg / Banana" appear as separate choices. No dishes are selected automatically. Type replacements in the dish list if service differed. The snapshot covers that exact week and is not reused on later dates.

Use consenting volunteers' photos without identifying faces. Student feedback is optional and describes the student's stated reason. The model receives only the two images and dish identifiers/names. It receives no human ratings, student feedback, free-text collection notes, or previous model output.

Each before/after pair is one plate observation. Two photos are not two plates. Multiple dishes on one plate and repeated volunteers are related observations. The small sample cannot rank dishes for the whole mess or establish a waste-reduction effect.

## Collect independent human ratings

Reviewer A rates every dish and saves. Hand the review to a different person for reviewer B; A's scores are hidden on B's form. Use distinct names or aliases. Both reviews must be saved before Bedrock can run, and saved scores are locked. The operator can export data, so this is a collection protocol rather than access-enforced research blinding. Neither reviewer should inspect exported or earlier ratings before submitting their own.

Use this visual rubric for the fraction of the original serving remaining:

| Score | Meaning |
| --- | --- |
| 0% | None remains. |
| 25% | About one quarter remains. |
| 50% | About half remains. |
| 75% | About three quarters remain. |
| 100% | About the whole original serving remains. |
| Cannot assess | Dish missing, mixed beyond separation, obscured, or photos/servings incomparable. |

The percentages describe coarse visual estimates, not measured mass. A model score can be wrong even when it repeats itself.

## Run the model

Local mode supports paired-photo storage and human review. It produces no model scores. Configure and sign in to the AWS workspace to run **Amazon Nova Lite** through Amazon Bedrock. The stack uses `amazon.nova-lite-v1:0`, temperature 0, and prompt version `plate-quarter-v1`. `BedrockRegion` defaults to `us-east-1`; images are processed there even when the rest of the stack is in another region. Check the [AWS model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html) for availability.

Device and AWS workspaces have separate records. There is no automatic migration of local pairs. Use local mode to practice the collection/review flow, and collect your actual Bedrock evaluation in the AWS workspace after deployment.

Each click requests one run. A second click repeats the same model, prompt, dish list, and saved photos without supplying the first result. At most two valid runs are saved per pair, with at most four scoring attempts including failures. Conditional writes prevent simultaneous clicks from creating duplicate runs. Invalid/truncated model JSON is refused, and failures preserve human reviews. Reload after a timed-out request before retrying: the first request may have completed on AWS.

Scoring records the model ID, prompt version, timestamp, AWS request ID, and token usage. Logs record invocation metadata, not image bytes, human names, or comments. Bedrock invocation charges use your account's applicable credits; [AWS documents Bedrock playground usage as consuming Free Tier credits](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans-activities.html). No calls occur merely by opening the pilot view.

## Report the evaluation

The table reports model run 1 vs each human, human A vs B, and run 1 vs run 2. Run 1 is fixed in advance; selecting the better run would bias the comparison.

- **Plates n:** pairs available for that comparison.
- **Exact agreement:** matching numeric scores / assessable dish comparisons.
- **Within 25 points:** numeric scores no more than one bin apart / assessable dish comparisons.
- **Unassessable / eligible:** dish comparisons excluded because either side cannot assess, out of all eligible dish comparisons.

Two "cannot assess" answers stay in the excluded count and are not presented as successful numeric agreement. Show counts alongside percentages, report the human-to-human comparison, and retain unclear observations. The second model run measures repeatability, not accuracy. These descriptive figures are not a population estimate.

The sample-observation table lists dishes alphabetically: "some left on k of m assessable plates", based on run 1, with unclear cases listed separately. It does not attribute the daily waste kilograms to a dish. The actual reasons come from students' feedback and staff discussion.

**Export pilot** downloads the raw pairs, human reviews, and run provenance as JSON. Photo files remain separate. Saved pair inputs are fixed to make repeatability comparable; remove and recreate a pair if its input metadata was wrong. Removing a pair retains photo objects in browser/cloud storage.

## Research basis

[Ni et al.'s 2025 conference abstract](https://nsa-2025.p.asnevents.com.au/days/2025-12-04/abstract/129505) evaluated 1,763 hospital plates using human photo ratings, a seven-point scale, standard serving sizes, and weighed leftovers. [Parent et al. (2012)](https://experts.mcmaster.ca/scholarly-works/657546) compared human digital-image and on-site assessments across 551 plates. They motivate a photo-rating workflow; neither validates Bedrock or this five-bin mess pilot. The five-bin rubric here is an adaptation, not a replication of those studies.
