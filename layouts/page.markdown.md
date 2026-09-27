# {{ .Title }}

{{- with .Description }}
> {{ . }}
{{- end }}

Canonical URL: {{ with .OutputFormats.Get "html" }}{{ .Permalink }}{{ end }}
{{- if not .Date.IsZero }}
Published: {{ .Date.Format "2006-01-02" }}
{{- end }}
{{- if not .Lastmod.IsZero }}
Last modified: {{ .Lastmod.Format "2006-01-02" }}
{{- end }}

{{ .RenderShortcodes | safeHTML }}
