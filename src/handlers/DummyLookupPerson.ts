import { LookupPerson } from './LookupPerson';
import * as _ from 'lodash';
// 

export class DummyLookupPerson extends LookupPerson  {

  async crosswalk(o: Object, mainObj?:any) {
    const walked = await super.crosswalk(o, mainObj);
    if (_.isArray(walked)) {
        _.each(walked, (w) => { this.insertDummys(w, mainObj)});
    } else {
        this.insertDummys(walked, mainObj);
    }
    return walked;
  }

  insertDummys(o, mainObj) {
    if (_.isEmpty(o['given_name']) || _.isUndefined(o['given_name'])) {
        o['given_name'] = "John";
    }
    if (_.isEmpty(o['family_name']) || _.isUndefined(o['family_name'])) {
        o['family_name'] = "Doe";
    }
    if (_.isEmpty(o['email']) || _.isUndefined(o['email'])) {
        o['email'] = `${o['given_name']}.${o['family_name']}@redboxresearchdata.com.au`;
    }
  }
}


