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



function unflatten(original: Object) {
  const multifield = /^(.*?)\.(\d+)\.$/;
  const multirecord = /^(.*?)\.(\d+)\.(.+)$/;
  var unflat = {};
  for( const field in original ) {
    const m1 = field.match(multifield);
    if( m1 ) {
      const [ d, f, j ] = m1;
      const i = parseInt(j) - 1;
      if( f in unflat && i in unflat[f] ) {
        console.log("error: multiple fields: " + d);
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
          console.log("error: multiple fields: " + d);
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
  if( cf === "_" ) {
    return old.replace('.', '_');
  } else {
    return cf;
  }
}
      
export function crosswalk(cwjson: Object, original: Object, errata: (oid: string, field: string, msg: string, value: any) => void):Object {
  var dest = {};
  var src = unflatten(original);
  const idfield = cwjson['idfield'];
  const oid = original[idfield];

  const cwspec = cwjson['crosswalk'];

  for( const srcfield in cwspec ) {
    if( srcfield in src ) {
      if( typeof(cwspec[srcfield]) === 'string' ) {
        var destfield = trfield(cwspec[srcfield], srcfield); 
        dest[destfield] = src[srcfield];
        if( ! dest[destfield] ) {
          errata(oid, srcfield, "empty", null);
        }
        delete src[srcfield];
      } else {
        const spec = cwspec[srcfield];
        var destfield = trfield(spec["name"], srcfield);
        if( spec["type"] === "valuemap" ) {
          dest[destfield] = valuemap(spec, srcfield, src[srcfield]);
          if( !dest[destfield] ) {
            errata(oid, srcfield, "unmapped", src[srcfield]);
          }
        } else {
          dest[destfield] = src[srcfield];
        }
        delete src[srcfield];
      }
    } else {
      errata(oid, srcfield, "missing", null);
    }
  }

  for( const srcfield in src ) {
    errata(oid, srcfield, "unmatched", src[srcfield]);
  }

  return dest;
}


function valuemap(spec: Object, srcfield: string, srcval: string): string {
  if( "map" in spec ) {
    if( srcval in spec["map"] ) {
      return spec["map"][srcval];
    } 
  }
  return "";
}
  

  
