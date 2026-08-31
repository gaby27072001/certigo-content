#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 7 ]]; then
  echo "Usage: publish_blob_artifact.sh SOURCE RESOURCE_GROUP ACCOUNT CONTAINER PREFIX CACHE_CONTROL ID_FIELD" >&2
  exit 64
fi

source_path="$1"
resource_group="$2"
storage_account="$3"
storage_container="$4"
remote_prefix="$5"
cache_control="$6"
identity_field="$7"

if [[ ! -e "${source_path}" || -L "${source_path}" ]]; then
  echo "[azure-publish] source invalide: ${source_path}" >&2
  exit 65
fi
if [[ -z "${resource_group}" || "${resource_group}" == *$'\n'* ]]; then
  echo "[azure-publish] resource group invalide" >&2
  exit 65
fi
if [[ ! "${storage_account}" =~ ^[a-z0-9]{3,24}$ ]]; then
  echo "[azure-publish] nom de compte Storage invalide" >&2
  exit 65
fi
if [[ ! "${storage_container}" =~ ^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$ ]]; then
  echo "[azure-publish] nom de conteneur invalide" >&2
  exit 65
fi
if [[ -z "${cache_control}" || "${cache_control}" == *$'\n'* ]]; then
  echo "[azure-publish] Cache-Control invalide" >&2
  exit 65
fi
if [[ "${identity_field}" != "manifestId" && "${identity_field}" != "releaseId" ]]; then
  echo "[azure-publish] champ d'identite invalide" >&2
  exit 65
fi

if [[ -d "${source_path}" ]]; then
  source_root="$(cd "${source_path}" && pwd -P)"
  identity_document="${source_root}/manifest.json"
  expected_prefix_kind="manifests"
else
  source_root="$(cd "$(dirname "${source_path}")" && pwd -P)"
  source_path="${source_root}/$(basename "${source_path}")"
  identity_document="${source_path}"
  expected_prefix_kind="releases"
  if [[ "$(basename "${source_path}")" != "release.json" ]]; then
    echo "[azure-publish] seul release.json peut etre publie comme descripteur" >&2
    exit 65
  fi
fi
if [[ ! -f "${identity_document}" ]]; then
  echo "[azure-publish] document d'identite absent: ${identity_document}" >&2
  exit 65
fi
if find "${source_root}" -type l -print -quit | grep -q .; then
  echo "[azure-publish] liens symboliques interdits dans la source" >&2
  exit 65
fi

immutable_id="$(
  sed -nE "s/^[[:space:]]*\"${identity_field}\":[[:space:]]*\"(sha256:[0-9a-f]{64})\",?[[:space:]]*$/\\1/p" \
    "${identity_document}"
)"
if [[ ! "${immutable_id}" =~ ^sha256:[0-9a-f]{64}$ ||
      "${remote_prefix}" != "${expected_prefix_kind}/${immutable_id}" ]]; then
  echo "[azure-publish] prefixe distant incoherent avec ${identity_field}" >&2
  exit 65
fi

verification_directory="$(mktemp -d)"
expected_names="$(mktemp)"
actual_names="$(mktemp)"
trap 'rm -rf "${verification_directory}"; rm -f "${expected_names}" "${actual_names}"' EXIT

public_access="$(
  az storage container show \
    --account-name "${storage_account}" \
    --name "${storage_container}" \
    --auth-mode login \
    --query properties.publicAccess \
    --output tsv \
    --only-show-errors
)"
if [[ -n "${public_access}" && "${public_access}" != "None" && "${public_access}" != "null" ]]; then
  echo "[azure-publish] acces anonyme interdit pour ${storage_container}" >&2
  exit 66
fi

IFS=$'\t' read -r policy_state policy_days append_writes append_writes_all < <(
  az storage container immutability-policy show \
    --resource-group "${resource_group}" \
    --account-name "${storage_account}" \
    --container-name "${storage_container}" \
    --query '[state, immutabilityPeriodSinceCreationInDays, allowProtectedAppendWrites, allowProtectedAppendWritesAll]' \
    --output tsv \
    --only-show-errors
)
if [[ "${policy_state}" != "Locked" ||
      ! "${policy_days}" =~ ^[1-9][0-9]*$ ||
      "${append_writes}" == "true" ||
      "${append_writes_all}" == "true" ]]; then
  echo "[azure-publish] politique WORM verrouillee sans append protege requise" >&2
  exit 66
fi

publish_file() {
  local local_path="$1"
  local relative_path="$2"
  local blob_name="${remote_prefix}/${relative_path}"
  local remote_path="${verification_directory}/${relative_path}"
  local local_hash
  local_hash="$(sha256sum "${local_path}" | cut -d ' ' -f 1)"
  printf '%s\n' "${blob_name}" >> "${expected_names}"

  local exists
  exists="$(
    az storage blob exists \
      --account-name "${storage_account}" \
      --container-name "${storage_container}" \
      --name "${blob_name}" \
      --auth-mode login \
      --query exists \
      --output tsv \
      --only-show-errors
  )"
  if [[ "${exists}" != "true" ]]; then
    if ! az storage blob upload \
        --account-name "${storage_account}" \
        --container-name "${storage_container}" \
        --name "${blob_name}" \
        --file "${local_path}" \
        --type block \
        --auth-mode login \
        --overwrite false \
        --content-type application/json \
        --content-cache-control "${cache_control}" \
        --output none \
        --only-show-errors; then
      local raced_exists
      raced_exists="$(
        az storage blob exists \
          --account-name "${storage_account}" \
          --container-name "${storage_container}" \
          --name "${blob_name}" \
          --auth-mode login \
          --query exists \
          --output tsv \
          --only-show-errors
      )"
      if [[ "${raced_exists}" != "true" ]]; then
        echo "[azure-publish] echec de creation: ${blob_name}" >&2
        exit 66
      fi
    fi
  fi

  mkdir -p "$(dirname "${remote_path}")"
  az storage blob download \
    --account-name "${storage_account}" \
    --container-name "${storage_container}" \
    --name "${blob_name}" \
    --file "${remote_path}" \
    --auth-mode login \
    --overwrite true \
    --output none \
    --only-show-errors

  local remote_hash
  remote_hash="$(sha256sum "${remote_path}" | cut -d ' ' -f 1)"
  if [[ "${remote_hash}" != "${local_hash}" ]]; then
    echo "[azure-publish] SHA-256 distant incorrect: ${blob_name}" >&2
    exit 67
  fi

  local remote_content_type remote_cache_control version_id policy_mode immutable_until legal_hold
  IFS=$'\t' read -r remote_content_type remote_cache_control version_id policy_mode immutable_until legal_hold < <(
    az storage blob show \
      --account-name "${storage_account}" \
      --container-name "${storage_container}" \
      --name "${blob_name}" \
      --auth-mode login \
      --query '[properties.contentSettings.contentType, properties.contentSettings.cacheControl, versionId, immutabilityPolicy.policyMode, immutabilityPolicy.expiryTime, hasLegalHold]' \
      --output tsv \
      --only-show-errors
  )
  if [[ "${remote_content_type}" != "application/json" ||
        "${remote_cache_control}" != "${cache_control}" ||
        -z "${version_id}" ||
        "${version_id}" == "None" ||
        "${version_id}" == "null" ||
        "${policy_mode}" != "Locked" ]]; then
    echo "[azure-publish] version ou proprietes immuables invalides: ${blob_name}" >&2
    exit 68
  fi
  if [[ "${legal_hold}" != "true" ]]; then
    expiry_epoch=""
    if [[ -z "${immutable_until}" || "${immutable_until}" == "None" || "${immutable_until}" == "null" ]] ||
       ! expiry_epoch="$(date -d "${immutable_until}" +%s 2>/dev/null)" ||
       [[ "${expiry_epoch}" -le "$(date -u +%s)" ]]; then
      echo "[azure-publish] retention WORM absente ou expiree: ${blob_name}" >&2
      exit 68
    fi
  fi
}

file_count=0
if [[ -d "${source_path}" ]]; then
  while IFS= read -r -d '' local_path; do
    relative_path="${local_path#"${source_root}/"}"
    publish_file "${local_path}" "${relative_path}"
    file_count=$((file_count + 1))
  done < <(find "${source_root}" -type f -print0 | sort -z)
else
  publish_file "${source_path}" "release.json"
  file_count=1
fi

if [[ "${file_count}" -eq 0 ]]; then
  echo "[azure-publish] aucun fichier a publier" >&2
  exit 65
fi

sort -o "${expected_names}" "${expected_names}"
az storage blob list \
  --account-name "${storage_account}" \
  --container-name "${storage_container}" \
  --prefix "${remote_prefix}/" \
  --auth-mode login \
  --query '[].name' \
  --output tsv \
  --only-show-errors \
  | sort > "${actual_names}"

if ! cmp -s "${expected_names}" "${actual_names}"; then
  echo "[azure-publish] le prefixe distant contient des blobs absents ou supplementaires" >&2
  diff -u "${expected_names}" "${actual_names}" >&2 || true
  exit 69
fi

echo "[azure-publish] OK - ${file_count} blob(s) verifies sous ${remote_prefix}"
