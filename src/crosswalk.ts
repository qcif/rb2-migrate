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


function notempty(x) {
  if( !x || x === "null" ) {
    return false;
  } else {
    return true;
  }
}



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
   
   gathers all of the crosswalk fields with type = "record" like so

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

   and now (for repeatable fields without subfields)

   "repeating:singleton.1.throw:this.away": "value1",
   "repeating:singleton.2.throw:this.away": "value2",

   "repeating:singleton": {
       "subfield:one": "value1",
       "subfield:two": "value2", 
       [..]
   }


   Returns an object with just the new record fields


*/ 

function unflatten(cwjson: Object, original: Object, logger: LogCallback): Object {
  const repeatrecord = /^(\d+)\.?(.*)$/;

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
            if( !('fields' in spec) ) {
              // no subfields
              if( !(rfield in output) ) {
                output[rfield] = [];
              }
              logger("records", field, 'single', "copied", original[field]);
              output[rfield][i] = original[field];
              delete output[field];
            } else {
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
  for( const rfield in output ) {
    if( Array.isArray(output[rfield]) ) {
      // remove empty or blank list items
      output[rfield] = output[rfield].filter((x) => notempty(x));
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
  
