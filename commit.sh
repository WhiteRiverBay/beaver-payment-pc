#!/bin/bash

timestamp=$(date +%Y-%m-%d-%H-%M-%S)

git add .
git commit -m"update-$timestamp-for-cursor"
