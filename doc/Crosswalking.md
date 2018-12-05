Crosswalking docs
=================

Crosswalking a document goes through the following steps:

## Record unflattening

Current label: "records"

The original JSON is "unflattened". ReDBox 1.n stored metadata as a single flat array which used numeric subfields to store multifield repeatable items like people or FOR codes. The unflattening pass converts these into arrays of JSON objects.

For example, two collaborators represented in RB 1.9 as follows:

    "locrel:clb.foaf:Person.1.person.dc:identifier": "http://hdl.handle.net/11057/id6ed40717",
    "locrel:clb.foaf:Person.1.person.foaf:title": "Dr",
    "locrel:clb.foaf:Person.1.person.foaf:givenName": "Nadom",
    "locrel:clb.foaf:Person.1.person.foaf:email": "Nadom.H.Safi@student.uts.edu.au",
    "locrel:clb.foaf:Person.1.person.foaf:familyName": "Safi",
    "locrel:clb.foaf:Person.2.person.foaf:email": "Zhuoyang.Li@uts.edu.au",
    "locrel:clb.foaf:Person.2.person.foaf:givenName": "Zhuoyang",
    "locrel:clb.foaf:Person.2.person.foaf:title": "Ms",
    "locrel:clb.foaf:Person.2.person.dc:identifier": "http://hdl.handle.net/11057/id35c86e40",
    "locrel:clb.foaf:Person.2.person.foaf:familyName": "Li",

Would be unflattened into this:

    "locrel:clb.foaf:Person": [
        {
            "dc:identifier": "http://hdl.handle.net/11057/id6ed40717",
            "honorific": "Dr",
            "givenname": "Nadom",
            "email": "Nadom.H.Safi@student.uts.edu.au",
            "familyname": "Safi"
        },
        {
            "email": "Zhuoyang.Li@uts.edu.au",
            "givenname": "Zhuoyang",
            "honorific": "Ms",
            "dc:identifier": "http://hdl.handle.net/11057/id35c86e40",
            "familyname": "Li"
        }
    ],



*Errors*



crosswalk
handler
postwalk
create
