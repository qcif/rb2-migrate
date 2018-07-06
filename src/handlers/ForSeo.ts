
import { Handler, HandlerBase } from './handlers';

const FOR_SEO_RE = /http:\/\/purl.org\/asc\/1297.0\/2008\/(seo|for)\/(\d+)$/;
const FOR_SEO_DELIM = ' - ';

export class ForSeo extends HandlerBase implements Handler {

  crosswalk(o:Object): Object {
    const url = o['rdf:resource']; 
    const name = o['skos:prefLabel'];
    if( !url ) {
      this.logger("handler", "for_seo", "", "Empty rdf:resource", "");
      return {};
    } 
    if( !name ) {
      this.logger("handler", "for_seo", "", "Empty skos:prefLabel", "");
      return {};
    }
    const m = url.match(FOR_SEO_RE);
    if( m ) {
      const [ c1, l1 ] = name.split(FOR_SEO_DELIM);
      const output = {
        'rdf:resource': url,
        'type': m[1],
        'name': name,
        'label': l1,
        'notation': m[2],
        'genealogy': this.genealogy(m[2])
      };
      this.logger("handler", "for_seo", "", "succeeded", JSON.stringify(output));
      return output;
    } else {
      return { 'label': 'crossswalk error' };
    }
  }

// FOR or SEO code genealogy:
// '112233' -> [ '11', '1122' ] etc

  genealogy(code:string):string[] {
    var c = '';
    var g = [];
    for( var i = 0; i < code.length - 2; i += 2 ) {
      c += code.slice(i, i + 2);
      g.push(c);
    }
    return g;
  }
}





