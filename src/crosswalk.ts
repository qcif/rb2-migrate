/*
 *
 * Code for crosswalking data records
 */


// new rule: unflatten numeric keys automatically
// so field.n. -> field = [ 1, 2, ... ]
// and field.n.subfield -> field: [ { subfield: }, ... ]
//
// then crosswalk all fields into the new record unless they
// have an entry in the CROSSWALK dict: if they do, change
// fieldname


const fs = require('fs-extra');

type LogCallback = (stage: string, field: string, nfield: string, msg: string, value: any) => void; 


export function crosswalk(cwjson: Object, original: Object, logger: LogCallback):Object[] {
  var dest = {};
  const idfield = cwjson['idfield'];
  const oid = original[idfield];

  var src = unflatten(cwjson, original, logger);

  const reqd = cwjson['required'];
  const cwspec = cwjson['crosswalk'];
  const ignore = cwjson['ignore'];

  for( const srcfield in cwspec ) {
    var destfield = trfield(cwspec[srcfield], srcfield); 
    if( srcfield in src ) {
      if( typeof(cwspec[srcfield]) === 'string' ) {
        dest[destfield] = src[srcfield];
        if( dest[destfield] ) {
          logger('crosswalk', srcfield, destfield, "copied", dest[destfield]);
        } else {
          if( reqd.includes(destfield) ) {
            logger('crosswalk', srcfield, destfield, "required", null);
          } else {
            logger('crosswalk', srcfield, destfield, "blank", null);
          }
        }
        delete src[srcfield];
      } else {
        const spec = cwspec[srcfield];
        if( spec["type"] === "valuemap" ) {
          dest[destfield] = valuemap(spec, srcfield, destfield, src[srcfield], logger);
          delete src[srcfield];
        } else if( spec["type"] === "record" ) {
          // FIXME
          logger('crosswalk', srcfield, destfield, "assuming processed", JSON.stringify(src[srcfield]));
          dest[destfield] = src[srcfield]
          delete src[srcfield];
        } else {
          logger('crosswalk', srcfield, destfield, "error: type", spec["type"]);
        }
      }
    } else {
      if( reqd.includes(destfield) ) {
        logger("crosswalk", srcfield, destfield, "required", null);
      } else {
        logger("crosswalk", srcfield, destfield, "missing", null);
      }
    }
  }
  for( const srcfield in src ) {
    if( !ignore.includes(srcfield) ) {
      logger("postwalk", srcfield, "", "unmatched", src[srcfield]);
    } else {
      logger("postwalk", srcfield, "", "ignored", src[srcfield]);
    }
  }

  return [ src, dest ];
}


/* unflatten - preprocessing pass which collects multiple records in the
   rb1.x "field.n." and "field.subfield" formats into proper JSON.
   Has been split out into simplemultiples() and records()

*/

function unflatten(cwjson: Object, original: Object, logger: LogCallback): Object {
  /* First, process multi-field records - this removes the original
     fields for those */
  const pass1 = records(cwjson, original, logger);
  const multifield = /^(.*?)\.(\d+)\.?$/;
  var unflat = {};
  for( const field in pass1 ) {
    const m = field.match(multifield);
    if( m ) {
      const f = m[1];
      const i = parseInt(m[2]) - 1;
      if( f in unflat && i in unflat[f] ) {
        logger("unflatten", field, "", "unflat: duplicate", f);
      }
      if( !(f in unflat) ) {
        unflat[f] = [];
      }
      logger("unflatten", field, "", "unflatten", f + " " + String());
      unflat[f][i] = pass1[field];
    } else {
      unflat[field] = pass1[field];
    }
  }
  return unflat;
}




/* gathers all of the crosswalk fields with type = "record" like so

   "outer:field.subfield:one": "value1",
   "outer:field.subfield:two": "value2", [..]

   "outer:field": {
       "subfield:one": "value1",
       "subfield:two": "value2", 
       [..]
       }

   and

   "repeating:field.1.subfield:one": "value1a",
   "repeating:field.1.subfield:two": "value2a",
   "repeating:field.2.subfield:one": "value1b",
   "repeating:field.2.subfield:two": "value2b",
 
   "repeating:field": [
       {
           "subfield:one": "value1a",
           "subfield:two": "value2a"
       },
       {
           "subfield:one": "value1a",
           "subfield:two": "value2a"
       } 
    ]

   Returns an object with just the new record fields


*/ 

function records(cwjson: Object, original: Object, logger: LogCallback): Object {  
  const repeatrecord = /^(\d+)\.(.*)$/;
  var output = {... original};
  var rspecs = getrecordspecs(cwjson);
  for( const rfield in rspecs ) {
    const spec = rspecs[rfield];
    const pattern = new RegExp('^' + rfield.replace('.', '\\.') + "\.(.*)$");
    for( const field in original ) {
      const m = field.match(pattern);
      if( m ) {
        // check to see if the field looks like a repeatable
        // record by matching on a leading (\d)\. 
        var sfield = m[1];
        const m2 = sfield.match(repeatrecord);
        if( m2 ) {
          if( ! spec['repeatable'] ) {
            logger("records", field, "", "not repeatable", sfield);
          } else {
            const i = parseInt(m2[1]) - 1;
            sfield = m2[2];
            if( !(sfield in spec['fields']) ) {
              logger("records", field, "", "unknown subfield", sfield);
            } else {
              if( !(rfield in output) ) {
                output[rfield] = [];
              }
              if( !(i in output[rfield]) ) {
                output[rfield][i] = {};
              }
              logger("records", field, sfield, "copied", original[field])
              output[rfield][i][sfield] = original[field];
              delete output[field];
            }
          }
        } else {
          // It doesn't look repeatable
          if( spec['repeatable'] ) {
            logger("records", field, "", "should be repeatable", sfield);
          } else {
            if( !(sfield in spec['fields']) ) {
              logger("records", field, "", "unknown subfield", sfield);
            } else {
              if( !(rfield in output) ) {
                output[rfield] = {};
              }
              logger("records", field, sfield, "copied", original[field])
              output[rfield][sfield] = original[field];
              delete output[field];
            }
          }
        }
      }
    }
  }
  return output;
}

/* pulls all of the specifications for record fields from the
   crosswalk spec */

function getrecordspecs(cwjson: Object): Object {
  var rspecs = {};
  for( const field in cwjson['crosswalk'] ) {
    if( cwjson['crosswalk'][field]['type'] === 'record' ) {
      rspecs[field] = cwjson['crosswalk'][field];
    }
  }
  return rspecs;
}
            
         

function trfield(cf: string, old: string): string {
  var f = cf;
  if( typeof(cf) !== "string" ) {
    f = cf['name'];
  }
  if( f === "_" ) {
    return old.replace('.', '_');
  } else {
    return f;
  }
}
      

function valuemap(spec: Object, srcfield: string, destfield: string, srcval: string, logger: LogCallback): string {
  if( "map" in spec ) {
    if( srcval in spec["map"] ) {
      logger("crosswalk", srcfield, destfield, "mapped", spec["map"][srcval]);
      return spec["map"][srcval];
    } else {
      logger("crosswalk", srcfield, destfield, "unmapped", srcval);
      return "";
    }
  }
  logger("crosswalk", srcfield, destfield, "no map!", srcval);
  return "";
}


// todo: repeatable records

// function record(spec: Object, srcfield: string, src: Object, logger: LogCallback): Object {
//   if( "fields" in spec ) {
//     var dest = {};
//     logger("crosswalk", srcfield, "record", "");
//     for( var subf in spec["fields"] ) {
//       const srcf = srcfield + '.' + subf;
//       if( srcf in src ) {
//         dest[spec["fields"][subf]] = src[srcf];
//         logger(subf, "subfield", src[srcf]);
//       } else {
//         logger(subf, "subfield not found", srcf);
//       }
//     }
//     return dest;
//   } 
// }
  
