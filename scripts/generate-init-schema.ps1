$ErrorActionPreference = "Stop"

$RootDir = (Get-Location).Path
$TypesPath = Join-Path $RootDir "src\integrations\supabase\types.ts"
$OutPath = Join-Path $RootDir "supabase\migrations\20240101000000_init_schema.sql"

$Source = Get-Content -LiteralPath $TypesPath -Raw

function Extract-ConstantsEnumsBlock {
  param([string]$Src)
  $m = [regex]::Match(
    $Src,
    'export const Constants = \{\s*public:\s*\{\s*Enums:\s*\{([\s\S]*?)\}\s*,\s*\}\s*,\s*\}\s*as const',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $m.Success) { throw "Tidak menemukan Constants.public.Enums pada types.ts" }
  return $m.Groups[1].Value
}

function Parse-EnumArrays {
  param([string]$Block)
  $enums = @{}
  $rx = [regex]::Matches(
    $Block,
    '^\s*([a-zA-Z0-9_]+)\s*:\s*\[(.*?)\]\s*,?\s*$',
    [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  foreach ($m in $rx) {
    $key = $m.Groups[1].Value
    $arrText = $m.Groups[2].Value
    $vals = [regex]::Matches($arrText, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
    $enums[$key] = @($vals)
  }
  return $enums
}

function Parse-Tables {
  param([string]$Src)
  $tables = @()
  $pattern = '^\s{6}([a-zA-Z0-9_]+):\s*\{\s*\n\s{8}Row:\s*\{\n([\s\S]*?)\n\s{8}\}\n\s{8}Insert:\s*\{\n([\s\S]*?)\n\s{8}\}\n\s{8}Update:\s*\{\n([\s\S]*?)\n\s{8}\}\n\s{8}Relationships:\s*([\s\S]*?)\n\s{6}\}\n'
  $matches = [regex]::Matches(
    $Src,
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  foreach ($m in $matches) {
    $tables += [pscustomobject]@{
      Name = $m.Groups[1].Value
      RowBlock = $m.Groups[2].Value
      InsertBlock = $m.Groups[3].Value
      UpdateBlock = $m.Groups[4].Value
      Relationships = $m.Groups[5].Value.Trim()
    }
  }
  if ($tables.Count -eq 0) { throw "Tidak menemukan definisi Tables pada types.ts" }
  return $tables
}

function Parse-RowColumns {
  param([string]$RowBlock)
  $cols = @()
  foreach ($line in ($RowBlock -split "`n")) {
    $t = $line.Trim()
    if (-not $t) { continue }
    $m = [regex]::Match($t, '^([a-zA-Z0-9_]+):\s*(.+)$')
    if (-not $m.Success) { continue }
    $cols += [pscustomobject]@{
      Col = $m.Groups[1].Value
      TypeExpr = $m.Groups[2].Value.Trim()
    }
  }
  return $cols
}

function Detect-OptionalInsertCols {
  param([string]$InsertBlock)
  $optional = New-Object "System.Collections.Generic.HashSet[string]"
  foreach ($line in ($InsertBlock -split "`n")) {
    $t = $line.Trim()
    if (-not $t) { continue }
    $m = [regex]::Match($t, '^([a-zA-Z0-9_]+)\?:')
    if ($m.Success) { [void]$optional.Add($m.Groups[1].Value) }
  }
  return $optional
}

function Parse-Relationships {
  param([string]$RelBlock)
  $rels = @()
  $block = $RelBlock.Trim()
  if (-not $block.StartsWith("[")) { return $rels }
  $itemRe = [regex]::Matches(
    $block,
    '\{\s*foreignKeyName:\s*"([^"]+)"[\s\S]*?columns:\s*\[([^\]]*)\][\s\S]*?referencedRelation:\s*"([^"]+)"[\s\S]*?referencedColumns:\s*\[([^\]]*)\][\s\S]*?\}',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  foreach ($m in $itemRe) {
    $fkName = $m.Groups[1].Value
    $colsRaw = $m.Groups[2].Value
    $refRel = $m.Groups[3].Value
    $refColsRaw = $m.Groups[4].Value

    $cols = $colsRaw -split "," | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ }
    $refCols = $refColsRaw -split "," | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ }
    $rels += [pscustomobject]@{
      FkName = $fkName
      Cols = @($cols)
      RefRel = $refRel
      RefCols = @($refCols)
    }
  }
  return $rels
}

function To-Ident {
  param([string]$Name)
  return '"' + ($Name -replace '"', '""') + '"'
}

function Resolve-SqlType {
  param([string]$ColName, [string]$TypeExpr)
  $isNullable = [regex]::IsMatch($TypeExpr, '\|\s*null\b')
  $core = ($TypeExpr -replace '\s*\|\s*null\b', '').Trim()

  $enumMatch = [regex]::Match($core, 'Database\["public"\]\["Enums"\]\["([^"]+)"\]')
  if ($enumMatch.Success) { return [pscustomobject]@{ SqlType = "public.$(To-Ident $($enumMatch.Groups[1].Value))"; Nullable = $isNullable } }

  if ($core -match '\bJson\b') { return [pscustomobject]@{ SqlType = "jsonb"; Nullable = $isNullable } }
  if ($core -match '\bboolean\b') { return [pscustomobject]@{ SqlType = "boolean"; Nullable = $isNullable } }
  if ($core -match '\bnumber\b') { return [pscustomobject]@{ SqlType = "integer"; Nullable = $isNullable } }
  if ($core -match '\bstring\[\]\b') {
    $isUuidArray = ($ColName -match '_ids$') -or ($ColName -match '_id$')
    return [pscustomobject]@{ SqlType = "$(if ($isUuidArray) { 'uuid' } else { 'text' })[]"; Nullable = $isNullable }
  }

  if ($core -match '\bstring\b') {
    $isUuid = ($ColName -eq 'id') -or ($ColName -match '_id$') -or ($ColName -match '_by$') -or @('user_id', 'parent_id', 'child_id') -contains $ColName
    if ($isUuid) { return [pscustomobject]@{ SqlType = "uuid"; Nullable = $isNullable } }
    if (($ColName -match '_at$') -or @('created_at','updated_at') -contains $ColName) {
      return [pscustomobject]@{ SqlType = "timestamptz"; Nullable = $isNullable }
    }
    return [pscustomobject]@{ SqlType = "text"; Nullable = $isNullable }
  }

  return [pscustomobject]@{ SqlType = "text"; Nullable = $isNullable }
}

function Build-Sql {
  param($Enums, $Tables)

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("create extension if not exists pgcrypto;")
  $lines.Add("")

  foreach ($k in $Enums.Keys) {
    $vals = $Enums[$k] | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }
    $joined = ($vals -join ", ")
    $lines.Add(('do $$ begin create type public.' + (To-Ident $k) + ' as enum (' + $joined + '); exception when duplicate_object then null; end $$;'))
  }
  $lines.Add("")

  foreach ($t in $Tables) {
    $cols = Parse-RowColumns $t.RowBlock
    $optionalInsert = Detect-OptionalInsertCols $t.InsertBlock

    $colLines = New-Object System.Collections.Generic.List[string]
    $hasId = $false
    $idCols = @()
    foreach ($c in $cols) {
      $r = Resolve-SqlType $c.Col $c.TypeExpr
      if (
        ($t.Name -eq "academic_years") -and
        (@("odd_semester_start", "odd_semester_end", "even_semester_start", "even_semester_end") -contains $c.Col)
      ) {
        $r.SqlType = "date"
      }
      $notNull = if ($r.Nullable) { "" } else { " not null" }
      $def = ""
      if ($c.Col -eq "id") {
        $hasId = $true
        $idCols += $c.Col
        if ($optionalInsert.Contains("id")) { $def = " default gen_random_uuid()" }
      }
      if ($c.Col -eq "created_at" -and $optionalInsert.Contains("created_at")) { $def = " default now()" }
      if ($c.Col -eq "updated_at" -and $optionalInsert.Contains("updated_at")) { $def = " default now()" }
      if (
        ($t.Name -eq "academic_years") -and
        (@("odd_semester_model", "even_semester_model") -contains $c.Col)
      ) {
        $def = " default 'normal'"
      }
      $colLines.Add("$(To-Ident $c.Col) $($r.SqlType)$def$notNull")
    }
    if ($hasId) { $colLines.Add("primary key ($(To-Ident 'id'))") }

    $lines.Add("create table if not exists public.$(To-Ident $($t.Name)) (")
    $lines.Add("  " + ($colLines -join ",`n  "))
    $lines.Add(");")
    $lines.Add("")
  }

  $tableHasId = @{}
  foreach ($t in $Tables) {
    $hasId = $false
    foreach ($c in (Parse-RowColumns $t.RowBlock)) {
      if ($c.Col -eq "id") { $hasId = $true; break }
    }
    $tableHasId[$t.Name] = $hasId
  }

  $uniqueTargets = New-Object "System.Collections.Generic.HashSet[string]"
  foreach ($t in $Tables) {
    $rels = Parse-Relationships $t.Relationships
    foreach ($r in $rels) {
      $key = ($r.RefRel + "|" + (($r.RefCols | Sort-Object) -join ","))
      [void]$uniqueTargets.Add($key)
    }
  }

  foreach ($k in $uniqueTargets) {
    $parts = $k.Split("|", 2)
    $refRel = $parts[0]
    $refCols = @()
    if ($parts[1]) { $refCols = $parts[1].Split(",") | Where-Object { $_ } }
    if ($refCols.Count -eq 0) { continue }
    if (($refCols.Count -eq 1) -and ($refCols[0] -eq "id") -and ($tableHasId.ContainsKey($refRel)) -and $tableHasId[$refRel]) { continue }

    $colsSql = ($refCols | ForEach-Object { To-Ident $_ }) -join ", "
    $nameSuffix = ($refCols -join "_")
    $constraintName = "${refRel}_${nameSuffix}_key"
    $lines.Add(('do $$ begin alter table public.' + (To-Ident $refRel) + ' add constraint ' + (To-Ident $constraintName) + ' unique (' + $colsSql + '); exception when duplicate_object then null; end $$;'))
  }

  $lines.Add("")

  foreach ($t in $Tables) {
    $rels = Parse-Relationships $t.Relationships
    foreach ($r in $rels) {
      $cols = ($r.Cols | ForEach-Object { To-Ident $_ }) -join ", "
      $refCols = ($r.RefCols | ForEach-Object { To-Ident $_ }) -join ", "
      $lines.Add(('do $$ begin alter table public.' + (To-Ident $($t.Name)) + ' add constraint ' + (To-Ident $($r.FkName)) + ' foreign key (' + $cols + ') references public.' + (To-Ident $($r.RefRel)) + ' (' + $refCols + '); exception when duplicate_object then null; end $$;'))
    }
  }

  $lines.Add("")
  $lines.Add(('create or replace function public.has_role(_user_id uuid, _role public.' + (To-Ident 'app_role') + ') returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;'))
  $lines.Add("")

  return ($lines -join "`n")
}

$EnumsBlock = Extract-ConstantsEnumsBlock $Source
$Enums = Parse-EnumArrays $EnumsBlock
$Tables = Parse-Tables $Source
$Sql = Build-Sql $Enums $Tables

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutPath) | Out-Null
[System.IO.File]::WriteAllText($OutPath, $Sql, (New-Object System.Text.UTF8Encoding $false))

Write-Output ("Generated " + (Resolve-Path -LiteralPath $OutPath).Path)
