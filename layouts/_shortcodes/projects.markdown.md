{{- $section := .Get "section" | default "projects" -}}
{{- if eq $section "projects" -}}
{{- range site.Data.projects.projects }}
### [{{ .name }}](https://github.com/{{ .repo }})

{{ .role }} · {{ .language }} · {{ delimit .tags ", " }}

{{ .summary }} {{ .opinion }}
{{ with .docs }}
Documentation: {{ . }}
{{ end }}
{{- end }}
{{- else -}}
{{- range site.Data.projects.charts }}
### [{{ .org }}](https://github.com/{{ .repo }})
{{ with .role }}
{{ . }}
{{ end }}
{{- with .note }}
{{ . }}
{{ end }}
{{ $repo := .repo }}
{{- range .items }}
- [{{ .name }}](https://github.com/{{ $repo }}/tree/main/charts/{{ .name }}): {{ .summary }}
{{- end }}
{{- end }}
{{- end -}}
