# Deploy MessWise on AWS

This guide turns the local app into an AWS-backed app. The console route below works with website sign-in and needs no AWS access keys on your laptop. Choose one AWS region and use it for every backend resource. The files have been prepared locally; they do not create resources until you deploy them.

## Let the coding assistant deploy

AWS CLI v2.32.0 and newer support [browser login using your existing AWS console account](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html). On Windows, run `./scripts/Connect-Aws.ps1` from the project folder and complete sign-in in your browser. The helper uses an installed CLI or the official portable CLI prepared under `.tools/awscli/portable`. Its default region is `us-east-1`; select the account intended for this project.

The helper creates a separate `messwise` profile, keeps its temporary login/configuration under the Git-ignored `.tools/aws-session` directory, and verifies the selected identity. It does not request long-term access keys or overwrite the computer's default AWS profile. Authentication requires your browser interaction. After successful sign-in, the assistant can use that profile to deploy the prepared packages, configure the frontend, and set up hosting. A successful login alone does not deploy anything.

After sign-in, `node scripts/deploy-aws.mjs` deploys the prepared console template through the CLI, configures `.env.local`, rebuilds the frontend, uploads it to Amplify, and sets API/photo CORS to the hosted origin. It uses only the event's `messwise` profile. Deployment state and public app identifiers are saved in the ignored `.artifacts/aws/deployment-state.json`; temporary upload URLs stay in memory. The script refuses a saved deployment from another account/region and refuses to modify existing buckets, stacks, or hosting apps without this project's tag. It never deletes cloud resources automatically. After hosting, create a pilot user and verify authenticated save/read/photos and real Bedrock scoring; a successful HTTP page check does not establish those flows.

## Website-only deployment

### 1. Upload the API package to S3

Run `npm run package:aws` to build the frontend and generate `.artifacts/aws/`. The folder contains a Lambda ZIP named `messwise-api-<hash>.zip`, `stack-console.json`, `messwise-web.zip`, and `manifest.json`. The manifest states the current API ZIP filename. All Lambda dependencies are bundled, with licence notices included.

In the AWS console, select your chosen region. In S3, create a general-purpose bucket with a unique name such as `messwise-code-YOUR_UNIQUE_SUFFIX`. Keep Block Public Access on and default encryption enabled. Upload the `messwise-api-<hash>.zip` at the bucket root. Record the bucket name and exact ZIP filename. This is the code package bucket; the stack creates a separate private bucket for photos. [AWS SAM requires the code bucket to be in the function's region](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-functioncode.html).

### 2. Create the CloudFormation stack

Open CloudFormation in the same region, choose **Create stack → With new resources (standard)**, then **Upload a template file** and select `.artifacts/aws/stack-console.json`.

Use stack name `messwise-pilot` and set:

| Parameter | Value |
| --- | --- |
| `CodeBucket` | The S3 code bucket you just created. |
| `CodeKey` | Exact uploaded API ZIP filename; the generated default matches this build. |
| `AllowedOrigin` | `http://127.0.0.1:5173` for the first local check. |
| `EnablePlateScoring` | `true` to enable the optional Bedrock pilot, or `false` for the daily tracker alone. |
| `BedrockRegion` | Default `us-east-1`, where Nova Lite supports in-region inference. This is where plate images are processed. |

Leave optional settings at their defaults. Review the resources, acknowledge IAM resource creation and the SAM transform if prompted, and create the stack. Wait for `CREATE_COMPLETE`; if it fails, inspect the first failure in **Events** before retrying. The stack creates Cognito, API Gateway, Lambda, DynamoDB, private S3 photo storage, and CloudWatch logging.

Open the stack's **Outputs** tab. Keep `ApiUrl`, `ClientId`, `Region`, and `UserPoolId`. These are public app identifiers and can be shared with your coding assistant to configure the app. Do not share passwords or access keys.

The Lambda role grants only `bedrock:InvokeModel` for the Nova Lite foundation model in `BedrockRegion`. The frontend never holds AWS service credentials. The paired-photo endpoint reads owned photos from private S3 and sends the two images to Bedrock. The stack's region and S3 code/photo buckets still stay together; only the model endpoint can use a different region. [AWS's Nova Lite model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html) lists supported modalities and in-region availability.

### 3. Create a pilot login and connect the app

Follow **Create the pilot login** and **Connect the frontend** below using these outputs. Start with a disposable test entry, then verify save, refresh, and photo retrieval. The app handles the first-login temporary-password challenge.

### 4. Upload the frontend to Amplify

After configuring `.env.local`, rerun `npm run package:aws`. This is necessary to embed the actual API identifiers in the frontend. The archive generated before configuration supports local/sample mode only.

In Amplify choose **Create new app → Deploy without Git → Drag and drop**. Upload `.artifacts/aws/messwise-web.zip`, with app name `messwise` and branch `pilot`. The archive already has `index.html` at its root, as required by [AWS's manual deployment instructions](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html).

Copy the resulting HTTPS origin without a path or trailing slash. In CloudFormation select the existing stack, choose **Update stack → Use current template**, change only `AllowedOrigin` to this origin, and submit the update after reviewing it. This updates API and photo CORS. After `UPDATE_COMPLETE`, test sign-in, save, refresh, and photos on the hosted URL. Localhost will no longer be allowed by this stack's CORS configuration.

For a backend change, upload the newly generated hash-named API ZIP to the code bucket and update `CodeKey` in the existing stack. If the infrastructure template changed too, upload the new `stack-console.json` while updating, preserving the chosen region, code bucket, and hosted `AllowedOrigin`. For frontend changes, rebuild and upload the new web ZIP to the Amplify branch.

## Alternative: CLI deployment

### 1. Prepare the tools and account

Install Node.js 22 or later, the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), and the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html). Open a new terminal after installation.

Use your existing AWS CLI authentication method. If the account uses IAM Identity Center, follow [AWS's SSO profile setup](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html). Do not paste credentials into the app or repository.

```powershell
aws --version
sam --version
aws sts get-caller-identity
npm install
npm --prefix backend install
```

Check that the identity is the account you intend to use. If using a named profile, use that profile consistently for CLI and SAM commands. Review your account's [Free Tier and credit eligibility](https://aws.amazon.com/free/) before deploying; credits and a small pilot do not guarantee zero cost.

### 2. Deploy the API and storage

Run these as separate commands in the project root:

```powershell
sam build -t infra/template.yaml
sam deploy --guided
```

During [SAM's guided deployment](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-deploy.html):

- Set a stack name such as `messwise-pilot`.
- Explicitly select your intended AWS region.
- Set `AllowedOrigin` to `http://127.0.0.1:5173` for the first local integration check. Use the exact origin Vite prints if its port differs.
- Review the changeset and requested IAM resource creation.
- Save the configuration if you want to reuse these choices.

SAM provisions an HTTP API, Lambda function, DynamoDB table, private photo bucket, Cognito user pool/client, and logging resources. Record the outputs from CloudFormation/SAM: API endpoint, AWS region, Cognito client ID, and user pool ID. The region is the region you selected; output names are defined at the end of `infra/template.yaml`.

## Create the pilot login

In the Cognito console, open the user pool created by the stack. Under Users, create a user with your email address and a temporary password that meets the pool policy. Mark the email verified if the console requires it for email sign-in. Choose not to send an invitation if you are creating your own test login.

Sign in from the app using that email and temporary password, then follow its prompt to set a new password. The app handles Cognito's first-login password challenge. See [AWS's administrator-created user instructions](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-create-user-accounts.html). Self-service registration is disabled. Do not display passwords, tokens, or credentials in the demo.

## Connect the frontend

Copy `.env.example` to `.env.local`. Set the values from the deployment:

```dotenv
VITE_API_URL=https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com
VITE_COGNITO_CLIENT_ID=YOUR_COGNITO_APP_CLIENT_ID
VITE_AWS_REGION=YOUR_CHOSEN_REGION
```

These are public application identifiers, not secrets. Use the API endpoint output exactly; do not add a stage path unless the output contains one. Restart `npm run dev`, sign in, and save a test record. Refresh and verify that the record loads from AWS. Local browser records and the cloud account's records are separate; do not assume that configuring AWS migrates existing local records.

Upload a small photo and confirm it still loads after refresh. In the AWS console, verify the record in DynamoDB and the corresponding object in the private S3 bucket. Verify a recent Lambda invocation in CloudWatch. A health response alone is not evidence that an authenticated write succeeded.

## Host the frontend with Amplify (CLI backend)

Run `npm run build` after setting the AWS environment values. For a manual deployment, the build happens locally; changing an Amplify environment variable afterwards will not alter an already-built bundle.

In Amplify Hosting, create an app with the manual/without-Git option. Zip the **contents** of `dist` so `index.html` is at the archive root, then upload it. Follow [AWS's manual deployment instructions](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html).

Copy the resulting HTTPS origin, without a trailing slash or path. Run `sam deploy --guided` again using the same stack, account, and region, and set `AllowedOrigin` to that exact hosted origin. This updates the API and photo-bucket CORS configuration. Do not use `*` as a shortcut. Test sign-in, save, refresh, and photo retrieval on the hosted URL. The localhost origin will no longer be allowed after this change.

For subsequent frontend edits, rebuild and upload a new archive. For backend/template edits, rerun `sam build -t infra/template.yaml` before deploying.

## API contract

All routes, including `GET /health`, require a Cognito bearer token.

| Route | Purpose |
| --- | --- |
| `GET /health` | Service health; no records or photos. |
| `GET /records` | List the signed-in user's records. |
| `PUT /records/{id}` | Validate and create/update a record. |
| `DELETE /records/{id}` | Delete a record. |
| `POST /uploads` | Accept `{name, mimeType, sizeBytes}`; return `{key, uploadUrl, fields}` for a signed S3 form upload. |
| `GET /photos?key=...` | Obtain a short-lived signed URL for an owned photo. |
| `GET /plate-pairs` | List the signed-in user's paired-photo pilot records. |
| `PUT /plate-pairs/{id}` | Create a pair or append a locked independent human review. Client-supplied model scores are never trusted. |
| `POST /plate-pairs/{id}/score` | Run one Bedrock comparison after both human reviews; up to two saved runs and four attempts per pair. |
| `DELETE /plate-pairs/{id}` | Remove the pair and evaluation ratings; private photos remain in storage. |

Photo upload is a multipart POST containing the returned fields and file, not a raw PUT. Keep only the object key in the record, not an expiring signed URL.

## Check the optional Bedrock pilot

In Amazon Bedrock, switch to `BedrockRegion` (default `us-east-1`). In the Chat / Text playground select **Amazon Nova Lite**, and verify one small image prompt succeeds under your account before relying on it in the video. Amazon models do not require an AWS Marketplace subscription; account/role permissions and regional availability still apply. See [AWS model-access documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html). Use the foundation model `amazon.nova-lite-v1:0` directly in the configured in-region endpoint; this template does not grant cross-region inference-profile permissions.

In the hosted AWS workspace, open **Plate pilot**, add a real before/after pair and its dish list, and have two different people save their ratings. Run scoring once, then repeat once. Verify results remain after reload, and show a CloudWatch log with `status: scored`, model ID, prompt version, and token usage. These logs contain no images, human aliases, or student comments. Human reviews remain available if scoring fails. A locally simulated test is not evidence that Bedrock inference worked in your account.

When updating an already-deployed stack for this feature, upload the **new** Lambda ZIP and the **new** `stack-console.json`; update `CodeKey` to the new filename and preserve the hosted `AllowedOrigin`. The old API ZIP/template does not contain the pilot routes or Bedrock permission. Rebuild/upload the Amplify ZIP too. Follow the [pilot collection guide](PLATE_PILOT.md) for the small evaluation.

## Before recording

Verify a complete save/read/photo flow in the intended account. Keep the DynamoDB record and CloudWatch invocation ready to show alongside the app. Record only the minimum AWS console area needed to demonstrate the operation.

A local demo or an AWS architecture diagram alone does not satisfy the event's requirement to show AWS working. The [demo script](THREE_MINUTE_DEMO.md) reserves time for that evidence.

## Cleanup after the pilot

Export needed records and retain original photos before cleanup. DynamoDB, the photo bucket, and Cognito have `Retain` policies so deleting the CloudFormation stack does not erase your pilot data. Delete these retained resources separately when you no longer need them; empty the photo bucket before deleting it. Also remove the Amplify app and the separate S3 code bucket if they are no longer needed. Deleting an entry removes its record; its private cloud photo objects remain in S3. A small pilot is designed for low usage, but retained resources can continue to incur charges under your account's plan.
