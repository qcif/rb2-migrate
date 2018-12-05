#!/bin/bash

#ENDPOINT=https://test-redbox.research.uts.edu.au/redbox/api/v1
#APIKEY=29us0fw984yrw9
#PTYPE=dmpt

OID=42914baa3b2269c8c91f968604d97392



ENDPOINT=http://localhost:1500/default/rdmp/api/records

APIKEY="16764f36-1b78-4f27-b963-7479a81d23eb"

PTYPE=rdmp
MIMETYPE="Content-Type: application/json"


#curl -X GET "$ENDPOINT/info" $HEADERS

#curl -X POST "$ENDPOINT/object/$PTYPE" -d @rdmp.json -H "Authorization: Bearer $APIKEY" -H "$MIMETYPE"

curl -v -X GET "$ENDPOINT/metadata/$OID" -H "Authorization: Bearer $APIKEY" -H "$MIMETYPE"

curl -v -X GET "$ENDPOINT/permissions/$OID" -H "Authorization: Bearer $APIKEY" -H "$MIMETYPE"

