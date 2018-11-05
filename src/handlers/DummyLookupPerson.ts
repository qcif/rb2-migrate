import { LookupPerson } from './LookupPerson';
import * as _ from 'lodash';
import * as parseDomain from 'parse-domain';
// 

export class DummyLookupPerson extends LookupPerson  {

  async crosswalk(o: Object, mainObj?:any) {
    const walked = await super.crosswalk(o, mainObj);
    if (_.isArray(walked)) {
        _.each(walked, (w) => { this.insertDummyEmail(w, mainObj)});
    } else {
        this.insertDummyEmail(walked, mainObj);
    }
    return walked;
  }

  insertDummyEmail(o, mainObj) {
    if (_.isEmpty(o['email']) || _.isUndefined(o['email'])) {
        // try to guess the email...
        const domainParsed = parseDomain(mainObj['data_source_key'])
        o['email'] = `${o['given_name']}.${o['family_name']}@${domainParsed.domain}.${domainParsed.tld}`;
    }
  }

}


