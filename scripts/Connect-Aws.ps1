param(
    [string]$Region = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$portablePath = Join-Path $workspacePath '.tools\awscli\portable'
$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCommand) {
    $awsCliPath = $awsCommand.Source
} elseif (Test-Path -LiteralPath $portablePath) {
    $awsCliPath = (Get-ChildItem -LiteralPath $portablePath -Recurse -File -Filter aws.exe | Select-Object -First 1).FullName
}
if (-not $awsCliPath) { throw 'Install the official AWS CLI v2 (2.32.0 or newer), then run this script again.' }

# Keep this event's configuration and temporary session outside Git and separate
# from any existing AWS profiles on the computer. No access keys are requested.
$sessionPath = Join-Path $workspacePath '.tools\aws-session'
New-Item -ItemType Directory -Path $sessionPath -Force | Out-Null
$env:AWS_CONFIG_FILE = Join-Path $sessionPath 'config'
$env:AWS_SHARED_CREDENTIALS_FILE = Join-Path $sessionPath 'credentials'
$env:AWS_LOGIN_CACHE_DIRECTORY = Join-Path $sessionPath 'login-cache'
$env:AWS_PROFILE = 'messwise'
$env:AWS_PAGER = ''
$env:AWS_CLI_AUTO_PROMPT = 'off'

Write-Host 'Complete the AWS sign-in in your browser. Choose the account where you want MessWise deployed.'
& $awsCliPath login --profile messwise --region $Region --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'AWS login did not complete. No resources have been deployed.' }
& $awsCliPath configure set region $Region --profile messwise
if ($LASTEXITCODE -ne 0) { throw 'Could not save the selected deployment region.' }
& $awsCliPath sts get-caller-identity --profile messwise --region $Region --query '{Account:Account,Arn:Arn}' --output json --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'The sign-in session could not be verified.' }
Write-Host 'AWS session verified. Deployment can now use the messwise profile.'
