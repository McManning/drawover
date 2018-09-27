#!/bin/bash

# Expected environment variables added by Travis
# DEPLOY_KEY_LABEL=abc123
# DEPLOY_KEY_ENC=<base64 of deploy_key.enc>

# Expected environment variables in .travis.yml
# DEPLOY_HOST=sybolt.com
# DEPLOY_PORT=22            (optional)
# DEPLOY_USER=travis-ci     (optional)
# DEPLOY_PATH=.             (optional) - e.g. for React apps, 'build' is what we want

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

DEPLOY_PORT=${DEPLOY_PORT:-22}
DEPLOY_PATH=${DEPLOY_PATH:-.}
DEPLOY_USER=${DEPLOY_USER:-travis-ci}
DEPLOY_ROOT="/home/$DEPLOY_USER"

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

# echo "Connecting to target host"
# ssh -p $DEPLOY_PORT "$DEPLOY_USER@$DEPLOY_HOST" pwd

echo "Starting rsync to $DEPLOY_ROOT"
rsync -r --delete-after --quiet -e "ssh -p $DEPLOY_PORT" \
    $TRAVIS_BUILD_DIR/$DEPLOY_PATH "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_ROOT}"

echo "Dumping file list"
ssh -p $DEPLOY_PORT "$DEPLOY_USER@$DEPLOY_HOST" find .

# Note: rsync probably not the best option since we need a zero-downtime deployment.
# Probably do the ORIS thing and deploy to a staging area then hot swap once complete.

# zipping, scp'ing, and swapping over to a production might be a better solution for most apps.
