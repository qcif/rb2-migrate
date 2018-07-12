ReDBOX 2 Migration
==================

## Introduction

This is a node.js package for migrating records from ReDBox 1.8+ to ReDBox 2.0 using the API at both ends.

## Usage

    > node src/migrate.js --source SourceServer --dest DestServer --type dmpt

'SourceServer' and 'DestServer' are references to the 'servers' section of the configuration file.

## Configuration

The config file is config/default.json. Sections as follows:

### servers

Keys are the server names which are passed in to --source and --dest.

Values are JSON objects giving version, baseURL, apiKey and a list of
packageTypes supported by the server.

ReDBox 2 servers also need a branding and portal value.

    {
    	"Test1_9": {
      		"version": "Redbox1",
      		"baseURL": "https://redbox.organisation.org/redbox/api/v1",
      		"apiKey": "#############",
      		"packageTypes": [ "dmpt", "dataset", "self-submission" ]
    	},
    	"Test2_0": {
      		"version": "Redbox2",
      		"baseURL": "http://redbox2.orginisation.org/",
      		"apiKey": "#############",
      		"packageTypes": [ "rdmp", "dataRecord", "workspace" ],
      		"branding": "default",
      		"portal": "rdmp"
    	}
    }

### crosswalks

Path containing crosswalk configuration files: see "Crosswalks" below for
details.

### logs

A list of objects, each of which is used to build a winston logger. Each
object has at least a "level" specifying the logging level.  If there's a
"filename" specified, log to that, otherwise log to the console.

    [
        {
            "level": "error"
        },
        {
          	"filename": "./logs/debug.log",
      		"level": "error"
    	}
  	]

## Crosswalks

Each crosswalk is a file called ${type}.json in the crosswalks directory.
${type} needs to match a packageType configured on the source server.

The crosswalk is a JSON object with the following sections.

### idfield

A string specifying which field in the source objects contains the unique
object id.

### source_type

The package type to be fetched from the source server.

### dest_type

The package type to be written to the destination server.

### required

A list of fields in the destination JSON which are mandatory. The script
will report errors for migrated objects in which these fields are missing
or empty.

### ignore

A list of fields in the source JSON which are ignored - the script will not
log any warnings or errors about them.

### crosswalk

A JSON object: the keys are field names in the source JSON, and the values
are instructions about how to map these to the destination JSON.

#### copy

If the value is a string,

* if it's a single underscore, make the destination field by replacing any
  "." in the source field name with underscores, and then copy the value 
  to that field
* if it's any other string, use that string as the destination field

If the value is an object, it should be either a record or a valuemap. Which
crosswalk is used is determined by the "type" field of the object. If an
object has no "type" field, or if it's unknown, an error will be logged.

#### valuemap

A valuemap maps values from the source field into values for the destination
field. It needs a "name" field, which works the same way as a simple copy
(if it's an underscore, transform the original field name, otherwise just
use the "name" as the new field).

The "map" field is a JSON object mapping old values to new values. Any
values in a source record which don't have an entry in the valuemap will
be logged as errors.

    {
      "name": "_",
      "type": "valuemap",
      "map" : {
        "ovalue1": "nvalue1",
        "ovalue2": "nvalue2",
        ...
      }
    }

#### record

Record crosswalks are for fields which have some internal structure, or are
repeatable, or both.

    {
    	"type": "record",
    	"name": "_",
    	"repeatable": 1,
    	"fields": {
    		"sourcefield1": "destfield1",
    		"sourcefield2": "destfield2",
    		...
    	},
    	"handler": "MySpecial"
    }

"name" determines the name of the top-level destination field, with the same
underscore-for-periods replacement as other fields.

"repeatable", if it's present and has a truth-y value, makes the crosswalk look
for multiple records with the same prefix in ReDBox 1.9 style, and will cause
an error to be logged if it finds only a single record.  The converse is also
true: if a record isn't flagged as repeatable and there are multiple values in
the source, an error is logged.

"fields" is an optional JSON object mapping subfields in the source to
subfields in the destination. (If "fields" is not present, whatever is in
the source JSON is copied across.)

"handler" is used to specify a Handler class: these are used to do more 
complicated crosswalks.  There are three built-in Handlers and you can add
your own.

## Handlers


### ForSeo

### Person

### FundingBody
