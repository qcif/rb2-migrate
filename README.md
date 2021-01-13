ReDBOX 2 Migration
==================

## Introduction

This is a node.js package for migrating records from ReDBox 1.8+ to ReDBox 2.0 using the API at both ends.

## Usage

    > node src/migrate.js --source SourceServer --dest DestServer --type dmpt --outdir ./report

'SourceServer' and 'DestServer' are references to the 'servers' section of the configuration file.

## Configuration

The config file is [config/default.json](). Sections as follows:

You can also use config files in production by running  `export NODE_ENV=production` before the script

And store production values in `config/production.json`

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

### workflow

A map between workflow stages in the source server and the destination
server.

### permissions

(Note: the way permissions work is specific to migrating a 1.9 to a 2.0
server, and even more specifically about migrating UTS's 1.9 to 2.0.  A
more mature migration script will need to handle 2.x -> 2.y migrations.)

Because of changes to the permissions system from 1.9 to 2.0, and
because the 1.9 API doesn't expose all of its view permissions, they
aren't crosswalked directly. Instead, the idea is to give a crosswalked
record the same permissions it would have had, if it had been created 
in 2.0.

The permissions config maps contributer fields in the destination record
to an array of permissions - ie 

    "contributor_ci": [ "view", "edit" ]

means that the FNCI will be granted view and edit permissions on the
record.

"\_owner\_" is a special key value which picks up the owner of a record
in 1.9 and gives that user the specified permissions.

If the owner is different from contributor_ci or contributor_data_manager,
this will be highlighted in the output reports.

### permissions_id

Specifies which field from a Person record should be used as the id
for setting permissions

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

A Handler is a TypeScript class which implements the Handler interface
defined in src/handlers/handlers.ts.  Copying the examples provided is
probable the best way to write one.

Handler source files should be added to the src/handlers directory, and 
also need to be exported from that directory's index.ts file, like so:

    export { ForSeo } from './ForSeo';
    export { Person } from './Person';
    export { FundingBody } from './FundingBody';
    export { MyHandler } from './MyHandler';

The class name of the handler has to match the value of the "handler"
field in the crosswalk configuration.

Handlers are called on record values *after* any mapping of fields 
using the "field" object has been applied.  For an example of how this
works, compare the four fields which use the Person handler to
crosswalk FNCIs, data managers, collaborators and supervisors from 
ReDBOx 1.9. The subfields for these records aren't the same in RB1.9,
so the default crosswalk maps them onto a standard record structure
before they are processed by the Person handler.

### ForSeo

A handler to map FOR and SEO codes from ReDBox 1.9 to ReDBox 2.0.

### Person

A handler to map Person values from RB1.9 to RB2.0

### FundingBody

A handler to map funding bodies from RB1.9 to RB2.0.


## Rb2-migrate by example:
### Redbox1 install
* Rb2-migrate needs to know the source and destination. The `destination` will be the publicly available URL of your new Redbox 2 instance.
* Your `source` will be either the original redbox1 or, a copy of this (remembering that you are going to be migrating potentially thousands of records - it may not be ideal to tie up the actual production instance API of redbox1 with this migration).
  * Clone the 'storage', 'solr' and 'home' directories (ignoring the usual guff such as log directories)
and make availabe
    * Consider that the cloned storage may take up a few GB and you will need to run a redbox1 instance against the source, so you will need to consider where to put this. It may be useful to place redbox1 on another vm and tunnel to it from the redbox2 instance
  * Download the latest copy of redbox1 from nexus and setup to use the cloned storage, solr and home (remember to change certain values such as server url to a local instance with ports not already being used).
  * Remove the `solr` folder from your redbox1 instance and replace with the `solr` from source clone
  * Add `storage` from the source clone to your redbox1 instance
  * Update the `server/tf_env.sh` with ports (unique to vm) and installation path of your redbox1
* Start your redbox1 server and confirm the website comes up without errors
  * Add an api key to your redbox1 server through the Admin menu (or at `data/security/apiKeys.json` and restart)
### Rb2-migrate
* Use `config/default.json` for the migration (you can create another config file but you'll then need to `export NODE_ENV=<config_file_basename>`)
* Update:
  * `baseURL` and `apiKey` for both:
    * `Test1_9` and `Test2_0` : these are your redbox1 and redbox2 installations
    * for `Test1_9` use the apiKey you created earlier
    * for `Test2_0` ensure you have the latest apikey from redbox2
  * `solrURL` for `Test1_9`
  
