import {Handler} from './handlers';
import * as _ from 'lodash';
import {Person} from "./Person";

// Use the 'fields' clause in the crosswalk JSON file to map the
// fields in your rb1.x records to the above keys: this will be
// done before the Person handler is used to crosswalk the
// records.

export class AffiliatedPerson extends Person implements Handler {

  buildIdentiferOutput(o: Object, output: Object): Object | undefined {
    output = super.buildIdentiferOutput(o, output);
    if (output) {
      const affiliations = _.reduce([o["affiliationA"], o["affiliationB"], o["affiliationC"]], function (current, next) {
        if (next) {
          current.push(next);
        }
        return current;
      }, []);
      _.assign(output, {
        "parties": affiliations,
        "relationshipType": o["relationshipType"]
      });
    }
    return output

  }
}
