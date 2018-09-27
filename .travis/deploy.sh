#!/bin/bash

# Expected environment variables added by Travis
# DEPLOY_KEY_LABEL=abc123
# DEPLOY_KEY_ENV=<base64 of deploy_key.enc>

# Expected environment variables in .travis.yml
# DEPLOY_HOST=sybolt.com
# DEPLOY_PORT=22 (optional)
# DEPLOY_PATH=/ (optional)

set -e

# Check Travis state
if [ "$TRAVIS_BRANCH" != "master" ] || [ "$TRAVIS_SECURE_ENV_VARS" == "false" ] || [ "$TRAVIS_PULL_REQUEST" != "false" ] ; then
    echo "Skipping: Either missing secure env vars or PR that has not been merged"
    exit 0
fi

if [[ -z "${DEPLOY_HOST}" ]] ; then
    echo "Misconfiguration: Missing DEPLOY_HOST env var"
    exit 1
fi

PRIVKEY="~/.ssh/travis_id_rsa"

ENCRYPTED_KEY_VAR="encrypted_${DEPLOY_KEY_LABEL}_key"
ENCRYPTED_IV_VAR="encrypted_${DEPLOY_KEY_LABEL}_iv"
ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}

echo $DEPLOY_KEY_ENC | base64 -d | openssl aes-256-cbc -K $ENCRYPTED_KEY -iv $ENCRYPTED_IV -out "$PRIVKEY" -d
chmod 600 "$DEPLOY_KEY"
eval `ssh-agent -s`

echo -e "Host $DEPLOY_HOST\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
ssh-add "$PRIVKEY"
ssh -i "$PRIVKEY" "travis-ci@$DEPLOY_HOST:${DEPLOY_PATH:-/}" pwd

# TODO: Rsync and whatnot