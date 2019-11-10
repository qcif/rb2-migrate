import {Handler} from './handlers';
import * as _ from 'lodash';
import {Person} from "./Person";

export class SingleTextFieldFromPerson extends Person implements Handler {

  buildIdentiferOutput(o: Object, output: Object): Object | undefined {
    output = super.buildIdentiferOutput(o, output);
    if (!_.isEmpty(output["text_full_name"])) {
      return _.assign({}, {
        text_full_name: output["text_full_name"],
      });
    }
    return undefined;
  }
}
