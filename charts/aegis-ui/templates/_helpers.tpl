{{/*
Expand the name of the chart.
*/}}
{{- define "aegis-ui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "aegis-ui.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "aegis-ui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "aegis-ui.labels" -}}
helm.sh/chart: {{ include "aegis-ui.chart" . }}
{{ include "aegis-ui.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "aegis-ui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aegis-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "aegis-ui.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "aegis-ui.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Keycloak issuer URL (derived from baseUrl and realm if not explicitly set)
*/}}
{{- define "aegis-ui.keycloak.issuer" -}}
{{- if .Values.keycloak.issuer -}}
{{- .Values.keycloak.issuer -}}
{{- else -}}
{{- printf "%s/realms/%s" .Values.keycloak.baseUrl .Values.keycloak.realm -}}
{{- end -}}
{{- end -}}

{{/*
Keycloak metadata URL (OIDC discovery endpoint)
*/}}
{{- define "aegis-ui.keycloak.metadataUrl" -}}
{{- if .Values.keycloak.metadataUrl -}}
{{- .Values.keycloak.metadataUrl -}}
{{- else -}}
{{- printf "%s/realms/%s/.well-known/openid-configuration" .Values.keycloak.baseUrl .Values.keycloak.realm -}}
{{- end -}}
{{- end -}}

{{/*
Keycloak JWKS URL
*/}}
{{- define "aegis-ui.keycloak.jwksUrl" -}}
{{- if .Values.keycloak.jwksUrl -}}
{{- .Values.keycloak.jwksUrl -}}
{{- else -}}
{{- printf "%s/realms/%s/protocol/openid-connect/certs" .Values.keycloak.baseUrl .Values.keycloak.realm -}}
{{- end -}}
{{- end -}}

{{/*
Secret name for aegis-ui credentials
*/}}
{{- define "aegis-ui.secretName" -}}
{{- printf "%s-secret" (include "aegis-ui.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
