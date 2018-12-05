Grants

The original crosswalk was supposed to take this:

...

"foaf:fundedBy.vivo:Grant.1.redbox:grantNumber": "GRANT01",
"foaf:fundedBy.vivo:Grant.1.skos:prefLabel": "Human-readable Grant Name",
"foaf:fundedBy.vivo:Grant.1.dc:identifier": "https://purl.org/Grant1",
"foaf:fundedBy.vivo:Grant.1.redbox:grantNumber": "GRANT02",
"foaf:fundedBy.vivo:Grant.1.skos:prefLabel": "Other Human-readable Grant Name",
"foaf:fundedBy.vivo:Grant.1.dc:identifier": "https://purl.org/Grant2",

...


And turn it into

...

"foaf:fundedBy.vivo:Grant": [
    {
    	"grant_number": "GRANT01",
    	"dc:title": "Human-readable Grant Name",
    	"dc:identifier": "https://purl.org/Grant1"
    },
    {
    	"grant_number": "GRANT02",
    	"dc:title": "Other Human-readable Grant Name",
    	"dc:identifier": "https://purl.org/Grant2"
    }
],

...

But checking the JSON output by my script, the "unflattening" stage (gathering the foaf:fundedBy.vivo:Grant.n records into objects) isn't working properly for grants.
	
