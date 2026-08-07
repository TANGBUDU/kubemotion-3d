{{- define "kubemotion.name" -}}kubemotion{{- end }}
{{- define "kubemotion.fullname" -}}{{ .Release.Name }}-kubemotion{{- end }}
{{- define "kubemotion.labels" -}}
app.kubernetes.io/name: {{ include "kubemotion.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
