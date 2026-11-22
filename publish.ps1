# Publish this repository to GitHub.
#
#   pwsh -File publish.ps1                      # asks for a token in this terminal
#   $env:GITHUB_TOKEN = 'ghp_...'; pwsh -File publish.ps1
#
# The token needs the `repo` scope (fine-grained tokens: Contents + Administration
# read/write for the target account). It is never written to disk or printed.
# If you already use the GitHub CLI, `gh auth login` then
# `gh repo create dsh-prompt-organizer --public --source . --push` does the same.

[CmdletBinding()]
param(
  [string]$Token = $env:GITHUB_TOKEN,
  [string]$Name = 'dsh-prompt-organizer',
  [string]$Description = 'Prompt Organizer for DeepSeek Harness: fragmented notes in, researched brief and a paste-ready prompt / project plan out.',
  [switch]$Private
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path (Join-Path $root '.git'))) {
  throw 'Run this inside the repository (no .git directory here).'
}

if (-not $Token) {
  $secure = Read-Host -AsSecureString 'GitHub personal access token (repo scope)'
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if ([string]::IsNullOrWhiteSpace($Token)) { throw 'A token is required.' }

$headers = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'dsh-prompt-organizer'
}

$me = Invoke-RestMethod -Method Get -Uri 'https://api.github.com/user' -Headers $headers
$login = $me.login
Write-Host "Signed in as $login"

$body = @{
  name        = $Name
  description = $Description
  private     = [bool]$Private
  has_issues  = $true
} | ConvertTo-Json

try {
  $repo = Invoke-RestMethod -Method Post -Uri 'https://api.github.com/user/repos' -Headers $headers -Body $body -ContentType 'application/json'
  Write-Host "Created $($repo.html_url)"
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 422) { Write-Host 'Repository already exists; pushing into it.' }
  else { throw }
}

$remote = "https://github.com/$login/$Name.git"
git remote remove origin 2>$null
git remote add origin $remote

# The helper reads the secret from the environment, so it never appears in the
# remote URL, the command line, or git's error output.
$env:PO_GIT_USER = $login
$env:PO_GIT_TOKEN = $Token
git -c 'credential.helper=!f() { echo username=$PO_GIT_USER; echo password=$PO_GIT_TOKEN; }; f' push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'git push failed.' }

Remove-Item Env:PO_GIT_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:PO_GIT_USER -ErrorAction SilentlyContinue
Write-Host "Published: https://github.com/$login/$Name"
