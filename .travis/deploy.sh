#!/bin/bash

# Expected environment variables added by Travis
# DEPLOY_KEY_LABEL=abc123
# DEPLOY_KEY_ENC=<base64 of deploy_key.enc>

# Expected environment variables in .travis.yml
# DEPLOY_HOST=sybolt.com
# DEPLOY_PORT=22 (optional)

set -e

# Check Travis state
if [ "$TRAVIS_SECURE_ENV_VARS" == "false" ] || [ "$TRAVIS_PULL_REQUEST" != "false" ] ; then
    echo "Skipping: Either missing secure env vars or PR that has not been merged"
    exit 0
fi

if [[ -z "${DEPLOY_HOST}" ]] ; then
    echo "Misconfiguration: Missing DEPLOY_HOST env var"
    exit 1
fi

DEPLOY_KEY="deploy_key"

ENCRYPTED_KEY_VAR="encrypted_${DEPLOY_KEY_LABEL}_key"
ENCRYPTED_IV_VAR="encrypted_${DEPLOY_KEY_LABEL}_iv"
ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}

echo "Decrypting private key"
echo $DEPLOY_KEY_ENC | base64 -d | openssl aes-256-cbc -K $ENCRYPTED_KEY -iv $ENCRYPTED_IV -out "$DEPLOY_KEY" -d
chmod 600 "$DEPLOY_KEY"

echo -e "Host $DEPLOY_HOST\n\tStrictHostKeyChecking no\nPasswordAuthentication no" >> ~/.ssh/config

echo "Booting SSH Agent"
eval `ssh-agent -s`
ssh-add "$DEPLOY_KEY"

echo "Connecting to target host"
ssh -i "$DEPLOY_KEY" -p ${DEPLOY_PORT:-22} "travis-ci@$DEPLOY_HOST" pwd

# TODO: Rsync and whatnot
