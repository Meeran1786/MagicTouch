# MagicTouch local server for Windows (no installs needed). Serves this folder at http://localhost:8080/
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript';'.wasm'='application/wasm';'.data'='application/octet-stream';'.tflite'='application/octet-stream';'.binarypb'='application/octet-stream';'.png'='image/png';'.json'='application/json';'.css'='text/css';'.svg'='image/svg+xml';'.jpg'='image/jpeg';'.mp3'='audio/mpeg'}
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8080/')
$l.Start()
Write-Host 'MagicTouch running at http://localhost:8080/  (keep this window open)'
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($p -eq '/' -or $p -eq '/poc') { $ctx.Response.Redirect('/poc/'); $ctx.Response.Close(); continue }
  if ($p.EndsWith('/')) { $p = $p + 'index.html' }
  $f = [IO.Path]::GetFullPath((Join-Path $root $p.TrimStart('/')))
  if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
    $b = [IO.File]::ReadAllBytes($f)
    $ext = [IO.Path]::GetExtension($f).ToLower()
    $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $ctx.Response.ContentLength64 = $b.Length
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
