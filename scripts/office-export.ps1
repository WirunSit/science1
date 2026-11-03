# Converts .pptx / .docx to PDF with Microsoft Office (no LibreOffice on this machine, docs/decisions.md D-002),
# then renders every PDF page to PNG with pypdfium2 for visual checks.
# Usage: powershell -File scripts/office-export.ps1 [-NoPng] <file1> [<file2> ...]
param([switch]$NoPng, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Files)

$ErrorActionPreference = 'Stop'
$ppt = $null
$word = $null
try {
  foreach ($f in $Files) {
    $full = (Resolve-Path $f).Path
    $pdf = [IO.Path]::ChangeExtension($full, '.pdf')
    if ($full.EndsWith('.pptx')) {
      if (-not $ppt) { $ppt = New-Object -ComObject PowerPoint.Application }
      # Open(FileName, ReadOnly, Untitled, WithWindow)
      $p = $ppt.Presentations.Open($full, -1, 0, 0)
      $p.SaveAs($pdf, 32)  # ppSaveAsPDF
      $p.Close()
    } elseif ($full.EndsWith('.docx')) {
      if (-not $word) { $word = New-Object -ComObject Word.Application; $word.Visible = $false }
      $d = $word.Documents.Open($full, $false, $true)
      $d.ExportAsFixedFormat($pdf, 17)  # wdExportFormatPDF
      $d.Close(0)
    }
    Write-Output "PDF: $pdf"
  }
} finally {
  if ($ppt) { $ppt.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) }
  if ($word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
}

if ($NoPng) { exit 0 }
$py = Join-Path $PSScriptRoot 'pdf-to-png.py'
foreach ($f in $Files) {
  $pdf = [IO.Path]::ChangeExtension((Resolve-Path $f).Path, '.pdf')
  python $py $pdf
}
