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


const CROSSWALK = {
  "dc:title": "title",
  "dc:description": "description"
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
      
export function crosswalk(original: Object, config: Object):Object {
  var dest = {};
  const unflattened = unflatten(original);

  for( const field in unflattened ) {
    if( field in config ) {
      dest[config[field]] = unflattened[field]; 
    } else {
      dest[field] = unflattened[field];
    }
  }

  return dest;
}


async function main(filename: string): Promise<void> {
  const raw = await fs.readJson(filename);
  const cooked = crosswalk(raw, CROSSWALK);
  console.log(cooked);
}


main('test/rdmp.json');
