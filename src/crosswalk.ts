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

class TaggedLogger {

  log: any;
  tag: string;

  constructor(log: any, tag: string) {
    this.log = log;
    this.tag = tag;
  }

  error(msg: string): void {
    this.log.error(this.tag + ' ' + msg);
  }

  warn(msg: string): void {
    this.log.warn(this.tag + ' ' + msg);
  }

  info(msg: string): void {
    this.log.info(this.tag + ' ' + msg);
  }

  verbose(msg: string): void {
    this.log.verbose(this.tag + ' ' + msg);
  }

  debug(msg: string): void {
    this.log.debug(this.tag + ' ' + msg);
  }

  silly(msg: string): void {
    this.log.silly(this.tag + ' ' + msg);
  }
}
  




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
      
export function crosswalk(log: any, cwjson: Object, original: Object):Object {
  var dest = {};
  var src = unflatten(original);
  const idfield = cwjson['idfield'];
  const oid = original[idfield];

  const cwspec = cwjson['crosswalk'];

  for( const srcfield in cwspec ) {
    const tlog = new TaggedLogger(log, `[${oid}/${srcfield}]`);
    if( srcfield in src ) {
      tlog.verbose("found in src");
      if( typeof(cwspec[srcfield]) === 'string' ) {
        var destfield = trfield(cwspec[srcfield], srcfield); 
        dest[destfield] = src[srcfield];
        tlog.verbose("simple " + destfield + " set to " + JSON.stringify(src[srcfield]));
        if( ! dest[destfield] ) {
          tlog.verbose("empty field");
        }
        delete src[srcfield];
      } else {
        const spec = cwspec[srcfield];
        var destfield = trfield(spec["name"], srcfield);
        if( spec["type"] === "valuemap" ) {
          dest[destfield] = valuemap(tlog, spec, srcfield, src[srcfield]);
        } else {
          dest[destfield] = src[srcfield];
        }
        tlog.verbose("compound " + destfield + " set to " + JSON.stringify(dest[destfield]));
        delete src[srcfield];
      }
    } else {
      tlog.info("missing field");
    }
  }

  for( const srcfield in src ) {
    const tlog = new TaggedLogger(log, `[${oid}/${srcfield}]`);
    tlog.info("uncrosswalked field");
  }

  return dest;
}


function valuemap(tlog: any, spec: Object, srcfield: string, srcval: string): string {
  if( "map" in spec ) {
    if( srcval in spec["map"] ) {
      tlog.verbose("mapped " + srcval + " to " + spec["map"][srcval]);
      return spec["map"][srcval];
    } else {
      tlog.error(`no mapping for value "${srcval}"`);
    }
  } else {
    tlog.error(`No 'map' config in valuemap field`);
  }
  return "";
}
  

  
