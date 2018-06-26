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

type LogCallback = (field: string, msg: string, value: any) => void; 

function unflatten(original: Object, logger: LogCallback) {
  const multifield = /^(.*?)\.(\d+)\.?$/;
  const multirecord = /^(.*?)\.(\d+)\.(.+)$/;
  var unflat = {};
  for( const field in original ) {
    const m1 = field.match(multifield);
    if( m1 ) {
      const [ d, f, j ] = m1;
      const i = parseInt(j) - 1;
      if( f in unflat && i in unflat[f] ) {
        logger(field, "unflat: duplicate", d);
      }
      if( !(f in unflat) ) {
        unflat[f] = [];
      }
      unflat[f][i] = original[field];
    } else {
      const m2 = field.match(multirecord);
      if( m2 ) {
        const [ d, f, j, s ] = m2;
        const i = parseInt(j) - 1;
        if( f in unflat && i in unflat[f] && s in unflat[f][i] ) {
          logger(field, "unflat: duplicate record", d);
        }
        if( !(f in unflat) ) {
          unflat[f] = [];
        }
        if( !(i in unflat[f]) ) {
          unflat[f][i] = {};
        }
        unflat[f][i][s] = original[field];
      } else {
        unflat[field] = original[field];
      }
    }
  }
  return unflat;
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
      
export function crosswalk(cwjson: Object, original: Object, logger: LogCallback):Object[] {
  var dest = {};
  const idfield = cwjson['idfield'];
  const oid = original[idfield];

  var src = unflatten(original, logger);

  const reqd = cwjson['required'];
  const cwspec = cwjson['crosswalk'];
  const ignore = cwjson['ignore'];

  for( const srcfield in cwspec ) {
    var destfield = trfield(cwspec[srcfield], srcfield); 
    if( srcfield in src ) {
      if( typeof(cwspec[srcfield]) === 'string' ) {
        dest[destfield] = src[srcfield];
        if( dest[destfield] ) {
          logger(srcfield, "copied", dest[destfield]);
        } else {
          if( reqd.includes(destfield) ) {
            logger(srcfield, "required", null);
          } else {
            logger(srcfield, "blank", null);
          }
        }
        delete src[srcfield];
      } else {
        const spec = cwspec[srcfield];
        if( spec["type"] === "valuemap" ) {
          dest[destfield] = valuemap(spec, srcfield, src[srcfield], logger);
          delete src[srcfield];
        } else if( spec["type"] === "record" ) {
          dest[destfield] = record(spec, srcfield, src, logger);
          delete src[srcfield];
       } else {
          logger(srcfield, "unrecognised type", spec["type"]);
        }
      }
    } else {
      if( reqd.includes(destfield) ) {
        logger(srcfield, "required", null);
      } else {
        logger(srcfield, "missing", null);
      }
    }
  }
  for( const srcfield in src ) {
    if( !ignore.includes(srcfield) ) {
      logger(srcfield, "unmatched", src[srcfield]);
    } else {
      logger(srcfield, "ignored", src[srcfield]);
    }
  }

  return [ src, dest ];
}


function valuemap(spec: Object, srcfield: string, srcval: string, logger: LogCallback): string {
  if( "map" in spec ) {
    if( srcval in spec["map"] ) {
      logger(srcfield, "mapped", spec["map"][srcval]);
      return spec["map"][srcval];
    } else {
      logger(srcfield, "unmapped", srcval);
      return "";
    }
  }
  logger(srcfield, "no map!", srcval);
  return "";
}


// todo: repeatable records

function record(spec: Object, srcfield: string, src: Object, logger: LogCallback): Object {
  if( "fields" in spec ) {
    var dest = {};
    logger(srcfield, "record", "");
    for( var subf in spec["fields"] ) {
      const srcf = srcfield + '.' + subf;
      if( srcf in src ) {
        dest[spec["fields"][subf]] = src[srcf];
        logger(subf, "subfield", src[srcf]);
      } else {
        logger(subf, "subfield not found", srcf);
      }
    }
    return dest;
  } 
}
  
