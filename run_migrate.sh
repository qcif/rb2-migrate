#!/bin/bash

OUTDIR=./output
SOURCE=Test1_9_files
DEST=Test2_0
CROSSWALK=$1
#RECORD=95a5594a6140ea01feb462c8123786ae
RECORD=323983d8b0c8406d3f821ec399d302e2

if [[ -z $CROSSWALK ]]; then
	echo "Give a crosswalk as the first argument, like:"
	echo "./run_migrate.sh dataset_live"
	exit 1
fi

node ./src/migrate.js --outdir $OUTDIR --source $SOURCE --dest $DEST --crosswalk $CROSSWALK --index 
