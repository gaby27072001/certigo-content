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

# La publication s'appuie sur l'Azure CLI installee sur le runner, et non plus
# sur l'action conteneur `azure/cli` : les runners self-hosted n'ont pas Docker,
# donc cette action echouait avant toute ecriture. L'image runner epingle
# `azure-cli` a une version exacte (apt-mark hold, manifeste toolchain et SBOM,
# verifies au build par `validate-toolchain.sh`), mais ce script ne peut pas en
# depend : on exige donc explicitement un plancher de version ici, afin qu'un
# changement de parc echoue bruyamment plutot que de publier avec un outil au
# comportement different.
readonly MINIMUM_AZURE_CLI_VERSION="2.89.0"
if ! command -v az >/dev/null 2>&1; then
  echo "[azure-publish] Azure CLI absente du runner" >&2
  exit 70
fi
azure_cli_version="$(az version --query '"azure-cli"' --output tsv 2>/dev/null || true)"
if [[ ! "${azure_cli_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "[azure-publish] version Azure CLI illisible: ${azure_cli_version:-<vide>}" >&2
  exit 70
fi
if [[ "$(printf '%s\n%s\n' "${MINIMUM_AZURE_CLI_VERSION}" "${azure_cli_version}" |
  sort -V | head -n 1)" != "${MINIMUM_AZURE_CLI_VERSION}" ]]; then
  echo "[azure-publish] Azure CLI ${azure_cli_version} < ${MINIMUM_AZURE_CLI_VERSION} requise" >&2
  exit 70
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
retry_log="$(mktemp)"
skipped_log="$(mktemp)"
trap 'rm -rf "${verification_directory}"; rm -f "${expected_names}" "${actual_names}" "${retry_log}" "${skipped_log}"' EXIT

# Une publication complete emet environ 10 200 appels `az`. A ce volume, une
# defaillance transitoire est quasi certaine, et le script n'en tolerait aucune :
# le run 33960774991 a echoue apres 22 minutes et ~540 fichiers publies, sur un
# unique refus d'autorisation transitoire, une seule ligne ERROR dans 3 509.
#
# Ce defaut n'est visible qu'A L'ECHELLE. Les trois pannes precedentes (Docker,
# separateur, casse) etaient deterministes et echouaient toutes sur le premier
# fichier ; aucun test publiant deux fichiers ne pouvait reveler celle-ci.
#
# Les tentatives sont donc BRUYANTES et non silencieuses. Un retry muet est un
# instrument qui masque ce qu'il lisse : il rendrait le systeme plus sain qu'il
# ne l'est, ce qui est exactement la maladie que ce depot passe sa journee a
# corriger. Chaque tentative est journalisee avec son appel, son fichier, son
# rang et le texte d'erreur reel, et le total est publie meme lorsqu'il vaut
# zero : un zero imprime est une preuve, un zero absent n'est rien.
readonly RETRY_ATTEMPTS=3
retry_readonly() {
  local label="$1"
  shift
  local attempt=1
  local delay=2
  local output=""
  local status=0
  while true; do
    status=0
    output="$("$@" 2>&1)" || status="$?"
    if [[ "${status}" -eq 0 ]]; then
      printf '%s' "${output}"
      return 0
    fi
    if [[ "${attempt}" -ge "${RETRY_ATTEMPTS}" ]]; then
      echo "[azure-publish] ${label}: echec definitif apres ${attempt} tentative(s)" >&2
      printf '%s\n' "${output}" >&2
      return "${status}"
    fi
    # Une ligne par tentative, avec l'erreur reelle : trois modes de defaillance
    # differents retentes une fois chacun ne sont pas la meme situation qu'un
    # seul appel instable retente trois fois, et un simple compteur ne peut pas
    # les distinguer.
    echo "[azure-publish][retry] ${label} tentative ${attempt}/${RETRY_ATTEMPTS} (az exit ${status}): $(printf '%s' "${output}" | tr '\n' ' ' | cut -c1-200)" >&2
    printf '%s\t%s\n' "${label}" "$(printf '%s' "${output}" | tr '\n' ' ' | cut -c1-200)" >> "${retry_log}"
    sleep "${delay}"
    delay=$(( delay * 2 ))
    attempt=$(( attempt + 1 ))
  done
}

public_access="$(
  retry_readonly "container show ${storage_container}" \
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

mapfile -t immutability_fields < <(
  retry_readonly "immutability-policy show ${storage_container}" \
    az storage container immutability-policy show \
      --resource-group "${resource_group}" \
      --account-name "${storage_account}" \
      --container-name "${storage_container}" \
      --query '[state, immutabilityPeriodSinceCreationInDays, allowProtectedAppendWrites, allowProtectedAppendWritesAll]' \
      --output tsv \
      --only-show-errors
)
# `--output tsv` sur une projection JMESPath plate emet UNE VALEUR PAR LIGNE, et
# non des colonnes separees par des tabulations : la tabulation n'apparait que
# pour un resultat en ligne (tableau imbrique). Lire ces sorties avec
# `IFS=$'\t' read` ne remplissait donc que la premiere variable et laissait les
# suivantes vides, ce qui faisait echouer la garde WORM en annoncant un probleme
# de policy inexistant. On lit desormais ligne par ligne et on verifie le nombre
# de champs, afin qu'un changement de format echoue explicitement.
if [[ "${#immutability_fields[@]}" -ne 4 ]]; then
  echo "[azure-publish] reponse immutability-policy inattendue: ${#immutability_fields[@]} champ(s)" >&2
  exit 66
fi
policy_state="${immutability_fields[0],,}"
policy_days="${immutability_fields[1]}"
append_writes="${immutability_fields[2]}"
append_writes_all="${immutability_fields[3]}"
# ADR-020 interdit de verrouiller la policy WORM tant que l'import, la lecture
# versionnee et le rollback N-1 ne sont pas prouves, et le verrouillage est
# irreversible. Exiger `Locked` ici rendait donc la publication impossible :
# publier exigeait le lock, le lock exigeait d'avoir publie.
#
# On exige toujours une policy de retention active, non nulle et sans append
# protege : c'est elle qui empeche reellement l'ecrasement et la suppression.
# `Locked` n'est exige que lorsque CONTENT_REQUIRE_LOCKED_WORM=true, ce qui doit
# etre le cas en production apres la preuve staging.
#
# Casse : Azure ne repond pas la meme casse selon le plan interroge. Le plan de
# gestion renvoie `Unlocked` pour l'etat du conteneur, tandis que le plan de
# donnees renvoie `unlocked` en minuscules pour `immutabilityPolicy.policyMode`
# d'un blob. Mesure sur le compte reel le 2026-09-05. Une comparaison sensible a
# la casse faisait donc echouer la verification par blob en exit 68 sur un objet
# parfaitement valide, apres son upload. Les deux valeurs sont normalisees en
# minuscules avant comparaison.
require_locked_worm="${CONTENT_REQUIRE_LOCKED_WORM:-false}"
if [[ "${require_locked_worm}" != "true" && "${require_locked_worm}" != "false" ]]; then
  echo "[azure-publish] CONTENT_REQUIRE_LOCKED_WORM doit valoir true ou false" >&2
  exit 64
fi
if [[ ( "${policy_state}" != "locked" && "${policy_state}" != "unlocked" ) ||
      ! "${policy_days}" =~ ^[1-9][0-9]*$ ||
      "${append_writes}" == "true" ||
      "${append_writes_all}" == "true" ]]; then
  echo "[azure-publish] politique WORM active sans append protege requise" >&2
  exit 66
fi
if [[ "${require_locked_worm}" == "true" && "${policy_state}" != "locked" ]]; then
  echo "[azure-publish] policy WORM verrouillee exigee par CONTENT_REQUIRE_LOCKED_WORM" >&2
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
    retry_readonly "blob exists ${blob_name}" \
      az storage blob exists \
        --account-name "${storage_account}" \
        --container-name "${storage_container}" \
        --name "${blob_name}" \
        --auth-mode login \
        --query exists \
        --output tsv \
        --only-show-errors
  )"
  if [[ "${exists}" == "true" ]]; then
    # Chemin create-only : le blob existe deja, on ne re-televerse pas. Compte
    # dans un fichier plutot qu'une variable, car `publish_file` s'execute dans
    # le corps d'une boucle et les increments doivent survivre au sous-shell.
    printf '%s\n' "${blob_name}" >> "${skipped_log}"
  fi
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
        retry_readonly "blob exists (race) ${blob_name}" \
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
  retry_readonly "blob download ${blob_name}" \
    az storage blob download \
      --account-name "${storage_account}" \
      --container-name "${storage_container}" \
      --name "${blob_name}" \
      --file "${remote_path}" \
      --auth-mode login \
      --overwrite true \
      --output none \
      --only-show-errors >/dev/null

  local remote_hash
  remote_hash="$(sha256sum "${remote_path}" | cut -d ' ' -f 1)"
  if [[ "${remote_hash}" != "${local_hash}" ]]; then
    echo "[azure-publish] SHA-256 distant incorrect: ${blob_name}" >&2
    exit 67
  fi

  local blob_fields
  # Meme correction que pour la policy de conteneur : projection plate, donc une
  # valeur par ligne. Ce cas etait plus dangereux, car il echouait APRES l'upload
  # du blob et aurait signale une immuabilite invalide sur un objet correct.
  mapfile -t blob_fields < <(
    retry_readonly "blob show ${blob_name}" \
      az storage blob show \
        --account-name "${storage_account}" \
        --container-name "${storage_container}" \
        --name "${blob_name}" \
        --auth-mode login \
        --query '[properties.contentSettings.contentType, properties.contentSettings.cacheControl, versionId, immutabilityPolicy.policyMode, immutabilityPolicy.expiryTime, hasLegalHold]' \
        --output tsv \
        --only-show-errors
  )
  if [[ "${#blob_fields[@]}" -ne 6 ]]; then
    echo "[azure-publish] reponse blob show inattendue: ${#blob_fields[@]} champ(s)" >&2
    exit 68
  fi
  local remote_content_type="${blob_fields[0]}"
  local remote_cache_control="${blob_fields[1]}"
  local version_id="${blob_fields[2]}"
  local policy_mode="${blob_fields[3],,}"
  local immutable_until="${blob_fields[4]}"
  local legal_hold="${blob_fields[5]}"
  if [[ "${remote_content_type}" != "application/json" ||
        "${remote_cache_control}" != "${cache_control}" ||
        -z "${version_id}" ||
        "${version_id}" == "None" ||
        "${version_id}" == "null" ||
        ( "${policy_mode}" != "locked" && "${policy_mode}" != "unlocked" ) ]]; then
    echo "[azure-publish] version ou proprietes immuables invalides: ${blob_name}" >&2
    exit 68
  fi
  if [[ "${require_locked_worm}" == "true" && "${policy_mode}" != "locked" ]]; then
    echo "[azure-publish] policyMode verrouille exige: ${blob_name}" >&2
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
retry_readonly "blob list ${remote_prefix}" \
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

# Total publie inconditionnellement, y compris a zero : un zero imprime est une
# preuve que le chemin a ete instrumente, un zero absent n'est rien. Les libelles
# distincts sont conserves pour distinguer trois modes de defaillance retentes
# une fois chacun d'un seul appel instable retente trois fois.
retry_total="$(grep -c . "${retry_log}" 2>/dev/null || true)"
retry_total="${retry_total:-0}"
echo "[azure-publish] tentatives supplementaires: ${retry_total}"
# Comptes publies INCONDITIONNELLEMENT, y compris a zero. Un compteur qui
# n'apparait que lorsqu'il est non nul ne permet pas de distinguer « rien a
# ignorer » de « le chemin create-only ne s'est jamais execute ».
#
# Les trois nombres forment une identite verifiable plutot qu'un recit : le
# nombre de blobs deja presents plus le nombre de blobs televerses doit egaler
# le nombre total de fichiers traites. Un ecart signale un defaut du chemin
# create-only, ce qu'une phrase du type « les blobs existants ont ete ignores »
# ne pourrait jamais reveler.
skipped_total="$(grep -c . "${skipped_log}" 2>/dev/null || true)"
skipped_total="${skipped_total:-0}"
uploaded_total=$(( file_count - skipped_total ))
echo "[azure-publish] blobs deja presents (ignores): ${skipped_total}"
echo "[azure-publish] blobs televerses: ${uploaded_total}"
if [[ "${uploaded_total}" -lt 0 ]]; then
  echo "[azure-publish] incoherence: ${skipped_total} ignores > ${file_count} traites" >&2
  exit 69
fi
if [[ "${retry_total}" -gt 0 ]]; then
  echo "[azure-publish] detail des tentatives par appel:" >&2
  sort "${retry_log}" | uniq -c | sort -rn | sed 's/^/[azure-publish][retry]   /' >&2
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### \`${remote_prefix}\`"
    echo
    echo "- blobs verifies : **${file_count}**"
    echo "- blobs deja presents (ignores) : **${skipped_total}**"
    echo "- blobs televerses : **${uploaded_total}**"
    echo "- tentatives supplementaires : **${retry_total}**"
    if [[ "${retry_total}" -gt 0 ]]; then
      echo
      echo '```'
      sort "${retry_log}" | uniq -c | sort -rn
      echo '```'
    fi
  } >> "${GITHUB_STEP_SUMMARY}"
fi

echo "[azure-publish] OK - ${file_count} blob(s) verifies sous ${remote_prefix}"
