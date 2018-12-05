# Documenting the api differences for basic requests


## RB 1

info()
/info

search(oid: string, start?:number )
/search?q=packageType&start=n

createRecord(metadata: Object, packagetype: string, options?:Object)
/object/$ptype

getRecord(oid: string)
/recordmetadata/$oid

updateRecord(oid: string, metadata: Object)
POST /recordmetadata/$oid

getRecordMetadata(oid: string)
/objectmetadata/$oid

updateRecordMetadata(oid: string, metadata: Object)
POST /objectmetadata/$oid

## RB2

All RB2 urls start with /:branding/:portal

info - N/A


createRecord
/api/records/metadata/$type

getRecordMetadata
/api/records/metadata/$oid
