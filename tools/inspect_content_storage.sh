#!/usr/bin/env bash
# Inventaire en LECTURE SEULE d'un conteneur du compte de contenu immuable.
#
# N'ecrit rien. Aucune commande d'upload, de suppression ou de modification de
# policy n'a sa place dans ce fichier.
#
# Raison d'etre : le compte est prive (`publicNetworkAccess: Disabled`) et n'est
# joignable que depuis `vnet-certigo-ci`. Depuis l'exterieur, `az storage blob
# list` echoue avec une erreur de regles reseau. Un appelant qui ignore le code
# de sortie lit alors cet echec comme un conteneur vide, ce qui a reellement
# conduit a affirmer « 0 blob » sans qu'aucune lecture n'ait abouti. Ce script
# distingue donc explicitement « lecture impossible » de « conteneur vide ».
set -euo pipefail

: "${AZURE_STORAGE_ACCOUNT:?AZURE_STORAGE_ACCOUNT requis}"
: "${AZURE_STORAGE_CONTAINER:?AZURE_STORAGE_CONTAINER requis}"
blob_name="${BLOB_NAME:-}"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

# `if ! cmd; then status=$?` NE FONCTIONNE PAS : dans cette branche, `$?` est le
# statut du test negocie, donc toujours 0. Le premier jet de ce script affichait
# ainsi « az exit 0 » sur un echec reel, c'est-a-dire exactement la maladie qu'il
# est cense guerir : une valeur fabriquee presentee comme une mesure. Le statut
# est donc capture explicitement.
listing=""
list_status=0
listing="$(
  az storage blob list \
    --account-name "${AZURE_STORAGE_ACCOUNT}" \
    --container-name "${AZURE_STORAGE_CONTAINER}" \
    --auth-mode login \
    --query '[].name' \
    --output tsv \
    --only-show-errors
)" || list_status="$?"
if [[ "${list_status}" -ne 0 ]]; then
  echo "[inspect] LECTURE IMPOSSIBLE: ${AZURE_STORAGE_CONTAINER} (az exit ${list_status})" >&2
  {
    echo "### \`${AZURE_STORAGE_CONTAINER}\`"
    echo
    echo "**Lecture impossible**, \`az\` a quitte avec le code \`${list_status}\`."
    echo "Ce n'est **pas** un conteneur vide : aucune mesure n'a abouti."
  } >> "${summary}"
  exit 1
fi
echo "[inspect] az storage blob list: exit ${list_status}"

count="$(printf '%s' "${listing}" | grep -c . || true)"
echo "[inspect] ${AZURE_STORAGE_CONTAINER}: ${count} blob(s)"
if [[ "${count}" -gt 0 ]]; then
  printf '%s\n' "${listing}" | sed 's/^/[inspect]   /'
fi

{
  echo "### \`${AZURE_STORAGE_CONTAINER}\`"
  echo
  echo "Lecture aboutie. **${count}** blob(s)."
  if [[ "${count}" -gt 0 ]]; then
    echo
    echo '```'
    printf '%s\n' "${listing}"
    echo '```'
  fi
} >> "${summary}"

if [[ -z "${blob_name}" ]]; then
  exit 0
fi

# Sortie complete et NON projetee. Une projection est un filtre, et un filtre ne
# peut pas reveler un champ auquel on n'avait pas pense. C'est precisement une
# projection qui a masque le format reel de `--output tsv`.
properties=""
show_status=0
properties="$(
  az storage blob show \
    --account-name "${AZURE_STORAGE_ACCOUNT}" \
    --container-name "${AZURE_STORAGE_CONTAINER}" \
    --name "${blob_name}" \
    --auth-mode login \
    --output json \
    --only-show-errors
)" || show_status="$?"
if [[ "${show_status}" -ne 0 ]]; then
  echo "[inspect] LECTURE IMPOSSIBLE: ${blob_name} (az exit ${show_status})" >&2
  {
    echo
    echo "**Lecture impossible** pour \`${blob_name}\`, \`az\` a quitte avec le code \`${show_status}\`."
    echo "Ce n'est **pas** un blob sans proprietes : aucune mesure n'a abouti."
  } >> "${summary}"
  exit 1
fi
echo "[inspect] az storage blob show: exit ${show_status}"
if [[ -z "${properties//[[:space:]]/}" ]]; then
  # Une sortie vide apres un succes reste suspecte : on refuse de la presenter
  # comme une mesure.
  echo "[inspect] REPONSE VIDE pour ${blob_name}" >&2
  exit 1
fi
printf '%s\n' "${properties}"
{
  echo
  echo "#### Proprietes completes de \`${blob_name}\`"
  echo
  echo '```json'
  printf '%s\n' "${properties}"
  echo '```'
} >> "${summary}"
