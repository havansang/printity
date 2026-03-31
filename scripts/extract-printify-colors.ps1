param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [ValidateSet('json', 'csv')]
    [string]$Format = 'json',

    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

function Convert-RgbToHex {
    param(
        [int]$Red,
        [int]$Green,
        [int]$Blue
    )

    return ('#{0:X2}{1:X2}{2:X2}' -f $Red, $Green, $Blue)
}

$text = Get-Content -LiteralPath $InputPath -Raw

# Each color row in the copied Printify HTML contains:
# - a <li> with background-color: rgb(...)
# - an optional background-image URL
# - a following <span class="label with-color">...</span>
$pattern = '<li[^>]*style="[^"]*background-color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\);(?:\s*background-image:\s*url\(&quot;([^&]+)&quot;\);)?[^"]*"[^>]*></li>.*?<span[^>]*class="label with-color">\s*(.*?)\s*</span>'
$matches = [regex]::Matches(
    $text,
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$colors = foreach ($match in $matches) {
    $red = [int]$match.Groups[1].Value
    $green = [int]$match.Groups[2].Value
    $blue = [int]$match.Groups[3].Value

    [pscustomobject]@{
        label = $match.Groups[5].Value.Trim()
        rgb = "rgb($red,$green,$blue)"
        hex = Convert-RgbToHex -Red $red -Green $green -Blue $blue
        imageUrl = $match.Groups[4].Value
    }
}

if ($Format -eq 'csv') {
    $content = $colors | ConvertTo-Csv -NoTypeInformation
} else {
    $content = $colors | ConvertTo-Json -Depth 3
}

if ($OutputPath) {
    $content | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Output "Saved $($colors.Count) colors to $OutputPath"
} else {
    $content
}
