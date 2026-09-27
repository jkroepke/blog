{{- $src := .Get "src" -}}
{{- $alt := .Get "alt" | default $src -}}
{{- $caption := .Get "caption" -}}
![{{ $alt }}]({{ $src }})
{{- with $caption }}

*{{ . }}*
{{- end }}
