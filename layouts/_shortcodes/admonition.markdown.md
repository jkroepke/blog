{{- $type := .Get "type" | default "note" -}}
{{- $title := .Get "title" | default $type -}}
{{- $inner := .Inner | strings.TrimSpace -}}
{{- $quoted := replaceRE "(?m)^" "> " $inner -}}
> **{{ $title }}**
>
{{ $quoted | safeHTML }}
